import express from 'express';
import { registerCommunityRoutes } from './routes/community.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from './validation.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerProductsRoutes } from './routes/products.js';
import { registerOrdersRoutes } from './routes/orders.js';
import { registerCustomerRoutes } from './routes/customers.js';
import { registerSettingsRoutes } from './routes/settings.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export function createApp({
  db,
  uploadDir,
  production = false,
  staticDir = path.join(projectRoot, 'src'),
  trustProxy = false,
}) {
  const app = express();
  mkdirSync(uploadDir, { recursive: true });
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'https:', 'data:'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'script-src': ["'self'"],
          'upgrade-insecure-requests': production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      const expected = new URL(`${req.protocol}://${req.get('host')}`).origin;
      if (origin && origin !== expected)
        return next(new HttpError(403, 'Nguồn yêu cầu không hợp lệ.'));
      if (
        !['/admin/uploads', '/admin/media', '/community/uploads'].includes(req.path) &&
        !req.is('application/json')
      )
        return next(new HttpError(415, 'Yêu cầu phải dùng JSON.'));
    }
    next();
  });
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Thử đăng nhập quá nhiều lần. Vui lòng đợi 15 phút.' },
  });
  const orderLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' },
  });
  registerPublicRoutes(app, { db });
  const customerAuthLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Thử đăng nhập hoặc đăng ký quá nhiều lần. Vui lòng đợi 15 phút.' },
  });
  registerCustomerRoutes(app, { db, production, authLimit: customerAuthLimit, orderLimit });
  // Auth đăng ký login trước rồi áp middleware phiên cho các API admin còn lại.
  registerAuthRoutes(app, { db, production, loginLimit });
  registerCommunityRoutes(app, { db, uploadDir });
  registerProductsRoutes(app, { db, uploadDir });
  registerOrdersRoutes(app, { db });
  registerSettingsRoutes(app, { db });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API không tồn tại.' }));
  app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny', maxAge: '1d' }));
  app.use(express.static(staticDir, { dotfiles: 'deny', index: 'index.html' }));
  app.use((error, req, res, next) => {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof multer.MulterError
          ? 400
          : Number.isInteger(error.status) && error.status >= 400 && error.status < 500
            ? error.status
            : 500;
    if (status === 500) console.error('Server error:', error.message);
    res.status(status).json({
      error:
        status === 500
          ? 'Có lỗi hệ thống. Vui lòng thử lại.'
          : error instanceof multer.MulterError
            ? req.path === '/api/admin/media'
              ? 'Ảnh tối đa 5 MB, video tối đa 30 MB; mỗi lần một file.'
              : 'Ảnh tối đa 5 MB, mỗi lần một ảnh.'
            : error.status === 400 && !(error instanceof HttpError)
              ? 'Nội dung JSON không hợp lệ.'
              : error.message,
    });
  });
  return app;
}
