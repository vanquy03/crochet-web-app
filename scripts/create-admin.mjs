import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.js';
import { hashPassword } from '../server/security.js';
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
let db;
try {
  const email = (await rl.question('Email quản trị: ')).trim().toLowerCase();
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Email không hợp lệ.');
  process.stdout.write('Mật khẩu (ít nhất 12 ký tự, được ẩn): ');
  muted = true;
  const password = await rl.question('');
  muted = false;
  process.stdout.write('\n');
  if (password.length < 12 || password.length > 200)
    throw new Error('Mật khẩu cần từ 12 đến 200 ký tự.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  db = openDatabase(
    path.join(path.resolve(process.env.DATA_DIR || path.join(root, 'data')), 'shop.sqlite'),
  );
  db.prepare('INSERT INTO admins(email,password_hash) VALUES(?,?)').run(
    email,
    hashPassword(password),
  );
  console.log('Đã tạo tài khoản quản trị. Đăng nhập tại /admin/.');
} catch (error) {
  console.error(
    error.message.includes('UNIQUE') ? 'Email quản trị này đã tồn tại.' : error.message,
  );
  process.exitCode = 1;
} finally {
  muted = false;
  rl.close();
  db?.close();
}
