import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';

export async function prepare() {
  await mkdir('dist', {recursive:true});
  await copyFile('index.html','dist/index.html');
  await copyFile('public/favicon.svg','dist/favicon.svg');
  await copyFile('index.html','dist/404.html');
  await writeFile('dist/_redirects','/* /index.html 200\n');
  await writeFile('dist/.nojekyll','');
  await mkdir('dist/licenses',{recursive:true});
  await copyFile('node_modules/@fontsource-variable/gabarito/LICENSE','dist/licenses/Gabarito.txt');
  await copyFile('node_modules/@fontsource-variable/karla/LICENSE','dist/licenses/Karla.txt');
  await copyFile('node_modules/@dicebear/core/LICENSE','dist/licenses/DiceBear-core.txt');
  await copyFile('node_modules/@dicebear/micah/LICENSE','dist/licenses/DiceBear-micah.txt');
  await copyFile('THIRD_PARTY_NOTICES.md','dist/licenses/THIRD_PARTY_NOTICES.md');
}
export const options = {
  entryPoints:['src/app.js'], bundle:true, outdir:'dist/assets', entryNames:'app',
  assetNames:'fonts/[name]-[hash]', loader:{'.woff2':'file','.woff':'file'},
  target:['es2022'], format:'esm', minify:!process.argv.includes('--development'),
  sourcemap:false, logLevel:'info',
};
if (process.argv[1]?.replaceAll('\\','/').endsWith('/scripts/build.js')) {
  await prepare();
  await build(options);
}
