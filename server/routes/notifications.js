import { rateLimit } from 'express-rate-limit';
import { requireCustomer } from './customers.js';
import { transaction } from '../database.js';
import { text, integer, HttpError } from '../validation.js';
import { pagination } from '../services/community.js';
import { notificationFrom, unreadCount, publicNotification } from '../services/notifications.js';
export function registerNotificationRoutes(app, { db }) {
  const authenticate = requireCustomer(db);
  app.get('/api/customer/notifications/unread', authenticate, (req, res) =>
    res.json({ unread: unreadCount(db, req.customer.customer_id) }),
  );
  app.get('/api/customer/notifications', authenticate, (req, res) => {
    const customerId = req.customer.customer_id;
    const total = db.prepare('SELECT COUNT(*) AS n ' + notificationFrom).get(customerId).n;
    const paging = pagination(req.query, total, 20);
    const rows = db
      .prepare(
        'SELECT n.*,actor.name AS actor_name,p.title AS post_title,a.title,a.body ' +
          notificationFrom +
          ' ORDER BY n.id DESC LIMIT 20 OFFSET ?',
      )
      .all(customerId, (paging.page - 1) * 20);
    res.json({
      notifications: rows.map(publicNotification),
      unread: unreadCount(db, customerId),
      ...paging,
    });
  });
  app.patch('/api/customer/notifications/:id/read', authenticate, (req, res) => {
    const result = db
      .prepare(
        'UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND customer_id=?',
      )
      .run(integer(Number(req.params.id), 'Mã thông báo', 1), req.customer.customer_id);
    if (!result.changes) throw new HttpError(404, 'Không tìm thấy thông báo.');
    res.json({ ok: true, unread: unreadCount(db, req.customer.customer_id) });
  });
  app.post('/api/customer/notifications/read-all', authenticate, (req, res) => {
    db.prepare(
      'UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE customer_id=? AND read_at IS NULL',
    ).run(req.customer.customer_id);
    res.json({ ok: true, unread: 0 });
  });
  const broadcastLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Bạn gửi thông báo quá nhiều lần. Vui lòng thử lại sau.' },
  });
  app.post('/api/admin/notifications', broadcastLimit, (req, res) => {
    const title = text(req.body.title, 'Tiêu đề', 3, 160),
      body = text(req.body.body, 'Nội dung thông báo', 3, 2000);
    const result = transaction(db, () => {
      const recipients = db.prepare('SELECT COUNT(*) AS n FROM customers').get().n;
      const id = Number(
        db
          .prepare('INSERT INTO announcements(admin_id,title,body,recipients) VALUES(?,?,?,?)')
          .run(req.session.admin_id, title, body, recipients).lastInsertRowid,
      );
      db.prepare(
        "INSERT INTO notifications(customer_id,kind,announcement_id,event_key) SELECT id,'announcement',?,? FROM customers",
      ).run(id, 'announcement:' + id);
      return { id, recipients };
    });
    res.status(201).json(result);
  });
  app.get('/api/admin/notifications', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) AS n FROM announcements').get().n;
    const paging = pagination(req.query, total, 20);
    res.json({
      announcements: db
        .prepare(
          'SELECT id,title,body,recipients,created_at AS createdAt FROM announcements ORDER BY id DESC LIMIT 20 OFFSET ?',
        )
        .all((paging.page - 1) * 20),
      ...paging,
    });
  });
}
