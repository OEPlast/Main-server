/**
 * Analytics parity harness.
 *
 * Runs each legacy analytics function and its query-engine equivalent over the
 * same windows and prints a diff. With no unit-test suite in the repo, this is
 * the evidence that a legacy endpoint can be retired: "the registry equivalent
 * returns the same number, or differs for a reason we can state".
 *
 * A difference is not automatically a failure. Several are expected and
 * intended — the legacy layer bucketed on `createdAt` and counted unpaid orders
 * as revenue, which is precisely what the rebuild set out to correct. The
 * EXPECTATION column says which is which, so an unexplained gap stands out from
 * a deliberate one.
 *
 * Read-only. Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/analytics-parity.ts
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

type Expectation = 'same' | 'engine-corrects' | 'scope-differs';

interface Case {
  label: string;
  /** Legacy service function name, for the report. */
  legacy: string;
  /** Registry key the legacy endpoint maps onto. */
  metric: string;
  expectation: Expectation;
  why?: string;
  run: (from: Date, to: Date) => Promise<number>;
}

const WINDOWS: Array<{ label: string; from: Date; to: Date }> = (() => {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  return [
    { label: 'last 7 days', from: daysAgo(7), to: now },
    { label: 'last 90 days', from: daysAgo(90), to: now },
    { label: 'full history', from: new Date('2020-01-01T00:00:00.000Z'), to: now },
  ];
})();

const sumOf = (rows: Array<Record<string, unknown>>, field = 'count'): number =>
  rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);

