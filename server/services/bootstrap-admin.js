import { hashPassword } from '../security.js';

// TẠM THỜI: Render Free không có Shell để chạy admin:create.
// Tạo admin bằng biến môi trường khi khởi động; không seed hoặc đổi mật khẩu tài khoản đã có.
// Khi có quy trình quản trị ổn định, bỏ ADMIN_EMAIL/ADMIN_PASSWORD và dùng admin:create.
export function bootstrapAdmin(db, env = process.env) {
  const emailValue = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  if (!emailValue && !password) return false;
  const email = String(emailValue || '')
    .trim()
    .toLowerCase();
  if (!email || !password)
    throw new Error('Cần cấu hình cả ADMIN_EMAIL và ADMIN_PASSWORD để tạo admin tạm thời.');
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('ADMIN_EMAIL không hợp lệ.');
  if (typeof password !== 'string' || password.length > 200)
    throw new Error('ADMIN_PASSWORD cần là chuỗi không trống, tối đa 200 ký tự.');
  if (db.prepare('SELECT id FROM admins WHERE email=?').get(email)) return false;
  const result = db
    .prepare('INSERT OR IGNORE INTO admins(email,password_hash) VALUES(?,?)')
    .run(email, hashPassword(password));
  return result.changes > 0;
}
