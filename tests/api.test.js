import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';
import { spawnSync } from 'node:child_process';
import { hashPassword, verifyPassword } from '../server/security.js';

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
  const customerLogin = await call('/api/customer/register', {
    method: 'POST',
    body: {
      name: 'Nguyễn Mai',
      email: 'customer@example.test',
      password: 'Customer-password-123!',
    },
  });
  assert.equal(customerLogin.status, 201);
  const customerHeaders = {
    Cookie: customerLogin.response.headers.get('set-cookie').split(';')[0],
    'X-CSRF-Token': customerLogin.data.csrfToken,
  };
  const customerId = customerLogin.data.customer.id;
  const customer = (route, options = {}) =>
    call('/api/customer' + route, {
      ...options,
      headers: { ...customerHeaders, ...options.headers },
    });
  const place = (body, key = randomUUID()) =>
    call('/api/orders', {
      method: 'POST',
      body,
      headers: { ...customerHeaders, 'Idempotency-Key': key },
    });
  return {
    db,
    filename,
    directory,
    call,
    admin,
    headers,
    stock,
    orderBody,
    place,
    base,
    customer,
    customerHeaders,
    customerId,
  };
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
  assert.equal(replay.data.lookupToken, undefined);
  assert.equal(f.db.prepare('SELECT stock FROM products WHERE id=1').get().stock, 1);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM orders').get().n, 1);
  assert.equal((await f.place(f.orderBody(1), key)).status, 409);
  const own = await f.customer('/orders/' + first.data.order.id);
  assert.equal(own.status, 200);
  assert.equal(own.data.phone, body.phone);
  assert.equal((await f.customer('/orders')).data.total, 1);
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

