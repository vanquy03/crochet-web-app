import { digest, newToken, readCookie, hashPassword, verifyPassword } from '../security.js';
import { text, secret, HttpError } from '../validation.js';
import { transaction } from '../database.js';
import { placeOrder, readOrder } from '../services/orders.js';

const cookieName = 'tiemlen_customer';
const cookieOptions = (production) => ({
  httpOnly: true,
  secure: production,
  sameSite: 'strict',
  path: '/',
});
export function findCustomerSession(db, req) {
  const token = readCookie(req, cookieName);
  return token
    ? db
        .prepare(
          'SELECT s.*,c.name,c.email FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE token_hash=? AND expires_at>?',
        )
        .get(digest(token), Date.now())
    : null;
}
function publicSession(session) {
  return {
    customer: { id: session.customer_id, name: session.name, email: session.email },
    csrfToken: session.csrf_token,
  };
}
export function requireCustomer(db) {
  return (req, res, next) => {
    const session = findCustomerSession(db, req);
    if (!session) return next(new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.'));
    req.customer = session;
    if (!['GET', 'HEAD'].includes(req.method) && req.get('x-csrf-token') !== session.csrf_token)
      return next(new HttpError(403, 'Phiên gửi yêu cầu không hợp lệ. Tải lại trang.'));
    next();
  };
}
export function registerCustomerRoutes(
  app,
  { db, production, authLimit, orderLimit, checkoutEnabled = false },
) {
  const authenticate = requireCustomer(db);
  function startSession(req, res, customer, status = 200) {
    const token = newToken();
    const csrf = newToken();
    transaction(db, () => {
      db.prepare('DELETE FROM customer_sessions WHERE expires_at<?').run(Date.now());
      const old = readCookie(req, cookieName);
      if (old) db.prepare('DELETE FROM customer_sessions WHERE token_hash=?').run(digest(old));
      db.prepare(
        'INSERT INTO customer_sessions(token_hash,customer_id,csrf_token,expires_at) VALUES(?,?,?,?)',
      ).run(digest(token), customer.id, csrf, Date.now() + 8 * 60 * 60 * 1000);
    });
    res.cookie(cookieName, token, { ...cookieOptions(production), maxAge: 8 * 60 * 60 * 1000 });
    res.status(status).json({
      customer: { id: customer.id, name: customer.name, email: customer.email },
      csrfToken: csrf,
    });
  }
  app.post('/api/customer/register', authLimit, (req, res) => {
    const name = text(req.body.name, 'Họ tên', 2, 80);
    const email = text(req.body.email, 'Email', 3, 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ.');
    const password = secret(req.body.password, 'Mật khẩu', 1, 200);
    if (db.prepare('SELECT id FROM customers WHERE email=?').get(email))
      throw new HttpError(409, 'Email này đã được đăng ký. Vui lòng đăng nhập.');
    const result = db
      .prepare('INSERT INTO customers(name,email,password_hash) VALUES(?,?,?)')
      .run(name, email, hashPassword(password));
    startSession(req, res, { id: Number(result.lastInsertRowid), name, email }, 201);
  });
  app.post('/api/customer/login', authLimit, (req, res) => {
    const email = text(req.body.email, 'Email', 3, 200).toLowerCase();
    const password = secret(req.body.password, 'Mật khẩu', 1, 200);
    const customer = db.prepare('SELECT * FROM customers WHERE email=?').get(email);
    const valid = verifyPassword(
      password,
      customer?.password_hash || '0'.repeat(32) + ':' + '00'.repeat(64),
    );
    if (!customer || !valid) throw new HttpError(401, 'Email hoặc mật khẩu không đúng.');
    startSession(req, res, customer);
  });
  app.get('/api/customer/session', (req, res) => {
    const session = findCustomerSession(db, req);
    res.json(session ? publicSession(session) : { customer: null, csrfToken: null });
  });
  app.post('/api/customer/logout', authenticate, (req, res) => {
    db.prepare('DELETE FROM customer_sessions WHERE token_hash=?').run(req.customer.token_hash);
    res.clearCookie(cookieName, cookieOptions(production));
    res.json({ ok: true });
  });
  app.post('/api/orders', authenticate, orderLimit, (req, res) => {
    if (!checkoutEnabled)
      throw new HttpError(
        403,
        'Nhung hiện nhận mua hàng qua liên hệ. Bạn nhắn mình để hỏi mua nhé.',
      );
    const result = placeOrder(db, req.body, req.get('idempotency-key'), req.customer.customer_id);
    res.status(result.replay ? 200 : 201).json(result);
  });
  app.get('/api/customer/orders', authenticate, (req, res) => {
    const requested = Number(req.query.page || 1);
    if (!Number.isSafeInteger(requested) || requested < 1)
      throw new HttpError(400, 'Trang không hợp lệ.');
    const total = db
      .prepare('SELECT COUNT(*) AS n FROM orders WHERE customer_id=?')
      .get(req.customer.customer_id).n;
    const pages = Math.max(1, Math.ceil(total / 10));
    const page = Math.min(requested, pages);
    const orders = db
      .prepare(
        'SELECT id FROM orders WHERE customer_id=? ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET ?',
      )
      .all(req.customer.customer_id, (page - 1) * 10)
      .map((row) => readOrder(db, row.id));
    res.json({ orders, total, page, pages });
  });
  app.get('/api/customer/orders/:id', authenticate, (req, res) => {
    const row = db
      .prepare('SELECT id FROM orders WHERE id=? AND customer_id=?')
      .get(req.params.id, req.customer.customer_id);
    if (!row) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
    res.json(readOrder(db, row.id));
  });
}
