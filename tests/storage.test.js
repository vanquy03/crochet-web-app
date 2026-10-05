import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCart, saveCart } from '../src/js/utils/storage.js';
const products = [{ id: 1 }, { id: 2 }, { id: 3 }];
test('restores known products with valid quantities only', () => {
  const storage = { getItem: () => JSON.stringify({ 1: 2, 2: -1, 3: 100, 999: 5 }) };
  assert.deepEqual(loadCart(products, storage), { 1: 2 });
});
test('handles corrupted and unavailable storage', () => {
  assert.deepEqual(loadCart(products, { getItem: () => '{broken' }), {});
  assert.deepEqual(
    loadCart(products, {
      getItem() {
        throw new Error('blocked');
      },
    }),
    {},
  );
  assert.doesNotThrow(() =>
    saveCart(
      { 1: 2 },
      {
        setItem() {
          throw new Error('blocked');
        },
      },
    ),
  );
});
test('writes cart data without buyer information', () => {
  let saved;
  saveCart(
    { 1: 3 },
    {
      setItem(key, value) {
        saved = { key, value };
      },
    },
  );
  assert.equal(saved.key, 'tiemlen-cart');
  assert.deepEqual(JSON.parse(saved.value), { 1: 3 });
});