test('customer registration, sessions, CSRF and separation from admin access', async (t) => {
  const f = await fixture(t, { production: true });
  assert.equal((await f.call('/api/customer/session')).data.customer, null);
  assert.equal((await f.call('/api/customer/orders')).status, 401);
  assert.equal((await f.call('/api/orders', { method: 'POST', body: f.orderBody() })).status, 401);
  assert.equal((await f.call('/api/customer/orders', { headers: f.headers })).status, 401);
  assert.equal((await f.call('/api/admin/orders', { headers: f.customerHeaders })).status, 401);
  const registerBody = {
    name: 'Khách mới',
    email: 'SECOND@EXAMPLE.TEST',
    password: 'Customer-password-123!',
  };
  const created = await f.call('/api/customer/register', { method: 'POST', body: registerBody });
  assert.equal(created.status, 201);
  assert.equal(created.data.customer.email, 'second@example.test');
  assert.equal(created.data.customer.password_hash, undefined);
  assert.match(created.response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(created.response.headers.get('set-cookie'), /SameSite=Strict/);
  assert.match(created.response.headers.get('set-cookie'), /Secure/);
  const stored = f.db.prepare('SELECT * FROM customers WHERE email=?').get('second@example.test');
  assert.notEqual(stored.password_hash, registerBody.password);
  assert.equal(
    (await f.call('/api/customer/register', { method: 'POST', body: registerBody })).status,
    409,
  );
  assert.equal(
    (
      await f.call('/api/customer/register', {
        method: 'POST',
        body: { ...registerBody, email: 'bad' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call('/api/customer/register', {
        method: 'POST',
        body: { ...registerBody, email: 'third@example.test', password: 'short' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call('/api/customer/login', {
        method: 'POST',
        body: { email: registerBody.email, password: 'wrong' },
      })
    ).status,
    401,
  );
  const logged = await f.call('/api/customer/login', { method: 'POST', body: registerBody });
  assert.equal(logged.status, 200);
  const cookie = logged.response.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (
      await f.call('/api/customer/logout', {
        method: 'POST',
        body: {},
        headers: { Cookie: cookie },
      })
    ).status,
    403,
  );
  const session = await f.call('/api/customer/session', { headers: { Cookie: cookie } });
  assert.equal(session.data.customer.id, stored.id);
  assert.equal(
    (
      await f.call('/api/customer/logout', {
        method: 'POST',
        body: {},
        headers: {
          Cookie: cookie,
          'X-CSRF-Token': logged.data.csrfToken,
          Origin: 'https://other.test',
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call('/api/customer/logout', {
        method: 'POST',
        body: {},
        headers: { Cookie: cookie, 'X-CSRF-Token': logged.data.csrfToken },
      })
    ).status,
    200,
  );
  assert.equal((await f.call('/api/customer/orders', { headers: { Cookie: cookie } })).status, 401);
  f.db.prepare('UPDATE customer_sessions SET expires_at=0').run();
  assert.equal((await f.customer('/orders')).status, 401);
  assert.equal((await f.admin('/orders')).status, 200);
});

test('customers can only read their own orders and cannot steal idempotency keys', async (t) => {
  const f = await fixture(t);
  await f.stock(5);
  const key = randomUUID();
  const placed = await f.place({ ...f.orderBody(), customerId: 9999 }, key);
  assert.equal(placed.status, 201);
  assert.equal(placed.data.order.customer_id, f.customerId);
  assert.equal(placed.data.lookupToken, undefined);
  const other = await f.call('/api/customer/register', {
    method: 'POST',
    body: { name: 'Khách khác', email: 'other@example.test', password: 'Other-password-123!' },
  });
  const otherHeaders = {
    Cookie: other.response.headers.get('set-cookie').split(';')[0],
    'X-CSRF-Token': other.data.csrfToken,
  };
  assert.equal(
    (await f.call('/api/customer/orders/' + placed.data.order.id, { headers: otherHeaders }))
      .status,
    404,
  );
  const otherList = await f.call('/api/customer/orders?customer_id=' + f.customerId, {
    headers: otherHeaders,
  });
  assert.equal(otherList.data.total, 0);
  assert.deepEqual(otherList.data.orders, []);
  const stolen = await f.call('/api/orders', {
    method: 'POST',
    body: f.orderBody(),
    headers: { ...otherHeaders, 'Idempotency-Key': key },
  });
  assert.equal(stolen.status, 409);
  assert.equal(stolen.data.order, undefined);
  assert.equal((await f.place(f.orderBody(), key)).status, 200);
  assert.equal(
    (
      await f.call('/api/orders', {
        method: 'POST',
        body: f.orderBody(),
        headers: { Cookie: f.customerHeaders.Cookie, 'Idempotency-Key': randomUUID() },
      })
    ).status,
    403,
  );
  f.db.prepare('UPDATE orders SET customer_id=NULL WHERE id=?').run(placed.data.order.id);
  assert.equal((await f.customer('/orders')).data.total, 0);
  assert.equal((await f.customer('/orders/' + placed.data.order.id)).status, 404);
  assert.equal((await f.admin('/orders')).data.total, 1);
  assert.equal((await f.call('/api/orders/lookup', { method: 'POST', body: {} })).status, 404);
});

test('customer order history is paginated and reflects admin status updates', async (t) => {
  const f = await fixture(t);
  await f.stock(20);
  let id;
  for (let i = 0; i < 11; i++) {
    const placed = await f.place(f.orderBody());
    assert.equal(placed.status, 201);
    id = placed.data.order.id;
  }
  const first = (await f.customer('/orders')).data;
  const second = (await f.customer('/orders?page=2')).data;
  assert.equal(first.total, 11);
  assert.equal(first.orders.length, 10);
  assert.equal(second.orders.length, 1);
  assert.equal(new Set([...first.orders, ...second.orders].map((o) => o.id)).size, 11);
  assert.equal((await f.customer('/orders?page=0')).status, 400);
  await f.admin('/orders/' + id, { method: 'PATCH', body: { status: 'confirmed', paid: false } });
  assert.equal((await f.customer('/orders/' + id)).data.status, 'confirmed');
});

test('v1 migration preserves existing orders without assigning them to a new customer', async (t) => {
  const f = await fixture(t);
  const filename = path.join(f.directory, 'legacy.sqlite');
  const legacy = new DatabaseSync(filename);
  legacy.exec(
    await readFile(new URL('../server/migrations/001-initial.sql', import.meta.url), 'utf8'),
  );
  legacy
    .prepare(
      'INSERT INTO orders(id,lookup_hash,idempotency_key,request_hash,name,phone,address,subtotal,shipping_fee,total) VALUES(?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'TL-legacy',
      'a'.repeat(64),
      randomUUID(),
      'b'.repeat(64),
      'Khách cũ',
      '0900000000',
      'Địa chỉ thử nghiệm cũ',
      35000,
      30000,
      65000,
    );
  legacy.close();
  const migrated = openDatabase(filename);
  assert.equal(migrated.prepare('PRAGMA user_version').get().user_version, 4);
  const order = migrated.prepare('SELECT * FROM orders WHERE id=?').get('TL-legacy');
  assert.equal(order.total, 65000);
  assert.equal(order.customer_id, null);
  migrated.close();
  const reopened = openDatabase(filename);
  assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM customers').get().n, 0);
  reopened.close();
});

test('seed customer owns test orders and repeated seeding preserves edited data', async (t) => {
  const f = await fixture(t);
  const filename = path.join(f.directory, 'shop.sqlite');
  const run = () =>
    spawnSync(process.execPath, ['scripts/seed.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', DATA_DIR: f.directory },
    });
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  const db = openDatabase(filename);
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE email=?').get('user@tiemlen.test');
    assert.ok(verifyPassword('UserTest123!', customer.password_hash));
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM orders WHERE customer_id=?').get(customer.id).n,
      5,
    );
    assert.equal(db.prepare('SELECT stock FROM products WHERE id=10001').get().stock, 42);
    const oldInventory = JSON.stringify(
      db.prepare('SELECT * FROM inventory_log ORDER BY id').all(),
    );
    db.prepare('UPDATE customers SET password_hash=? WHERE id=?').run(
      hashPassword('NewCustomer123!'),
      customer.id,
    );
    db.prepare('UPDATE products SET name=? WHERE id=10001').run('Sản phẩm đã sửa');
    result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 5);
    assert.ok(
      verifyPassword(
        'NewCustomer123!',
        db.prepare('SELECT password_hash FROM customers WHERE id=?').get(customer.id).password_hash,
      ),
    );
    assert.equal(
      db.prepare('SELECT name FROM products WHERE id=10001').get().name,
      'Sản phẩm đã sửa',
    );
    assert.equal(
      JSON.stringify(db.prepare('SELECT * FROM inventory_log ORDER BY id').all()),
      oldInventory,
    );
    const forbidden = spawnSync(process.execPath, ['scripts/seed.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', DATA_DIR: f.directory },
    });
    assert.equal(forbidden.status, 1);
  } finally {
    db.close();
  }
});

test('customer authentication limits repeated failed login attempts', async (t) => {
  const f = await fixture(t);
  let result;
  for (let i = 0; i < 20; i++)
    result = await f.call('/api/customer/login', {
      method: 'POST',
      body: { email: 'customer@example.test', password: 'wrong' },
    });
  assert.equal(result.status, 429);
});

test('community drafts stay private, ownership and versions protect editing', async (t) => {
  const f = await fixture(t),
    body = {
      title: 'Một chiều đan len',
      content: 'Mình ngồi bên cửa sổ và đan thêm một hàng len thật chậm.',
      category: 'slow',
      status: 'draft',
    };
  const member = (route, options = {}) =>
    f.call('/api/community' + route, {
      ...options,
      headers: { ...f.customerHeaders, ...options.headers },
    });
  assert.equal((await f.call('/api/community/posts', { method: 'POST', body })).status, 401);
  assert.equal(
    (await member('/posts', { method: 'POST', body, headers: { 'X-CSRF-Token': 'bad' } })).status,
    403,
  );
  const draft = await member('/posts', { method: 'POST', body });
  assert.equal(draft.status, 201);
  const id = draft.data.id;
  assert.equal((await f.call('/api/community/posts')).data.total, 0);
  assert.equal((await f.call('/api/community/posts/' + id)).status, 404);
  assert.equal((await f.admin('/community/posts')).data.total, 0);
  assert.equal((await f.customer('/posts')).data.total, 1);
  const second = await f.call('/api/customer/register', {
    method: 'POST',
    body: {
      name: 'Bạn đan len',
      email: 'otherblog@example.test',
      password: 'Other-blog-password123!',
    },
  });
  const otherHeaders = {
    Cookie: second.response.headers.get('set-cookie').split(';')[0],
    'X-CSRF-Token': second.data.csrfToken,
  };
  assert.equal((await f.call('/api/community/posts/' + id, { headers: otherHeaders })).status, 404);
  assert.equal(
    (
      await f.call('/api/community/posts/' + id, {
        method: 'PUT',
        headers: otherHeaders,
        body: { ...body, version: 0 },
      })
    ).status,
    404,
  );
  const published = await member('/posts/' + id, {
    method: 'PUT',
    body: { ...body, status: 'published', version: 0 },
  });
  assert.equal(published.status, 200);
  assert.equal(
    (
      await member('/posts/' + id, {
        method: 'PUT',
        body: { ...body, status: 'published', version: 0 },
      })
    ).status,
    409,
  );
  const feed = (await f.call('/api/community/posts?category=slow&q=đan')).data;
  assert.equal(feed.total, 1);
  assert.equal(feed.posts[0].author.email, undefined);
  assert.equal(feed.posts[0].content, undefined);
  assert.equal((await f.call('/api/community/posts/' + id)).data.content, body.content);
  assert.equal(
    (
      await f.call('/api/community/posts/' + id, {
        method: 'DELETE',
        headers: otherHeaders,
        body: {},
      })
    ).status,
    404,
  );
  assert.equal((await member('/posts/' + id, { method: 'DELETE', body: {} })).status, 200);
  assert.equal((await member('/posts/' + id)).status, 404);
});
test('community hearts are idempotent, comments owned and moderation guarded', async (t) => {
  const f = await fixture(t);
  const member = (route, options = {}) =>
    f.call('/api/community' + route, {
      ...options,
      headers: { ...f.customerHeaders, ...options.headers },
    });
  const post = await member('/posts', {
    method: 'POST',
    body: {
      title: 'Một mũi len nhỏ',
      content: 'Một mũi đan mới mang lại niềm vui giản dị cho mình hôm nay.',
      category: 'journey',
      status: 'published',
    },
  });
  const id = post.data.id;
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await member('/posts/' + id + '/like', { method: 'PUT', body: { liked: true } })).data
        .likesCount,
      1,
    );
  assert.equal(
    (await member('/posts/' + id + '/like', { method: 'PUT', body: { liked: false } })).data
      .likesCount,
    0,
  );
  const comment = await member('/posts/' + id + '/comments', {
    method: 'POST',
    body: { content: 'Mình cũng thích đan len bên cửa sổ ♡' },
  });
  assert.equal(comment.status, 201);
  const comments = await member('/posts/' + id + '/comments');
  assert.equal(comments.data.total, 1);
  assert.equal(comments.data.comments[0].mine, true);
  assert.equal(comments.data.comments[0].author.email, undefined);
  assert.equal(
    (await f.call('/api/admin/community/posts', { headers: f.customerHeaders })).status,
    401,
  );
  assert.equal(
    (
      await f.admin('/community/posts/' + id, {
        method: 'PATCH',
        body: { hidden: true, version: 0 },
      })
    ).status,
    200,
  );
  assert.equal((await f.call('/api/community/posts/' + id)).status, 404);
  assert.equal(
    (await member('/posts/' + id + '/like', { method: 'PUT', body: { liked: true } })).status,
    404,
  );
  assert.equal(
    (
      await member('/posts/' + id, {
        method: 'PUT',
        body: { ...post.data, status: 'published', version: 1 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.admin('/community/posts/' + id + '/comments/' + comment.data.id, {
        method: 'DELETE',
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.admin('/community/posts/' + id, {
        method: 'PATCH',
        body: { hidden: false, version: 1 },
      })
    ).status,
    200,
  );
  assert.equal((await member('/posts/' + id + '/comments')).data.total, 0);
  const own = await member('/posts/' + id + '/comments', {
    method: 'POST',
    body: { content: 'Lời chia sẻ thứ hai' },
  });
  assert.equal(
    (await member('/posts/' + id + '/comments/' + own.data.id, { method: 'DELETE', body: {} }))
      .status,
    200,
  );
  const form = new FormData();
  form.append('image', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'bad.svg');
  const upload = await fetch(f.base + '/api/community/uploads', {
    method: 'POST',
    headers: f.customerHeaders,
    body: form,
  });
  assert.equal(upload.status, 400);
});

test('product galleries persist order and exactly one primary image, with safe media URLs', async (t) => {
  const f = await fixture(t);
  const product =
    (await f.stock()).value || (await f.admin('/products')).data.find((p) => p.id === 1);
  const media = [
    { type: 'image', url: 'https://example.com/first.jpg', primary: false },
    { type: 'video', url: 'https://example.com/demo.mp4', primary: false },
    { type: 'image', url: 'https://example.com/main.jpg', primary: true },
  ];
  const saved = await f.admin('/products/1', { method: 'PUT', body: { ...product, media } });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.imageUrl, media[2].url);
  assert.deepEqual((await f.call('/api/products/1')).data.media, media);
  for (const invalid of [
    media.map((item) => ({ ...item, primary: false })),
    media.map((item) => ({ ...item, primary: item.type === 'image' })),
    [{ type: 'video', url: media[1].url, primary: true }],
    [{ type: 'image', url: 'javascript:alert(1)', primary: true }],
    Array.from({ length: 13 }, (_, i) => ({
      type: 'image',
      url: `https://example.com/${i}.jpg`,
      primary: i === 0,
    })),
  ]) {
    assert.equal(
      (await f.admin('/products/1', { method: 'PUT', body: { ...saved.data, media: invalid } }))
        .status,
      400,
    );
  }
  const legacy = { ...saved.data, imageUrl: 'https://example.com/legacy.jpg' };
  delete legacy.media;
  const updated = await f.admin('/products/1', { method: 'PUT', body: legacy });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.data.media, [{ type: 'image', url: legacy.imageUrl, primary: true }]);
});

test('admin media upload accepts video signatures, rejects forged files and requires authentication', async (t) => {
  const f = await fixture(t);
  async function upload(bytes, cookie = f.headers) {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'video/mp4' }), 'demo.mp4');
    return fetch(f.base + '/api/admin/media', { method: 'POST', headers: cookie, body: form });
  }
  assert.equal((await upload(Buffer.from('not a video'))).status, 400);
  assert.equal((await upload(Buffer.from('not a video'), {})).status, 401);
  const response = await upload(
    Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypisom'), 0, 0, 0, 0, ...Buffer.from('isommp42')]),
  );
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.type, 'video');
  assert.match(result.url, /^\/uploads\/[a-f0-9-]+\.mp4$/);
  const served = await fetch(f.base + result.url, { headers: { Range: 'bytes=0-11' } });
  assert.equal(served.status, 206);
});

test('v3 migration preserves a products existing primary image', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tiem-len-media-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'legacy.sqlite');
  const legacy = new DatabaseSync(filename);
  for (const name of ['001-initial.sql', '002-customers.sql', '003-community.sql'])
    legacy.exec(
      readFileSync(new URL('../server/migrations/' + name, import.meta.url), 'utf8').replace(
        /^\uFEFF/,
        '',
      ),
    );
  legacy
    .prepare('INSERT INTO products(name,type,price,image_url) VALUES(?,?,?,?)')
    .run('Legacy yarn', 'cotton', 35000, 'https://example.com/old.jpg');
  legacy.close();
  const migrated = openDatabase(filename);
  t.after(() => migrated.close());
  assert.equal(migrated.prepare('PRAGMA user_version').get().user_version, 4);
  assert.equal(
    migrated.prepare('SELECT image_url FROM products').get().image_url,
    'https://example.com/old.jpg',
  );
});

