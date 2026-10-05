import { backup } from 'node:sqlite';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const db = openDatabase(path.join(directory, 'shop.sqlite'));
try {
  await mkdir(path.join(directory, 'backups'), { recursive: true });
  const target = path.join(
    directory,
    'backups',
    'shop-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite',
  );
  await backup(db, target);
  console.log('Database backup:', target);
  console.log('Sao lưu riêng thư mục uploads cùng bản database.');
} finally {
  db.close();
}
