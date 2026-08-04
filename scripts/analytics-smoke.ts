/**
 * Analytics engine smoke test.
 *
 * Exercises the query engine against the real database and prints what it
 * returns, so the behaviours the rebuild exists to deliver can be checked
 * against actual data rather than asserted:
 *
 *   - revenue measured on `paidAt` (not `createdAt`) with `isPaid`
 *   - dense buckets, zero-filled, in the store timezone
 *   - sub-day granularity, which was previously inexpressible
 *   - empty windows returning 200 with zeros rather than an error
 *   - unstamped documents surfaced instead of silently absent
 *
 * Read-only. Usage:
 *   npx ts-node scripts/analytics-smoke.ts
 */
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI or DATABASE_URL not found');
  process.exit(1);
}

const heading = (text: string) => console.log(`\n${'─'.repeat(74)}\n${text}\n`);

async function main() {
  await mongoose.connect(MONGODB_URI as string);
  console.log('✅ Connected\n');

  const { runSeries, runSummary, runBreakdown, getAnalyticsMeta } = await import(
    '../src/services/admin/analytics/engine'
  );

  heading('1. Registry — what the engine can answer');
  const meta = getAnalyticsMeta();
  console.log(`   ${meta.metrics.length} metrics, ${meta.dimensions.length} dimensions`);
  console.log(
    '   ' +
      meta.metrics
        .map((m: any) => `${m.key}→${m.timestampField}`)
        .join('\n   ')
  );

  heading('2. Series — revenue + orders over the last 12 months, monthly');
  const series = await runSeries({
    metrics: ['revenue', 'orders_placed', 'orders_paid'],
    preset: 'last_12_months',
    granularity: 'month',
    compare: 'previous',
  });

  if (!series.data) {
    console.log(`   ⚠️  ${series.code}: ${series.message}`);
  } else {
    const d = series.data;
    console.log(`   granularity=${d.granularity} tz=${d.timezone} buckets=${d.bucketCount}`);
    console.log(`   window: ${d.from}  →  ${d.to}`);
    console.log('');
    for (const row of d.series) {
      const revenue = Number(row.revenue ?? 0);
      const placed = Number(row.orders_placed ?? 0);
      const paid = Number(row.orders_paid ?? 0);
      console.log(
        `   ${String(row.bucketLabel).padEnd(10)} revenue=${revenue.toFixed(0).padStart(12)}  placed=${String(placed).padStart(5)}  paid=${String(paid).padStart(5)}`
      );
    }
    console.log('');
    console.log(`   totals: ${JSON.stringify(d.totals)}`);
    console.log(`   comparison: ${JSON.stringify(d.comparison?.totals)}`);
    console.log(`   changePct: ${JSON.stringify(d.comparison?.changePct)}`);
    console.log(`   unstamped: ${JSON.stringify(d.unstamped)}`);
  }

  heading('3. Revenue definition — paid vs the legacy "not cancelled/failed"');
  const Order = mongoose.model('Order');
  const [legacy] = await Order.aggregate([
    { $match: { status: { $nin: ['Cancelled', 'Failed'] } } },
    { $group: { _id: null, value: { $sum: '$total' } } },
  ]);
  const [engineTotal] = await Order.aggregate([
    { $match: { isPaid: true, paidAt: { $ne: null } } },
    { $group: { _id: null, value: { $sum: '$total' } } },
  ]);
  console.log(`   legacy all-time revenue (createdAt, status-based): ${legacy?.value ?? 0}`);
  console.log(`   engine all-time revenue (paidAt + isPaid):         ${engineTotal?.value ?? 0}`);
  const delta = (engineTotal?.value ?? 0) - (legacy?.value ?? 0);
  console.log(
    `   delta: ${delta} (${legacy?.value ? ((delta / legacy.value) * 100).toFixed(2) : '0'}%)`
  );

  heading('4. Sub-day granularity — previously inexpressible');
  const recent = await runSeries({ metrics: ['orders_placed'], preset: 'last_10_minutes' });
  console.log(
    `   ${recent.code} granularity=${recent.data?.granularity} buckets=${recent.data?.bucketCount}`
  );
  console.log(`   first bucket: ${recent.data?.series[0]?.bucket}`);
  console.log(`   last  bucket: ${recent.data?.series.at(-1)?.bucket}`);

  heading('5. Empty window — must be 200 with zeros, never an error');
  const empty = await runSeries({
    metrics: ['revenue'],
    from: '1999-01-01',
    to: '1999-01-07',
    granularity: 'day',
  });
  console.log(`   code=${empty.code} data is null? ${empty.data === null}`);
  console.log(`   buckets=${empty.data?.bucketCount} totals=${JSON.stringify(empty.data?.totals)}`);
  console.log(`   every bucket zero? ${empty.data?.series.every((r: any) => r.revenue === 0)}`);

  heading('6. Bucket boundaries carry a real offset (never bare Z)');
  const tzCheck = await runSeries({
    metrics: ['orders_placed'],
    from: '2026-03-01',
    to: '2026-03-05',
    granularity: 'day',
  });
  tzCheck.data?.series.forEach((r: any) => console.log(`   ${r.bucketLabel}  ${r.bucket}`));

  heading('7. Breakdown — orders by status');
  const breakdown = await runBreakdown({
    metric: 'orders_placed',
    dimension: 'order_status',
    preset: 'last_5_years',
  });
  if (!breakdown.data) {
    console.log(`   ⚠️  ${breakdown.code}: ${breakdown.message}`);
  } else {
    breakdown.data.rows.forEach((r) =>
      console.log(`   ${r.label.padEnd(14)} ${String(r.value).padStart(6)}  ${r.share}%`)
    );
  }

  heading('8. Summary — AOV total is its own pass, not the mean of bucket means');
  const summary = await runSummary({ metrics: ['aov', 'revenue', 'orders_paid'], preset: 'last_5_years' });
  console.log(`   ${JSON.stringify(summary.data?.totals)}`);
  const t = summary.data?.totals;
  if (t) {
    const derived = Number(t.revenue) / Number(t.orders_paid);
    console.log(`   revenue/orders_paid = ${derived.toFixed(2)}  (engine aov = ${t.aov})`);
  }

  heading('9. Error handling');
  for (const [label, q] of [
    ['unknown metric', { metrics: ['nonsense'], preset: 'last_7_days' }],
    ['from after to', { metrics: ['revenue'], from: '2026-08-01', to: '2026-07-01' }],
    ['granularity too fine', { metrics: ['revenue'], preset: 'last_5_years', granularity: 'minute' }],
    ['bad timezone', { metrics: ['revenue'], preset: 'last_7_days', tz: 'Mars/Olympus' }],
  ] as const) {
    const res = await runSeries(q as any);
    console.log(`   ${res.code}  ${label}: ${res.message.slice(0, 110)}`);
  }

  await mongoose.disconnect();
  console.log('\n👋 Disconnected');
}

main().catch(async (error) => {
  console.error('❌', error);
  await mongoose.disconnect();
  process.exit(1);
});
