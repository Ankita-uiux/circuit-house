import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../../artifacts/api-server/src/data/catalog';
import { EMPTY_STATE, normalizeState } from '../../artifacts/api-server/src/lib/conversation-state';
import { allowedProducts, overBudgetBy, sanitizeReply } from '../../artifacts/api-server/src/lib/reply-filters';
import { deliveryEstimate, exchangeEstimate } from '../../artifacts/api-server/src/lib/store-services';
import { withStoreDetails } from '../../artifacts/api-server/src/lib/product-extras';

const state = (patch: Partial<typeof EMPTY_STATE>) => normalizeState({ ...EMPTY_STATE, ...patch });

test('no category: no product cards', () => {
  assert.equal(allowedProducts(state({}), catalog).length, 0);
});

test('only the requested category, within budget', () => {
  const list = allowedProducts(state({ category: 'Laptops', budget_max: 70000 }), catalog);
  assert.ok(list.length > 0);
  assert.ok(list.every((p) => p.category === 'Laptops' && p.price <= 70000));
});

test('stretch budget allows a little over, labelled', () => {
  const s = state({ category: 'Laptops', budget_max: 70000, budget_stretch: 80000 });
  const list = allowedProducts(s, catalog);
  assert.ok(list.every((p) => p.price <= 80000));
  const over = list.find((p) => p.price > 70000);
  if (over) assert.equal(overBudgetBy(s, over.price), over.price - 70000);
  assert.equal(overBudgetBy(s, 60000), null);
});

test('brand exclusion removes the brand, not the category', () => {
  const list = allowedProducts(state({ category: 'Audio', brands_exclude: ['Sony'] }), catalog);
  assert.ok(list.length > 0);
  assert.ok(list.every((p) => p.brand !== 'Sony' && p.category === 'Audio'));
});

test('reply never names other stores or shows citations', () => {
  const out = sanitizeReply('The **Galaxy M17** is ₹12,999 on Amazon [1]. Flipkart has it too, see https://www.flipkart.com/x. It is also listed at Croma.');
  assert.ok(!/amazon|flipkart|croma|\[1\]|https?:/i.test(out), out);
  assert.match(out, /Galaxy M17/);
});

test('every product has the store fields, with at least two images', () => {
  for (const product of catalog.slice(0, 20)) {
    const p = withStoreDetails(product, null);
    assert.ok(p.stock.label && p.pickup.label && p.delivery.label && p.offers.length > 0);
    if (p.image) assert.ok(p.images.length >= 2);
    assert.equal(p.rating, null, 'no rating without real data');
  }
});

test('delivery and exchange demo services', () => {
  assert.equal(deliveryEstimate('560034').city, 'Bengaluru');
  assert.ok(deliveryEstimate('560034').days <= 2);
  assert.ok(deliveryEstimate('799001').days >= 3);
  const e = exchangeEstimate('iPhone 13');
  assert.ok(e.low > 0 && e.high > e.low);
});
