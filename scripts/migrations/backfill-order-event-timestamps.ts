/**
 * Migration Script: Backfill order event timestamps
 *
 * Populates `cancelledAt` / `completedAt` / `failedAt` on orders that reached a
 * terminal status before those fields existed.
 *
 * ── Two very different kinds of backfill ─────────────────────────────────────
 *
 * 1. RECOVERABLE (accurate). An order's status becomes 'Completed' in the same
 *    block that marks its shipment delivered (admin/ShipmentService), so for
 *    completed orders `deliveredAt` IS the completion time. Copying it is
 *    reconstruction from the same event, not a guess. Applied by `--apply`.
 *
 * 2. APPROXIMATE (lossy). For everything else the only hint is `updatedAt`,
 *    which is trustworthy ONLY if nothing touched the document after the
 *    transition — unverifiable. Applied by `--use-updated-at`, and wrong for
 *    any order edited post-transition.
 *
 * Deliberately never falls back to `createdAt`: dating a cancellation to when
 * the order was placed is precisely the bug this change exists to fix. Orders
 * left null are reported by the analytics layer as unknown-date, which is more
 * useful than a confidently wrong chart.
 *
 * Usage:
 *   npx ts-node scripts/migrations/backfill-order-event-timestamps.ts                  # report only
 *   npx ts-node scripts/migrations/backfill-order-event-timestamps.ts --apply          # accurate recovery only
 *   npx ts-node scripts/migrations/backfill-order-event-timestamps.ts --apply --use-updated-at
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Order from '../../src/models/Order';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI or DATABASE_URL not found in environment variables');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const useUpdatedAt = process.argv.includes('--use-updated-at');

const TERMINAL: Array<{ status: string; field: string }> = [
  { status: 'Cancelled', field: 'cancelledAt' },
  { status: 'Completed', field: 'completedAt' },
  { status: 'Failed', field: 'failedAt' },
];

async function backfill() {
  try {
    console.log(`🚀 Backfill order event timestamps${apply ? '' : ' (REPORT ONLY — no writes)'}`);
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected\n');

    console.log(`📊 Total orders: ${await Order.countDocuments()}\n`);

    // ── 1. Accurate recovery: completedAt := deliveredAt ────────────────────
    const recoverableFilter = {
      status: 'Completed',
      completedAt: { $exists: false },
      deliveredAt: { $exists: true, $ne: null },
    };
    const recoverable = await Order.countDocuments(recoverableFilter);

    console.log('RECOVERABLE (accurate — same event)');
    console.log(`  completedAt from deliveredAt : ${recoverable}`);

    if (apply && recoverable > 0) {
      const result = await Order.updateMany(recoverableFilter, [
        { $set: { completedAt: '$deliveredAt' } },
      ]);
      console.log(`  ✅ stamped ${result.modifiedCount}`);
    }
    console.log();

    // ── 2. What remains genuinely unknown ───────────────────────────────────
    console.log('REMAINING (no reliable source)');
    let stillUnknown = 0;
    for (const { status, field } of TERMINAL) {
      const missing = await Order.countDocuments({ status, [field]: { $exists: false } });
      stillUnknown += missing;
      if (missing > 0) console.log(`  ${status.padEnd(10)} missing ${field.padEnd(12)}: ${missing}`);
    }
    if (stillUnknown === 0) console.log('  none');
    console.log();

    if (useUpdatedAt && apply && stillUnknown > 0) {
      console.log('APPROXIMATE (from updatedAt — lossy)');
      for (const { status, field } of TERMINAL) {
        const filter = { status, [field]: { $exists: false } };
        if ((await Order.countDocuments(filter)) === 0) continue;
        const result = await Order.updateMany(filter, [{ $set: { [field]: '$updatedAt' } }]);
        console.log(`  ⚠️  ${status}: stamped ${result.modifiedCount} from updatedAt`);
      }
      console.log();
    }

    // ── 3. Refunds ─────────────────────────────────────────────────────────
    const refundedMissing = await Order.countDocuments({ refundedAt: { $exists: false } });
    console.log(`refundedAt missing on ${refundedMissing} orders`);
    console.log('  (not backfillable here — refund times live on return_refund Transactions;');
    console.log('   new refunds stamp the order going forward)\n');

    if (!apply) {
      console.log('📋 Report complete. Nothing was written.');
      console.log(`   --apply would accurately recover ${recoverable} completion times.`);
      console.log(`   ${stillUnknown - recoverable} would remain unknown (recommended: leave null).`);
      console.log('   Add --use-updated-at to approximate those, accepting the inaccuracy.');
    } else {
      const finalUnknown = await Order.countDocuments({
        $or: TERMINAL.map(({ status, field }) => ({ status, [field]: { $exists: false } })),
      });
      console.log(`✓ Verification: ${finalUnknown} terminal orders still without a stamp`);
    }

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed.');
  } catch (error) {
    console.error('\n❌ Backfill failed:');
    console.error(error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

backfill();
