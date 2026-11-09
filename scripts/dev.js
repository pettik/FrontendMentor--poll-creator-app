import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { context } from 'esbuild';
import { prepare, options } from './build.js';

await prepare();
const builder = await context({...options,minify:false});
await builder.rebuild();
await builder.watch();
const root = path.resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png'};
const server = createServer(async (request,response) => {
  try {
    const url = new URL(request.url,'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) { response.writeHead(403).end(); return; }
    const target = await stat(file).then(info => info.isFile() ? file : path.join(root,'index.html')).catch(()=>path.join(root,'index.html'));
    const body = await readFile(target);
    response.writeHead(200,{'Content-Type':types[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(body);
  } catch { response.writeHead(500).end('Could not load the preview.'); }
});
server.listen(Number(process.env.PORT || 5173),'127.0.0.1',()=>console.log(`Tiebreak: http://localhost:${process.env.PORT || 5173}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{server.close();await builder.dispose();process.exit();});
