import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Kiểm tra các module khởi tạo cùng nhau sau khi tách file, không cần thư viện DOM.
const elements = new Map();
function element(id) {
  if (!elements.has(id))
    elements.set(id, {
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      dataset: {},
      children: [],
      append(child) {
        this.children.push(child);
      },
      insertBefore(child) {
        this.children.push(child);
      },
      insertAdjacentHTML(position, html) {
        this.innerHTML += html;
      },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      reportValidity() {
        return true;
      },
      firstChild: null,
    });
  return elements.get(id);
}
const filterButtons = ['all', 'cotton', 'milk', 'tools'].map((filter) => ({
  dataset: { filter },
  classList: { toggle() {} },
  setAttribute() {},
}));
element('sort').value = 'default';
globalThis.document = {
  getElementById: element,
  querySelectorAll(selector) {
    return selector === '[data-filter]' ? filterButtons : [];
  },
  querySelector() {
    return { lastChild: {} };
  },
  createElement() {
    return { dataset: {}, click() {} };
  },
};
globalThis.localStorage = { getItem: () => null, setItem() {} };
await import('../src/js/main.js');
const cart = await import('../src/js/features/cart.js');
const catalog = await import('../src/js/features/catalog.js');
const order = await import('../src/js/features/order.js');
const artwork = await import('../src/js/components/artwork.js');
const { products } = await import('../src/js/data/products.js');
function reset() {
  for (const id of Object.keys(cart.cartItems)) delete cart.cartItems[id];
  cart.renderCart();
  element('search').value = '';
  element('sort').value = 'default';
  catalog.setFilter('all');
  catalog.renderCatalog();
}

test('entry point initializes catalog, controls and contact placeholders', async () => {
  assert.equal((element('products').innerHTML.match(/<article>/g) || []).length, 6);
  assert.equal(typeof element('search').oninput, 'function');
  assert.equal(typeof element('openCart').onclick, 'function');
  assert.equal(element('contactLinks').children.length, 0);
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  for (const id of elements.keys())
    assert.ok(html.includes(`id="${id}"`), `Missing static element ${id}`);
});

test('search, filters and price sort still work across modules', () => {
  reset();
  filterButtons[3].onclick();
  assert.equal((element('products').innerHTML.match(/<article>/g) || []).length, 1);
  catalog.setFilter('all');
  element('search').value = 'Hồng';
  element('search').oninput();
  assert.ok(element('products').innerHTML.includes('Hồng phấn'));
  assert.equal((element('products').innerHTML.match(/<article>/g) || []).length, 1);
  element('search').value = '';
  element('sort').value = 'asc';
  element('sort').onchange();
  assert.ok(
    element('products').innerHTML.indexOf('data-detail="2"') <
      element('products').innerHTML.indexOf('data-detail="1"'),
  );
});

test('product detail and cart totals survive module separation', () => {
  reset();
  catalog.showProductDetail(2);
  assert.ok(element('detailContent').innerHTML.includes('TL-002'));
  assert.equal(element('detail').open, true);
  cart.addToCart(1, 2);
  cart.addToCart(2, 1);
  assert.equal(element('count').textContent, 3);
  assert.equal(element('total').textContent, '95.000 ₫');
  element('buyerName').value = 'Mai';
  element('buyerNote').value = 'Hỏi màu thực tế';
  assert.ok(order.createOrderText().includes('Tên: Mai'));
  assert.ok(order.createOrderText().includes('TL-001'));
});

test('cart bounds and empty-cart actions remain valid', () => {
  reset();
  cart.addToCart(1, 101);
  assert.equal(cart.cartItems[1], 99);
  cart.addToCart(999, 1);
  cart.addToCart(2, -1);
  assert.equal(cart.cartItems[999], undefined);
  assert.equal(cart.cartItems[2], undefined);
  reset();
  assert.equal(element('copy').disabled, true);
  assert.equal(element('download').disabled, true);
});

test('SVG identifiers are unique between products and detail view', () => {
  const markup =
    products.map((p) => artwork.renderProductArt(p)).join('') +
    artwork.renderProductArt(products[0], 'detail');
  const ids = [...markup.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
});
