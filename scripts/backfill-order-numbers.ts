/**
 * Assigns `orderNumber` to orders created before the field existed.
 *
 * Orders are processed oldest-first and numbered per calendar month, so historical
 * references read the same way as new ones (RW-2506-00001, RW-2506-00002, …). The month
 * counters are then raised to the highest number issued, so a newly placed order can never
 * collide with a backfilled one.
 *
 * Safe to re-run: orders that already have a number are skipped.
 *
 * Usage:
 *   npm run backfill:order-numbers            # apply
 *   npm run backfill:order-numbers -- --dry   # report only
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import Order from '../src/models/Order';
import { ensureSequenceAtLeast } from '../src/models/Counter';
import { counterKeyForPeriod, formatOrderNumber, periodKey } from '../src/utils/orderNumber';

config();

const MONGO_URI = process.env.MONGODB_URI || '';
const DRY_RUN = process.argv.includes('--dry');
const BATCH = 500;

async function main(): Promise<void> {
  if (!MONGO_URI) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(MONGO_URI);
  console.log(`Connected. ${DRY_RUN ? 'DRY RUN — nothing will be written.' : 'Applying changes.'}`);

  const total = await Order.countDocuments({ $or: [{ orderNumber: null }, { orderNumber: { $exists: false } }] });
  console.log(`${total} order(s) without an orderNumber.`);
  if (total === 0) {
    await mongoose.disconnect();
    return;
  }

  // Highest sequence issued per month, so the counters can be raised at the end.
  const highestByPeriod = new Map<string, number>();
  const assigned = new Map<string, string>();
  let processed = 0;

  const cursor = Order.find({ $or: [{ orderNumber: null }, { orderNumber: { $exists: false } }] })
    .select('_id createdAt')
    .sort({ createdAt: 1, _id: 1 })
    .lean()
    .cursor();

  let batch: Array<{ updateOne: { filter: { _id: mongoose.Types.ObjectId }; update: { $set: { orderNumber: string } } } }> =
    [];

  for await (const order of cursor) {
    // Very old documents predate `timestamps`; the ObjectId still carries a creation time.
    const createdAt = order.createdAt ?? order._id.getTimestamp();
    const period = periodKey(new Date(createdAt));
    const sequence = (highestByPeriod.get(period) ?? 0) + 1;
    highestByPeriod.set(period, sequence);

    const orderNumber = formatOrderNumber(period, sequence);
    assigned.set(order._id.toString(), orderNumber);

    batch.push({ updateOne: { filter: { _id: order._id }, update: { $set: { orderNumber } } } });

    if (batch.length >= BATCH) {
      if (!DRY_RUN) await Order.bulkWrite(batch, { ordered: false });
      processed += batch.length;
      batch = [];
      console.log(`  ${processed}/${total}`);
    }
  }

  if (batch.length > 0) {
    if (!DRY_RUN) await Order.bulkWrite(batch, { ordered: false });
    processed += batch.length;
  }

  // Uniqueness check before the counters move, so a bad run is caught here rather than by a
  // duplicate-key error on someone's checkout.
  const distinct = new Set(assigned.values());
  if (distinct.size !== assigned.size) {
    throw new Error(`Generated ${assigned.size} numbers but only ${distinct.size} are distinct — aborting.`);
  }

  if (!DRY_RUN) {
    for (const [period, highest] of highestByPeriod) {
      await ensureSequenceAtLeast(counterKeyForPeriod(period), highest);
    }
  }

  console.log(`\n${DRY_RUN ? 'Would assign' : 'Assigned'} ${processed} order number(s) across ${highestByPeriod.size} month(s):`);
  for (const [period, highest] of [...highestByPeriod].sort()) {
    console.log(`  ${period}: ${highest} (up to ${formatOrderNumber(period, highest)})`);
  }

  const remaining = await Order.countDocuments({ $or: [{ orderNumber: null }, { orderNumber: { $exists: false } }] });
  console.log(`\n${remaining} order(s) still without an orderNumber.`);
  if (!DRY_RUN && remaining > 0) {
    console.error('Some orders were not updated — re-run the script.');
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Backfill failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
