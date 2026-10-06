import { getSettings, publicProduct } from '../database.js';
import { HttpError } from '../validation.js';
export function registerPublicRoutes(app, { db }) {
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
}
