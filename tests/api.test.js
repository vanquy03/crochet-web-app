import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/security.js';

async function fixture(t, { file = false, production = false } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tiem-len-api-'));
  const filename = file ? path.join(directory, 'shop.sqlite') : ':memory:';
  const db = openDatabase(filename);
  db.prepare('INSERT INTO admins(email,password_hash) VALUES(?,?)').run(
    'owner@example.test',
    hashPassword('Test-only-password-123!'),
  );
  const app = createApp({ db, uploadDir: path.join(directory, 'uploads'), production });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    const resolved = path.resolve(directory),
      tempRoot = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(tempRoot) || !path.basename(resolved).startsWith('tiem-len-api-'))
      throw new Error('Unsafe temp cleanup');
    await rm(resolved, { recursive: true, force: true });
  });
  async function call(route, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(base + route, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { status: response.status, data, response };
  }
  const login = await call('/api/admin/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: 'Test-only-password-123!' },
  });
  assert.equal(login.status, 200);
  const headers = {
    Cookie: login.response.headers.get('set-cookie').split(';')[0],
    'X-CSRF-Token': login.data.csrfToken,
  };
  const admin = (route, options = {}) =>
    call('/api/admin' + route, { ...options, headers: { ...headers, ...options.headers } });
  const stock = async (number = 3) => {
    const list = await admin('/products');
    const p = list.data.find((p) => p.id === 1);
    const result = await admin('/products/1', { method: 'PUT', body: { ...p, stock: number } });
    assert.equal(result.status, 200);
    return result.data;
  };
  const orderBody = (quantity = 1) => ({
    name: 'Nguyễn Mai',
    phone: '0912345678',
    address: '12 Đường Hoa, Phường 1, TP Hồ Chí Minh',
    note: 'Giao giờ hành chính',
    paymentMethod: 'cod',
    expectedTotal: quantity * 35000 + 30000,
    items: [{ productId: 1, quantity }],
  });
  const place = (body, key = randomUUID()) =>
    call('/api/orders', { method: 'POST', body, headers: { 'Idempotency-Key': key } });
  return { db, filename, directory, call, admin, headers, stock, orderBody, place, base };
}

