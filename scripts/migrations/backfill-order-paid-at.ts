/**
 * Backfill `Order.paidAt` from the order's completed payment transaction.
 *
 * ## Why this is accurate recovery, not a guess
 *
 * These orders carry `isPaid: true` and a **completed** Transaction, so the fact
 * of payment is not in doubt — only the timestamp was never written, because
 * `paidAt` did not exist when they were paid. The Transaction's own `paidAt` is
 * the moment money actually arrived, which is precisely what the order field is
 * supposed to hold. Recovering from it reconstructs the same event from the same
 * source, exactly like `completedAt` was recovered from `deliveredAt`.
 *
 * `createdAt` would also be close (payment follows checkout by seconds) and
 * `updatedAt` would be wrong for any order touched since — neither is needed
 * when the real event time is available.
 *
 * ## Why it matters
 *
 * `revenue` is measured on `paidAt`, so an order missing it is excluded from
 * revenue entirely despite being paid. That is real income going unreported.
 *
 * Usage:
 *   npx ts-node scripts/migrations/backfill-order-paid-at.ts           # report only
 *   npx ts-node scripts/migrations/backfill-order-paid-at.ts --apply   # write
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Order from '../../src/models/Order';
import Transaction from '../../src/models/Transaction';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI or DATABASE_URL not found in environment variables');
  process.exit(1);
}

const apply = process.argv.includes('--apply');

const naira = (value: number) =>
  `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

async function backfill() {
  try {
    console.log(`🚀 Backfill Order.paidAt from payment transactions${apply ? '' : ' (REPORT ONLY — no writes)'}`);
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected\n');

    const candidates = await Order.find({ isPaid: true, paidAt: null })
      .select('_id total status createdAt')
      .lean();

    console.log(`📊 Orders marked paid with no paidAt: ${candidates.length}`);

    if (candidates.length === 0) {
      console.log('   Nothing to do.');
      return;
    }

    const excluded = candidates.reduce((sum, order) => sum + (order.total ?? 0), 0);
    console.log(`   Revenue currently excluded because of this: ${naira(excluded)}\n`);

    let recovered = 0;
    let recoveredValue = 0;
    let unrecoverable = 0;
    const byStatus = new Map<string, number>();

    for (const order of candidates) {
      const transaction = (await Transaction.findOne({
        orderId: order._id,
        status: 'completed',
      })
        .select('paidAt paymentDate createdAt')
        .lean()) as { paidAt?: Date; paymentDate?: Date; createdAt?: Date } | null;

      // Preference order is strict: the gateway-confirmed payment time, then the
      // recorded payment date, then when the transaction row was written. Never
      // the order's own updatedAt — that reflects the latest edit, not payment.
      const paidAt = transaction?.paidAt ?? transaction?.paymentDate ?? transaction?.createdAt;

      if (!paidAt) {
        unrecoverable++;
        continue;
      }

      byStatus.set(order.status as string, (byStatus.get(order.status as string) ?? 0) + 1);
      recovered++;
      recoveredValue += order.total ?? 0;

      if (apply) {
        await Order.updateOne({ _id: order._id, paidAt: null }, { $set: { paidAt } });
      }
    }

    console.log('RECOVERABLE (from the completed transaction)');
    for (const [status, count] of byStatus) {
      console.log(`  ${String(status).padEnd(12)} ${String(count).padStart(5)}`);
    }
    console.log(`  ${'TOTAL'.padEnd(12)} ${String(recovered).padStart(5)}   worth ${naira(recoveredValue)}`);
    if (apply) console.log(`  ✅ stamped ${recovered}`);

    if (unrecoverable > 0) {
      console.log(`\nUNRECOVERABLE (no usable transaction time): ${unrecoverable}`);
      console.log('  Left null — reported as unstamped rather than dated to a guess.');
    }

    const remaining = await Order.countDocuments({ isPaid: true, paidAt: null });
    console.log(`\n✓ Verification: ${remaining} paid orders still without paidAt`);

    if (!apply) {
      console.log('\n📋 Report complete. Nothing was written.');
      console.log(`   --apply would recover ${recovered} payment times, restoring ${naira(recoveredValue)} to revenue.`);
    }
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Database connection closed.');
  }
}

backfill();
