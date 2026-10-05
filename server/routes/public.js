import { getSettings, publicProduct } from '../database.js';
import { placeOrder, readOrder } from '../services/orders.js';
import { text, HttpError } from '../validation.js';
import { digest } from '../security.js';
export function registerPublicRoutes(app, { db, orderLimit }) {
  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  });
  app.get('/api/products', (req, res) =>
    res.json(
      db.prepare('SELECT * FROM products WHERE active=1 ORDER BY id DESC').all().map(publicProduct),
    ),
  );
  app.get('/api/products/:id', (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(req.params.id);
    if (!p) throw new HttpError(404, 'Sản phẩm không tồn tại.');
    res.json(publicProduct(p));
  });
  app.get('/api/settings', (req, res) => res.json(getSettings(db)));
  app.post('/api/orders', orderLimit, (req, res) => {
    const result = placeOrder(db, req.body, req.get('idempotency-key'));
    res.status(result.replay ? 200 : 201).json(result);
  });
  app.post('/api/orders/lookup', orderLimit, (req, res) => {
    const id = text(req.body.id, 'Mã đơn', 4, 100),
      token = text(req.body.token, 'Mã tra cứu', 64, 64);
    const row = db
      .prepare('SELECT id FROM orders WHERE id=? AND lookup_hash=?')
      .get(id, digest(token));
    if (!row) throw new HttpError(404, 'Mã đơn hoặc mã tra cứu không đúng.');
    const order = readOrder(db, id);
    // Tra cứu công khai không trả địa chỉ, điện thoại hoặc tên người nhận.
    res.json({
      id: order.id,
      status: order.status,
      paid: Boolean(order.paid),
      subtotal: order.subtotal,
      shipping_fee: order.shipping_fee,
      total: order.total,
      created_at: order.created_at,
      items: order.items,
    });
  });
}
