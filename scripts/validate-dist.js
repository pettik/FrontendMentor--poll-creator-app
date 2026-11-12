import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export async function validateDist(directory = 'dist') {
  const root = path.resolve(directory);
  const checked = new Set();
  async function checkAsset(reference, parent = 'index.html') {
    if (!reference || /^(?:data:|https?:|#)/i.test(reference)) return;
    const url = new URL(reference, `https://static.invalid/${parent}`);
    const name = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) throw new Error(`Asset is outside the publish directory: ${reference}`);
    if (checked.has(name)) return;
    let info;
    try { info = await stat(file); } catch { throw new Error(`Missing deploy asset: ${name}. Run npm run build and upload dist, not the source folder.`); }
    if (!info.isFile() || !info.size) throw new Error(`Deploy asset is empty or invalid: ${name}`);
    checked.add(name);
    if (name.endsWith('.css')) {
      const css = await readFile(file, 'utf8');
      for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) await checkAsset(match[2], name);
    }
  }
  await checkAsset('index.html');
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) await checkAsset(match[1]);
  if (![...checked].some(name => name.endsWith('.js')) || ![...checked].some(name => name.endsWith('.css'))) throw new Error('The publish directory must contain the built JavaScript and CSS.');
  return checked;
}
