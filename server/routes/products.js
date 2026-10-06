import multer from 'multer';
import { productMediaUpload } from '../uploads.js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { transaction, publicProduct } from '../database.js';
import { productInput, HttpError } from '../validation.js';
export function registerProductsRoutes(app, { db, uploadDir }) {
  app.get('/api/admin/products', (req, res) =>
    res.json(db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(publicProduct)),
  );
  app.post('/api/admin/products', (req, res) => {
    const input = productInput(req.body);
    const result = transaction(db, () => {
      const r = db
        .prepare(
          'INSERT INTO products(name,type,description,price,stock,color,background,tag,image_url,active,kind,media) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(...input);
      db.prepare('INSERT INTO inventory_log(product_id,delta,reason) VALUES(?,?,?)').run(
        Number(r.lastInsertRowid),
        input[4],
        'product_created',
      );
      return r;
    });
    res
      .status(201)
      .json(
        publicProduct(
          db.prepare('SELECT * FROM products WHERE id=?').get(Number(result.lastInsertRowid)),
        ),
      );
  });
  app.put('/api/admin/products/:id', (req, res) => {
    const input = productInput(req.body);
    const p = transaction(db, () => {
      const old = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
      if (!old) throw new HttpError(404, 'Sản phẩm không tồn tại.');
      if (req.body.version !== old.version)
        throw new HttpError(409, 'Sản phẩm đã thay đổi. Tải lại trước khi lưu tồn kho.');
      db.prepare(
        "UPDATE products SET name=?,type=?,description=?,price=?,stock=?,color=?,background=?,tag=?,image_url=?,active=?,kind=?,media=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
      ).run(...input, req.params.id);
      if (input[4] !== old.stock)
        db.prepare('INSERT INTO inventory_log(product_id,delta,reason) VALUES(?,?,?)').run(
          old.id,
          input[4] - old.stock,
          'admin_adjustment',
        );
      return db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
    });
    res.json({ ...publicProduct(p), updatedAt: p.updated_at });
  });
  app.delete('/api/admin/products/:id', (req, res) => {
    const r = db
      .prepare(
        "UPDATE products SET active=0,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
      )
      .run(req.params.id);
    if (!r.changes) throw new HttpError(404, 'Sản phẩm không tồn tại.');
    res.json({ ok: true });
  });
  app.post('/api/admin/media', ...productMediaUpload(uploadDir));
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.post('/api/admin/uploads', upload.single('image'), (req, res) => {
    const buffer = req.file?.buffer;
    if (!buffer) throw new HttpError(400, 'Chọn một ảnh sản phẩm.');
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      isJpg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255,
      isWebp =
        buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    const ext = isPng ? 'png' : isJpg ? 'jpg' : isWebp ? 'webp' : null;
    if (!ext) throw new HttpError(400, 'Chỉ nhận ảnh PNG, JPG hoặc WebP.');
    const filename = randomUUID() + '.' + ext;
    writeFileSync(path.join(uploadDir, filename), buffer, { flag: 'wx' });
    res.status(201).json({ imageUrl: '/uploads/' + filename });
  });
}
