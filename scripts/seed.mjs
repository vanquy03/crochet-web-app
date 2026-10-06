import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDatabase, transaction, getSettings } from '../server/database.js';
import { hashPassword } from '../server/security.js';
import { productInput } from '../server/validation.js';
import { placeOrder, updateOrder } from '../server/services/orders.js';

if (process.env.NODE_ENV === 'production') {
  console.error('db:seed chỉ dùng cho development/test, không chạy trong production.');
  process.exit(1);
}
const seed = JSON.parse(readFileSync(new URL('./seed-data.json', import.meta.url), 'utf8'));
const root = fileURLToPath(new URL('../', import.meta.url));
const filename = path.join(
  path.resolve(process.env.DATA_DIR || path.join(root, 'data')),
  'shop.sqlite',
);
const db = openDatabase(filename);
try {
  let adminCreated = false;
  let customerCreated = false;
  let seedCustomerId;
  transaction(db, () => {
    let customer = db.prepare('SELECT id FROM customers WHERE email=?').get(seed.customer.email);
    if (!customer) {
      const result = db
        .prepare('INSERT INTO customers(name,email,password_hash) VALUES(?,?,?)')
        .run(seed.customer.name, seed.customer.email, hashPassword(seed.customer.password));
      customer = { id: Number(result.lastInsertRowid) };
      customerCreated = true;
    }
    seedCustomerId = customer.id;
    if (!db.prepare('SELECT id FROM admins WHERE email=?').get(seed.admin.email)) {
      db.prepare('INSERT INTO admins(email,password_hash) VALUES(?,?)').run(
        seed.admin.email,
        hashPassword(seed.admin.password),
      );
      adminCreated = true;
    }
    for (const product of seed.products) {
      // Giữ nguyên sản phẩm đã tồn tại, kể cả tồn kho đã thay đổi sau khi đặt đơn.
      if (db.prepare('SELECT id FROM products WHERE id=?').get(product.id)) continue;
      const values = productInput({ ...product, active: product.active ?? true });
      db.prepare(
        'INSERT INTO products(id,name,type,description,price,stock,color,background,tag,image_url,active,kind,media) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ).run(product.id, ...values);
      db.prepare('INSERT INTO inventory_log(product_id,delta,reason) VALUES(?,?,?)').run(
        product.id,
        product.stock,
        'test_seed',
      );
    }
  });
  console.log('Database:', filename);
  console.log('Email admin test:', seed.admin.email);
  console.log(
    adminCreated
      ? 'Mật khẩu admin test: ' + seed.admin.password
      : 'Admin test đã tồn tại; giữ nguyên mật khẩu hiện tại.',
  );
  console.log('Email khách test:', seed.customer.email);
  console.log(
    customerCreated
      ? 'Mật khẩu khách test: ' + seed.customer.password
      : 'Khách test đã tồn tại; giữ nguyên mật khẩu.',
  );
  for (const fixture of seed.orders) {
    // Chỉ gán các đơn mẫu xác định trong file seed; không gán đơn thật/cũ theo điện thoại.
    db.prepare(
      'UPDATE orders SET customer_id=? WHERE idempotency_key=? AND customer_id IS NULL',
    ).run(seedCustomerId, fixture.key);
    let order = db.prepare('SELECT id,status FROM orders WHERE idempotency_key=?').get(fixture.key);
    if (!order) {
      const subtotal = fixture.items.reduce((sum, item) => {
        const product = db.prepare('SELECT price FROM products WHERE id=?').get(item.productId);
        return sum + product.price * item.quantity;
      }, 0);
      const settings = getSettings(db);
      const fee =
        settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold
          ? 0
          : settings.shippingFee;
      const result = placeOrder(
        db,
        {
          ...fixture,
          paymentMethod: 'cod',
          expectedTotal: subtotal + fee,
        },
        fixture.key,
        seedCustomerId,
      );
      order = result.order;
      const steps = {
        pending: [],
        confirmed: ['confirmed'],
        shipping: ['confirmed', 'shipping'],
        completed: ['confirmed', 'shipping', 'completed'],
        cancelled: ['cancelled'],
      };
      for (const status of steps[fixture.status])
        order = updateOrder(db, order.id, status, status === 'completed');
    }
    console.log('Đơn test:', order.id, '|', order.status);
  }
  seedCommunity(seedCustomerId);
  console.log('Seed hoàn tất. Chạy lại không tạo trùng, không reset dữ liệu đã tồn tại.');
} catch (error) {
  console.error('Seed thất bại:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
}

function seedCommunity(seedCustomerId) {
  transaction(db, () => {
    for (const post of seed.posts || []) {
      if (db.prepare('SELECT id FROM posts WHERE seed_key=?').get(post.key)) continue;
      db.prepare(
        "INSERT INTO posts(author_id,title,excerpt,content,category,status,seed_key,published_at) VALUES(?,?,?,?,?,'published',?,CURRENT_TIMESTAMP)",
      ).run(seedCustomerId, post.title, post.excerpt, post.content, post.category, post.key);
    }
  });
}
