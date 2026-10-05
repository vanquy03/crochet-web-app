import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(js|mjs)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
      if (result.status !== 0) throw new Error('Invalid JavaScript: ' + file);
      const code = await readFile(file, 'utf8');
      for (const match of code.matchAll(/from\s+['"](\.[^'"]+)['"]/g))
        await access(path.resolve(path.dirname(file), match[1]));
    }
  }
}
await walk(path.join(root, 'src'));
await walk(path.join(root, 'scripts'));
await walk(path.join(root, 'server'));
const html = await readFile(path.join(root, 'src/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:js|styles)\/[^"#]+)"/g))
  await access(path.join(root, 'src', match[1]));
console.log('JavaScript syntax, module imports and HTML assets are valid.');
