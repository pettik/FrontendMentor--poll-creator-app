import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createZip } from './archive.js';

async function collect(directory, prefix = '') {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await collect(path.join(directory, entry.name), name + '/'));
    else if (entry.isFile()) files.push({name, content: await readFile(path.join(directory, entry.name))});
  }
  return files;
}

const files = await collect('dist');
if (!files.some(file => file.name === 'index.html')) throw new Error('Run npm run build before packaging the app.');
const archive = createZip(files);
const hash = createHash('sha256').update(archive).digest('hex');
await mkdir('artifacts', {recursive: true});
await writeFile('artifacts/tiebreak.zip', archive);
await writeFile('artifacts/tiebreak.sha256', `${hash}  tiebreak.zip\n`);
console.log(`Local distribution: artifacts/tiebreak.zip (${archive.length} bytes, ${files.length} files)`);
console.log(`SHA-256: ${hash}`);
