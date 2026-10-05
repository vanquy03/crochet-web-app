import { transaction } from '../database.js';
import { digest, newToken, readCookie, verifyPassword, hashPassword } from '../security.js';
import { text, secret, HttpError } from '../validation.js';
export function registerAuthRoutes(app, { db, production, loginLimit }) {
  const session = (req, res, next) => {
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    const token = readCookie(req, 'tiemlen_session');
    const found =
      token &&
      db
        .prepare(
          'SELECT sessions.*,admins.email FROM sessions JOIN admins ON admins.id=sessions.admin_id WHERE token_hash=? AND expires_at>?',
        )
        .get(digest(token), Date.now());
    if (!found) return next(new HttpError(401, 'Vui lòng đăng nhập.'));
    req.session = found;
    if (!['GET', 'HEAD'].includes(req.method) && req.get('x-csrf-token') !== found.csrf_token)
      return next(new HttpError(403, 'Phiên gửi yêu cầu không hợp lệ. Tải lại trang.'));
    next();
  };
  app.post('/api/admin/login', loginLimit, (req, res) => {
    const email = text(req.body.email, 'Email', 3, 200).toLowerCase(),
      password = secret(req.body.password, 'Mật khẩu', 1, 200);
    const admin = db.prepare('SELECT * FROM admins WHERE email=?').get(email);
    if (
      !verifyPassword(
        password,
        admin?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64),
      )
    )
      throw new HttpError(401, 'Email hoặc mật khẩu không đúng.');
    const token = newToken(),
      csrf = newToken();
    db.prepare(
      'INSERT INTO sessions(token_hash,admin_id,csrf_token,expires_at) VALUES(?,?,?,?)',
    ).run(digest(token), admin.id, csrf, Date.now() + 8 * 60 * 60 * 1000);
    res.cookie('tiemlen_session', token, {
      httpOnly: true,
      secure: production,
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.json({ email: admin.email, csrfToken: csrf });
  });
  app.use('/api/admin', session);
  app.get('/api/admin/session', (req, res) =>
    res.json({ email: req.session.email, csrfToken: req.session.csrf_token }),
  );
  app.post('/api/admin/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.session.token_hash);
    res.clearCookie('tiemlen_session', { path: '/', secure: production, sameSite: 'strict' });
    res.json({ ok: true });
  });
  app.put('/api/admin/password', (req, res) => {
    const current = secret(req.body.currentPassword, 'Mật khẩu hiện tại', 1, 200),
      password = secret(req.body.password, 'Mật khẩu mới', 12, 200);
    const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(req.session.admin_id);
    if (!verifyPassword(current, admin.password_hash))
      throw new HttpError(401, 'Mật khẩu hiện tại không đúng.');
    const passwordHash = hashPassword(password);
    transaction(db, () => {
      db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(
        passwordHash,
        req.session.admin_id,
      );
      db.prepare('DELETE FROM sessions WHERE admin_id=?').run(req.session.admin_id);
    });
    res.clearCookie('tiemlen_session', { path: '/', secure: production, sameSite: 'strict' });
    res.json({ ok: true });
  });
}
