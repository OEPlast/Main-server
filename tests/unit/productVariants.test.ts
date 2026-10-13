/*
 * Option combinations: matching, stock, admin validation and pricing.
 *
 *   npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { availableStock, findVariant, normaliseVariants, totalVariantStock, variantKey } from '@/helpers/productVariants';
import { resolvePricingVariant } from '@/helpers/pricingUtils';
import { priceLine } from '@/services/pricing/linePricing';

const attributes = [
  { name: 'Metal', children: [{ name: 'Gold', price: 60000, stock: 0 }, { name: 'Silver', stock: 0 }] },
  { name: 'Size', children: [{ name: '6', stock: 0 }, { name: '7', stock: 0 }] },
];
const gold7 = [
  { name: 'Metal', value: 'Gold' },
  { name: 'Size', value: '7' },
];

describe('normaliseVariants', () => {
  test('fills keys and keeps price, stock and sku', () => {
    const r = normaliseVariants(
      [
        { options: [{ name: 'Size', value: '7' }, { name: 'Metal', value: 'Gold' }], price: 85000, stock: 2, sku: ' G7 ' },
        { options: [{ name: 'Metal', value: 'Silver' }, { name: 'Size', value: '6' }], stock: 0 },
      ],
      attributes
    );
    assert.ok('variants' in r);
    assert.deepEqual(r.variants[0], { key: 'Metal=Gold|Size=7', options: [{ name: 'Size', value: '7' }, { name: 'Metal', value: 'Gold' }], price: 85000, stock: 2, sku: 'G7' });
    assert.equal(r.variants[1]!.price, undefined);
    assert.equal(totalVariantStock(r.variants), 2);
  });

  test('empty or missing input means no combinations', () => {
    assert.deepEqual(normaliseVariants(undefined, attributes), { variants: [] });
    assert.deepEqual(normaliseVariants([], attributes), { variants: [] });
  });

  test('rejects unknown values, mixed groups, duplicates and bad numbers', () => {
    const err = (input: unknown[]) => {
      const r = normaliseVariants(input, attributes);
      assert.ok('error' in r, JSON.stringify(r));
      return r.error;
    };
    assert.match(err([{ options: [{ name: 'Metal', value: 'Platinum' }], stock: 1 }]), /not one of the product's options/);
    assert.match(err([{ options: gold7, stock: 1 }, { options: [{ name: 'Metal', value: 'Silver' }], stock: 1 }]), /same option groups/);
    assert.match(err([{ options: gold7, stock: 1 }, { options: [...gold7].reverse(), stock: 1 }]), /listed twice/);
    assert.match(err([{ options: [{ name: 'Metal', value: 'Gold' }, { name: 'Metal', value: 'Silver' }], stock: 1 }]), /twice/);
    assert.match(err([{ options: gold7, stock: 1.5 }]), /whole number/);
    assert.match(err([{ options: gold7, stock: 1, price: -1 }]), /price/);
    assert.match(err([{ options: [], stock: 1 }]), /at least one option/);
  });
});

describe('findVariant and availableStock', () => {
  const variants = [
    { key: variantKey(gold7), options: gold7, price: 85000, stock: 2 },
    { key: 'Metal=Silver|Size=7', options: [{ name: 'Metal', value: 'Silver' }, { name: 'Size', value: '7' }], stock: 0 },
  ];

  test('matches regardless of order and ignores extra selected groups', () => {
    assert.equal(findVariant(variants, [{ name: 'Engraving', value: 'Yes' }, ...[...gold7].reverse()])?.stock, 2);
    assert.equal(findVariant(variants, [{ name: 'Metal', value: 'Gold' }]), undefined);
  });

  test('stock is the combination’s; unlisted combinations have none', () => {
    const product = { stock: 2, variants };
    assert.equal(availableStock(product, gold7), 2);
    assert.equal(availableStock(product, [{ name: 'Metal', value: 'Silver' }, { name: 'Size', value: '7' }]), 0);
    assert.equal(availableStock(product, [{ name: 'Metal', value: 'Gold' }, { name: 'Size', value: '6' }]), 0);
    assert.equal(availableStock(product, []), 0);
    assert.equal(availableStock({ stock: 9 }, gold7), 9);
  });
});

describe('pricing with combinations', () => {
  const product = {
    price: 50000,
    stock: 3,
    attributes,
    pricingTiers: [{ minQty: 2, strategy: 'percentOff' as const, value: 10 }],
    variants: [
      { key: 'Metal=Gold|Size=7', options: gold7, price: 85000, stock: 2 },
      { key: 'Metal=Gold|Size=6', options: [{ name: 'Metal', value: 'Gold' }, { name: 'Size', value: '6' }], stock: 1 },
    ],
  };

  test('the combination price replaces option and product prices', () => {
    assert.equal(priceLine({ product, qty: 1, selectedAttributes: gold7 }).unitPrice, 85000);
  });

  test('a combination without a price falls back to the priced option, then the product', () => {
    const gold6 = [{ name: 'Metal', value: 'Gold' }, { name: 'Size', value: '6' }];
    assert.equal(priceLine({ product, qty: 1, selectedAttributes: gold6 }).unitPrice, 60000);
    assert.equal(priceLine({ product: { ...product, variants: undefined }, qty: 1, selectedAttributes: [{ name: 'Metal', value: 'Silver' }] }).unitPrice, 50000);
  });

  test('bulk tiers and sales still apply on top of the combination price', () => {
    assert.equal(priceLine({ product, qty: 2, selectedAttributes: gold7 }).unitPrice, 76500);
    const sale = { _id: 's', type: 'Normal' as const, isActive: true, variants: [{ attributeName: 'all', amountOff: 5000 }] };
    assert.equal(priceLine({ product, qty: 1, selectedAttributes: gold7, sale }).unitPrice, 80000);
  });

  test('the cart service resolves the same price', () => {
    assert.equal(resolvePricingVariant(product as never, gold7)?.price, 85000);
    assert.equal(resolvePricingVariant(product as never, [{ name: 'Metal', value: 'Gold' }, { name: 'Size', value: '6' }])?.price, 60000);
  });
});
