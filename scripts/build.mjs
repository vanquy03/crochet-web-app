import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await mkdir(output, { recursive: true });
// Chỉ xóa file đầu ra do phiên bản website cũ tạo; không xóa thư mục người dùng.
for (const name of ['index.html', 'app.js', 'config.js', 'theme.css']) {
  await rm(path.join(output, name), { force: true });
}
await cp(path.join(root, 'src'), output, { recursive: true });
console.log('Built src/ -> dist/');
