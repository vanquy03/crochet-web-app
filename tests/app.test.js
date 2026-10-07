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
      querySelector() {
        return null;
      },
      reset() {},
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
const { products: samples } = await import('../src/js/data/sample-products.js');
globalThis.fetch = async (url) => ({
  ok: true,
  json: async () =>
    url.endsWith('/customer/session')
      ? {
          customer: { id: 77, name: 'Nguyễn Mai', email: 'customer@example.test' },
          csrfToken: 'test-csrf',
        }
      : url.endsWith('/products')
        ? samples.map((p) => ({ ...p, stock: 99 }))
        : { name: 'Tiệm Len', demo: true, shippingFee: 30000, freeShippingThreshold: 500000 },
});
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

test('entry point initializes showcase catalog and controls', async () => {
  assert.equal((element('products').innerHTML.match(/<article>/g) || []).length, 6);
  assert.equal(typeof element('search').oninput, 'function');
  assert.ok(!element('products').innerHTML.includes('data-add'));
  assert.ok(!element('products').innerHTML.includes('Thêm vào giỏ'));
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('id="cart"'));
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

test('checkout retries reuse the key, preserve cart on error and show receipt on success', async () => {
  reset();
  const originalFetch = globalThis.fetch;
  const stored = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  const { initCheckout } = await import('../src/js/features/checkout.js');
  initCheckout();
  cart.addToCart(1, 1);
  element('buyerName').value = 'Nguyễn Mai';
  element('buyerPhone').value = '0912345678';
  element('buyerAddress').value = '12 Đường Hoa, Phường 1, TP Hồ Chí Minh';
  element('buyerNote').value = 'Giao giờ hành chính';
  const requests = [];
  globalThis.fetch = async (url, options) => {
    if (url === '/api/orders') {
      requests.push(options);
      if (requests.length === 1) throw new Error('Mất kết nối');
      // Sản phẩm thêm trong lúc gửi không được xóa khi đơn cũ thành công.
      cart.cartItems[2] = 1;
      return {
        ok: true,
        json: async () => ({
          order: { id: 'TL-test-order', total: 65000 },
        }),
      };
    }
    return originalFetch(url, options);
  };
  try {
    await element('buyerForm').onsubmit({ preventDefault() {} });
    assert.equal(cart.cartItems[1], 1);
    assert.equal(element('checkoutStatus').textContent, 'Mất kết nối');
    const cached = stored.get('tiemlen-pending-request');
    assert.ok(cached);
    assert.ok(!cached.includes('Nguyễn Mai'));
    // Mô phỏng khởi tạo lại phần checkout: khóa lấy từ sessionStorage.
    initCheckout();
    await element('buyerForm').onsubmit({ preventDefault() {} });
    assert.equal(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
    assert.equal(JSON.parse(requests[1].body).expectedTotal, 65000);
    assert.equal(cart.cartItems[1], undefined);
    assert.equal(cart.cartItems[2], 1);
    assert.ok(element('orderReceipt').innerHTML.includes('TL-test-order'));
    assert.ok(element('orderReceipt').innerHTML.includes('/account/'));
    assert.ok(!element('orderReceipt').innerHTML.includes('Mã tra cứu'));
    assert.equal(stored.get('tiemlen-pending-request'), undefined);
  } finally {
    globalThis.fetch = originalFetch;
    reset();
  }
});

test('product content is escaped before insertion in catalog and detail HTML', () => {
  reset();
  const original = products[0].name;
  try {
    products[0].name = '<img src=x onerror="alert(1)">';
    catalog.renderCatalog();
    assert.ok(!element('products').innerHTML.includes('<img src=x'));
    assert.ok(element('products').innerHTML.includes('&lt;img'));
    catalog.showProductDetail(products[0].id);
    assert.ok(!element('detailContent').innerHTML.includes('<img src=x'));
  } finally {
    products[0].name = original;
    reset();
  }
});

test('showcase detail links to contact instead of quantity, cart or checkout', async () => {
  reset();
  catalog.showProductDetail(1);
  const detail = element('detailContent').innerHTML;
  assert.ok(detail.includes('id="detailContact"'));
  assert.ok(detail.includes('href="/contact/"'));
  assert.ok(!detail.includes('detailQty'));
  assert.ok(!detail.includes('Thêm vào giỏ'));
  assert.ok(detail.includes('TL-001'));
  element('detailContact').onclick();
  assert.equal(element('detail').open, false);
});