test('authentication, CSRF, same-origin and secure production cookies', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call('/api/admin/products')).status, 401);
  assert.equal(
    (
      await f.call('/api/admin/login', {
        method: 'POST',
        body: { email: 'owner@example.test', password: 'wrong-password' },
      })
    ).status,
    401,
  );
  const list = await f.admin('/products');
  assert.equal(
    (
      await f.call('/api/admin/products/1', {
        method: 'PUT',
        headers: { Cookie: f.headers.Cookie },
        body: { ...list.data.find((p) => p.id === 1), stock: 1 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.admin('/logout', {
        method: 'POST',
        body: {},
        headers: { Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  );
  await f.admin('/logout', { method: 'POST', body: {} });
  assert.equal((await f.admin('/session')).status, 401);
  const secure = await fixture(t, { production: true });
  const result = await secure.call('/api/admin/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: 'Test-only-password-123!' },
  });
  assert.match(result.response.headers.get('set-cookie'), /Secure/);
  assert.match(result.response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(result.response.headers.get('set-cookie'), /SameSite=Strict/);
});

test('catalog CRUD, archive and optimistic stock protection', async (t) => {
  const f = await fixture(t);
  const original = (await f.admin('/products')).data.find((p) => p.id === 1);
  assert.equal(original.stock, 0);
  const current = await f.stock(5);
  assert.equal(
    (await f.admin('/products/1', { method: 'PUT', body: { ...original, stock: 99 } })).status,
    409,
  );
  const create = await f.admin('/products', {
    method: 'POST',
    body: { ...current, id: undefined, name: "Len O'Reilly", stock: 2 },
  });
  assert.equal(create.status, 201);
  assert.equal(create.data.name, "Len O'Reilly");
  assert.equal(
    (await f.admin('/products', { method: 'POST', body: { ...current, price: -1 } })).status,
    400,
  );
  assert.equal(
    (
      await f.admin('/products', {
        method: 'POST',
        body: { ...current, imageUrl: 'javascript:alert(1)' },
      })
    ).status,
    400,
  );
  await f.admin('/products/' + create.data.id, { method: 'DELETE', body: {} });
  assert.equal((await f.call('/api/products/' + create.data.id)).status, 404);
  const hidden = (await f.admin('/products')).data.find((p) => p.id === create.data.id);
  assert.equal(hidden.active, false);
  assert.equal(
    (await f.admin('/products/' + hidden.id, { method: 'PUT', body: { ...hidden, active: true } }))
      .status,
    200,
  );
});

test('checkout computes prices, reserves stock and retries without duplicate orders', async (t) => {
  const f = await fixture(t);
  await f.stock(3);
  const body = { ...f.orderBody(2), total: 1, items: [{ productId: 1, quantity: 2, price: 1 }] };
  const key = randomUUID();
  const first = await f.place(body, key);
  assert.equal(first.status, 201);
  assert.equal(first.data.order.total, 100000);
  assert.equal(first.data.order.items[0].price, 35000);
  const replay = await f.place(body, key);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.order.id, first.data.order.id);
  assert.equal(replay.data.lookupToken, first.data.lookupToken);
  assert.equal(f.db.prepare('SELECT stock FROM products WHERE id=1').get().stock, 1);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM orders').get().n, 1);
  assert.equal((await f.place(f.orderBody(1), key)).status, 409);
  const lookup = await f.call('/api/orders/lookup', {
    method: 'POST',
    body: { id: first.data.order.id, token: first.data.lookupToken },
  });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.data.phone, undefined);
  assert.equal(lookup.data.address, undefined);
  assert.equal(
    (
      await f.call('/api/orders/lookup', {
        method: 'POST',
        body: { id: first.data.order.id, token: 'a'.repeat(64) },
      })
    ).status,
    404,
  );
});

test('invalid totals, duplicate items, insufficient stock and transaction rollback', async (t) => {
  const f = await fixture(t);
  await f.stock(2);
  assert.equal((await f.place({ ...f.orderBody(), expectedTotal: 1 })).status, 409);
  assert.equal((await f.place(f.orderBody(3))).status, 409);
  assert.equal(
    (
      await f.place({
        ...f.orderBody(),
        items: [
          { productId: 1, quantity: 1 },
          { productId: 1, quantity: 1 },
        ],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.place({
        ...f.orderBody(),
        items: [
          { productId: 1, quantity: 1 },
          { productId: 999, quantity: 1 },
        ],
      })
    ).status,
    409,
  );
  assert.equal(f.db.prepare('SELECT stock FROM products WHERE id=1').get().stock, 2);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM orders').get().n, 0);
  assert.equal((await f.place({ ...f.orderBody(), phone: 'invalid' })).status, 400);
  assert.equal((await f.place({ ...f.orderBody(), paymentMethod: 'card' })).status, 400);
  const results = await Promise.all([f.place(f.orderBody(2)), f.place(f.orderBody(2))]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(f.db.prepare('SELECT stock FROM products WHERE id=1').get().stock, 0);
});

test('status transitions, cancellation restores stock exactly once and payment rules', async (t) => {
  const f = await fixture(t);
  await f.stock(3);
  const placed = await f.place(f.orderBody(2)),
    id = placed.data.order.id;
  assert.equal(
    (await f.admin('/orders/' + id, { method: 'PATCH', body: { status: 'completed', paid: true } }))
      .status,
    409,
  );
  assert.equal(
    (
      await f.admin('/orders/' + id, {
        method: 'PATCH',
        body: { status: 'cancelled', paid: false },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.admin('/orders/' + id, {
        method: 'PATCH',
        body: { status: 'cancelled', paid: false },
      })
    ).status,
    200,
  );
  assert.equal(f.db.prepare('SELECT stock FROM products WHERE id=1').get().stock, 3);
  assert.equal(
    (
      await f.admin('/orders/' + id, {
        method: 'PATCH',
        body: { status: 'confirmed', paid: false },
      })
    ).status,
    409,
  );
  const second = await f.place(f.orderBody()),
    id2 = second.data.order.id;
  for (const status of ['confirmed', 'shipping'])
    assert.equal(
      (await f.admin('/orders/' + id2, { method: 'PATCH', body: { status, paid: false } })).status,
      200,
    );
  assert.equal(
    (
      await f.admin('/orders/' + id2, {
        method: 'PATCH',
        body: { status: 'cancelled', paid: false },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.admin('/orders/' + id2, {
        method: 'PATCH',
        body: { status: 'completed', paid: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.admin('/orders/' + id2, {
        method: 'PATCH',
        body: { status: 'completed', paid: true },
      })
    ).status,
    200,
  );
  assert.equal((await f.admin('/dashboard')).data.revenue, 65000);
  assert.equal((await f.admin('/orders')).data.total, 2);
});

test('database persists orders after reopening and database settings affect checkout', async (t) => {
  const f = await fixture(t, { file: true });
  await f.stock(4);
  const settings = (await f.call('/api/settings')).data;
  assert.equal(
    (
      await f.admin('/settings', {
        method: 'PUT',
        body: { ...settings, shippingFee: 15000, freeShippingThreshold: 50000 },
      })
    ).status,
    200,
  );
  const placed = await f.place({ ...f.orderBody(2), expectedTotal: 70000 });
  assert.equal(placed.status, 201);
  assert.equal(placed.data.order.shipping_fee, 0);
  const second = openDatabase(f.filename);
  assert.equal(
    second.prepare('SELECT total FROM orders WHERE id=?').get(placed.data.order.id).total,
    70000,
  );
  assert.equal(second.prepare('SELECT stock FROM products WHERE id=1').get().stock, 2);
  second.close();
});

test('password change revokes sessions and image upload validates file data', async (t) => {
  const f = await fixture(t);
  const form = new FormData();
  form.append(
    'image',
    new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/png' }),
    'fake.png',
  );
  const invalid = await fetch(f.base + '/api/admin/uploads', {
    method: 'POST',
    headers: f.headers,
    body: form,
  });
  assert.equal(invalid.status, 400);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4K0AAAAASUVORK5CYII=',
    'base64',
  );
  const valid = new FormData();
  valid.append('image', new Blob([png], { type: 'image/png' }), 'image.png');
  const uploaded = await fetch(f.base + '/api/admin/uploads', {
    method: 'POST',
    headers: f.headers,
    body: valid,
  });
  assert.equal(uploaded.status, 201);
  const image = await uploaded.json();
  assert.match(image.imageUrl, /^\/uploads\/[a-f0-9-]+\.png$/);
  assert.equal((await fetch(f.base + image.imageUrl)).status, 200);
  assert.equal(
    (
      await f.admin('/password', {
        method: 'PUT',
        body: { currentPassword: 'wrong', password: 'new-test-password-123' },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.admin('/password', {
        method: 'PUT',
        body: { currentPassword: 'Test-only-password-123!', password: 'new-test-password-123' },
      })
    ).status,
    200,
  );
  assert.equal((await f.admin('/session')).status, 401);
  assert.equal(
    (
      await f.call('/api/admin/login', {
        method: 'POST',
        body: { email: 'owner@example.test', password: 'new-test-password-123' },
      })
    ).status,
    200,
  );
});

test('malformed and oversized JSON return client errors without exposing internals', async (t) => {
  const f = await fixture(t);
  const invalid = await fetch(f.base + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid',
  });
  assert.equal(invalid.status, 400);
  const large = await fetch(f.base + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: 'x'.repeat(40000) }),
  });
  assert.equal(large.status, 413);
  assert.equal((await large.json()).stack, undefined);
});