async function main() {
  await mongoose.connect(MONGODB_URI as string);
  console.log('✅ Connected\n');

  const LegacyService = (await import('../src/services/admin/AnalyticsService')).default;
  const { runSummary } = await import('../src/services/admin/analytics/engine');

  const engineTotal = async (metric: string, from: Date, to: Date): Promise<number> => {
    const { data } = await runSummary({
      metrics: [metric],
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return Number(data?.totals?.[metric] ?? 0);
  };

  const CASES: Case[] = [
    {
      label: 'Orders placed',
      legacy: 'getOrdersByDays',
      metric: 'orders_placed',
      expectation: 'same',
      why: 'Both count orders on createdAt — this one was already right.',
      run: async (from, to) => {
        const res = await LegacyService.getOrdersByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: 'Cancellations',
      legacy: 'getOrderCancelledByDays',
      metric: 'cancellations',
      expectation: 'engine-corrects',
      why: 'Legacy dates a cancellation to when the ORDER was placed; engine uses cancelledAt.',
      run: async (from, to) => {
        const res = await LegacyService.getOrderCancelledByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: '"Failed" orders',
      legacy: 'getOrderFailedByDays',
      metric: 'pending_orders',
      expectation: 'same',
      why: 'MISLABELLED IN LEGACY: getOrderFailedByDays matches status "Pending", not "Failed" (AnalyticsService.ts:1364), so the admin\'s "failed orders" chart has always shown PENDING orders. Compared against pending_orders, which is what it actually measures. Genuine failures are the `failures` metric — currently 0, because no order in the data has status Failed.',
      run: async (from, to) => {
        const res = await LegacyService.getOrderFailedByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: 'New customers',
      legacy: 'getUserJoiningRateByDays',
      metric: 'new_customers',
      expectation: 'same',
      why: 'Registration is genuinely a creation-time event.',
      run: async (from, to) => {
        const res = await LegacyService.getUserJoiningRateByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: 'Reviews written',
      legacy: 'getReviewsByDays',
      metric: 'reviews_written',
      expectation: 'scope-differs',
      why: 'Engine counts approved reviews only, matching what the storefront shows.',
      run: async (from, to) => {
        const res = await LegacyService.getReviewsByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: 'Products added',
      legacy: 'getProductsAddedByDays',
      metric: 'products_added',
      expectation: 'same',
      run: async (from, to) => {
        const res = await LegacyService.getProductsAddedByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: 'Coupon redemptions',
      legacy: 'getCouponRedemptionByDays',
      metric: 'coupon_redemptions',
      expectation: 'same',
      run: async (from, to) => {
        const res = await LegacyService.getCouponRedemptionByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: 'Shipments delivered',
      legacy: 'getShipmentsDeliveredByDays',
      metric: 'shipments_delivered',
      expectation: 'engine-corrects',
      why: 'Engine measures on Shipment.deliveredOn rather than record creation.',
      run: async (from, to) => {
        const res = await LegacyService.getShipmentsDeliveredByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: 'Wishlist additions',
      legacy: 'getWishlistFrequencyByDays',
      metric: 'wishlist_adds',
      expectation: 'same',
      run: async (from, to) => {
        const res = await LegacyService.getWishlistFrequencyByDays({ from, to });
        return sumOf((res.data as any)?.data ?? []);
      },
    },
    {
      label: 'Revenue',
      legacy: 'getSalesOverview.totalRevenue',
      metric: 'revenue',
      expectation: 'engine-corrects',
      why: 'THE BIG ONE. Legacy sums orders on createdAt where status not in {Cancelled,Failed} — unpaid pending orders counted as revenue. Engine sums paid orders on paidAt.',
      run: async (from, to) => {
        const res = await LegacyService.getSalesOverview({ from, to });
        return Number((res.data as any)?.totalRevenue ?? 0);
      },
    },
    {
      label: 'Orders (overview)',
      legacy: 'getOrdersOverview.totalOrders',
      metric: 'orders_placed',
      expectation: 'same',
      run: async (from, to) => {
        const res = await LegacyService.getOrdersOverview({ from, to });
        return Number((res.data as any)?.totalOrders ?? 0);
      },
    },
  ];

  for (const window of WINDOWS) {
    console.log('═'.repeat(104));
    console.log(
      `WINDOW: ${window.label}   ${window.from.toISOString().slice(0, 10)} → ${window.to.toISOString().slice(0, 10)}`
    );
    console.log('═'.repeat(104));
    console.log(
      `${'METRIC'.padEnd(22)}${'LEGACY'.padStart(16)}${'ENGINE'.padStart(16)}${'DELTA'.padStart(16)}${'  EXPECTATION'}`
    );
    console.log('─'.repeat(104));

    for (const testCase of CASES) {
      let legacyValue = NaN;
      let engineValue = NaN;

      try {
        legacyValue = await testCase.run(window.from, window.to);
      } catch (error) {
        console.log(`${testCase.label.padEnd(22)}${'ERROR'.padStart(16)}  ${String(error).slice(0, 60)}`);
        continue;
      }

      try {
        engineValue = await engineTotal(testCase.metric, window.from, window.to);
      } catch (error) {
        console.log(`${testCase.label.padEnd(22)}${'—'.padStart(16)}${'ERROR'.padStart(16)}  ${String(error).slice(0, 50)}`);
        continue;
      }

      const delta = engineValue - legacyValue;
      const matches = Math.abs(delta) < 0.01;

      // A "same" case that differs is the only genuine alarm here.
      const flag =
        testCase.expectation === 'same' ? (matches ? '✅ same' : '❌ UNEXPECTED DIFFERENCE') :
        testCase.expectation === 'engine-corrects' ? (matches ? '➖ same (no affected rows)' : '🔧 engine corrects') :
        (matches ? '➖ same' : '📐 scope differs');

      console.log(
        `${testCase.label.padEnd(22)}${fmt(legacyValue).padStart(16)}${fmt(engineValue).padStart(16)}${fmt(delta).padStart(16)}  ${flag}`
      );
    }
    console.log('');
  }

  console.log('═'.repeat(104));
  console.log('NOTES');
  console.log('═'.repeat(104));
  for (const testCase of CASES.filter((c) => c.why)) {
    console.log(`  ${testCase.label} (${testCase.legacy} → ${testCase.metric})`);
    console.log(`    ${testCase.why}`);
  }

  await mongoose.disconnect();
  console.log('\n👋 Disconnected');
}

const fmt = (value: number): string =>
  Number.isNaN(value) ? '—' : Number(value.toFixed(2)).toLocaleString('en-US');

main().catch(async (error) => {
  console.error('❌', error);
  await mongoose.disconnect();
  process.exit(1);
});
