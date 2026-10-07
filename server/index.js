import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { createApp } from './app.js';
import { bootstrapAdmin } from './services/bootstrap-admin.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const db = openDatabase(path.join(dataDir, 'shop.sqlite'));
try {
  if (bootstrapAdmin(db)) console.log('Đã tạo admin từ cấu hình môi trường tạm thời.');
} catch (error) {
  db.close();
  throw error;
}
const production = process.env.NODE_ENV === 'production';
const app = createApp({
  db,
  uploadDir: path.join(dataDir, 'uploads'),
  production,
  trustProxy: process.env.TRUST_PROXY === '1',
  staticDir: path.join(root, production ? 'dist' : 'src'),
});
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`Website: http://localhost:${port}\nQuản trị: http://localhost:${port}/admin/`),
);
server.on('error', (error) => {
  console.error(error.message);
  db.close();
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