test('unfinished drafts can be saved privately but publication requires a title and content', async (t) => {
  const f = await fixture(t);
  const request = (route, options = {}) =>
    f.call('/api/community' + route, { ...options, headers: f.customerHeaders });
  const input = {
    title: '',
    content: '',
    excerpt: '',
    category: 'journey',
    coverUrl: '',
    status: 'draft',
  };
  const created = await request('/posts', { method: 'POST', body: input });
  assert.equal(created.status, 201);
  assert.equal(created.data.title, 'Câu chuyện chưa đặt tên');
  assert.equal(created.data.content, '');
  assert.equal((await f.call('/api/community/posts/' + created.data.id)).status, 404);
  const invalid = await request('/posts/' + created.data.id, {
    method: 'PUT',
    body: { ...input, status: 'published', version: created.data.version },
  });
  assert.equal(invalid.status, 400);
  const published = await request('/posts/' + created.data.id, {
    method: 'PUT',
    body: {
      ...input,
      title: 'Câu chuyện nhỏ',
      content: 'Một món đồ tự tay làm dành tặng người mình yêu thương.',
      status: 'published',
      version: created.data.version,
    },
  });
  assert.equal(published.status, 200);
  assert.equal((await f.call('/api/community/posts/' + created.data.id)).status, 200);
});
