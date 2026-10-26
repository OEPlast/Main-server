/*
 * Product extras: optional priced add-ons (tester, free polish).
 *
 *   npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTRA_ATTRIBUTE, extrasUnitPrice, normaliseExtras } from '@/helpers/productExtras';
import { priceLine } from '@/services/pricing/linePricing';

const extras = [
  { name: 'Tester', price: 18000 },
  { name: 'Silver polish', price: 0 },
];
const tick = (...names: string[]) => names.map((value) => ({ name: EXTRA_ATTRIBUTE, value }));

describe('normaliseExtras', () => {
  test('trims, defaults the price to free and keeps descriptions', () => {
    assert.deepEqual(normaliseExtras([{ name: ' Tester ', price: 18000 }, { name: 'Silver polish', description: ' Keeps it bright ' }]), {
      extras: [{ name: 'Tester', price: 18000 }, { name: 'Silver polish', price: 0, description: 'Keeps it bright' }],
    });
  });
  test('rejects nameless, duplicate, negative and too many', () => {
    assert.ok('error' in normaliseExtras([{ name: '' }]));
    assert.ok('error' in normaliseExtras([{ name: 'Tester' }, { name: 'tester' }]));
    assert.ok('error' in normaliseExtras([{ name: 'Tester', price: -1 }]));
    assert.ok('error' in normaliseExtras(Array.from({ length: 11 }, (_, i) => ({ name: `E${i}` }))));
  });
});

describe('pricing with extras', () => {
  const product = { price: 75000, extras, pricingTiers: [{ minQty: 2, strategy: 'percentOff' as const, value: 10 }] };

  test('each ticked extra adds its price per unit; unknown and unticked ones add nothing', () => {
    assert.equal(extrasUnitPrice(extras, tick('Tester', 'Silver polish', 'Gift wrap')), 18000);
    assert.equal(priceLine({ product, qty: 1, selectedAttributes: tick('Tester') }).unitPrice, 93000);
    assert.equal(priceLine({ product, qty: 1, selectedAttributes: tick('Silver polish') }).unitPrice, 75000);
    assert.equal(priceLine({ product, qty: 1 }).unitPrice, 75000);
  });

  test('tiers and sales discount the item, not its extras', () => {
    // 2 units: 10% off 75,000 = 67,500, plus 18,000 tester = 85,500 each
    const tiered = priceLine({ product, qty: 2, selectedAttributes: tick('Tester') });
    assert.equal(tiered.unitPrice, 85500);
    assert.equal(tiered.tierDiscountTotal, 15000);
    const sale = { _id: 's', type: 'Normal' as const, isActive: true, variants: [{ attributeName: 'all', discount: 20 }] };
    const onSale = priceLine({ product, qty: 1, selectedAttributes: tick('Tester'), sale });
    assert.equal(onSale.unitPrice, 78000); // 60,000 + 18,000
    assert.equal(onSale.sale?.unitDiscount, 15000);
  });
});
