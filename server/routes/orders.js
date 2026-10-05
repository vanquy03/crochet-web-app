import { readOrder, updateOrder } from '../services/orders.js';
import { HttpError } from '../validation.js';
export function registerOrdersRoutes(app, { db }) {
  app.get('/api/admin/orders', (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1),
      status = req.query.status || '';
    if (status && !['pending', 'confirmed', 'shipping', 'completed', 'cancelled'].includes(status))
      throw new HttpError(400, 'Trạng thái không hợp lệ.');
    const where = status ? 'WHERE status=?' : '',
      args = status ? [status] : [];
    const total = db.prepare('SELECT COUNT(*) AS count FROM orders ' + where).get(...args).count;
    const orders = db
      .prepare(
        'SELECT id,name,phone,status,total,paid,created_at FROM orders ' +
          where +
          ' ORDER BY created_at DESC,id DESC LIMIT 30 OFFSET ?',
      )
      .all(...args, (page - 1) * 30);
    res.json({ orders, total, page, pages: Math.max(1, Math.ceil(total / 30)) });
  });
  app.get('/api/admin/orders/:id', (req, res) => res.json(readOrder(db, req.params.id)));
  app.patch('/api/admin/orders/:id', (req, res) =>
    res.json(updateOrder(db, req.params.id, req.body.status, req.body.paid)),
  );
  app.get('/api/admin/dashboard', (req, res) =>
    res.json({
      orders: db.prepare('SELECT COUNT(*) AS value FROM orders').get().value,
      pending: db.prepare("SELECT COUNT(*) AS value FROM orders WHERE status='pending'").get()
        .value,
      revenue: db
        .prepare(
          "SELECT COALESCE(SUM(total),0) AS value FROM orders WHERE status='completed' AND paid=1",
        )
        .get().value,
      lowStock: db
        .prepare('SELECT id,name,stock FROM products WHERE active=1 AND stock<=5 ORDER BY stock')
        .all(),
    }),
  );
}
