// בילד מינימלי בלי bundler: tsc מקמפל את src/*.ts ל-dist/*.js (כל
// קובץ בנפרד — אין import בין popup.ts לקבצים אחרים בזמן ריצה, רק
// import type שנמחק לגמרי בקומפילציה), והסקריפט הזה מעתיק את
// הקבצים הסטטיים (manifest.json, popup.html, popup.css) מ-public/
// לאותה תיקיית dist/. אין צורך ב-Vite/esbuild/webpack כאן — התוסף
// הוא עמוד HTML + סקריפט מודול אחד, לא אפליקציית React.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(root, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

execSync('npx tsc -p tsconfig.json', { cwd: root, stdio: 'inherit' });

for (const file of ['manifest.json', 'popup.html', 'popup.css']) {
  const src = path.join(root, 'public', file);
  if (!existsSync(src)) throw new Error(`Missing required static file: public/${file}`);
  cpSync(src, path.join(distDir, file));
}

console.log(`✓ apps/admin-extension built to ${distDir}`);
console.log('  טעינה ב-Chrome: chrome://extensions → מצב מפתחים → "טען לא ארוז" → בחרי את תיקיית dist/');
