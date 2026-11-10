import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

export function createStaticServer(directory) {
  const root = path.resolve(directory);
  return createServer(async (request, response) => {
    const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
    const reply = (status, message) => response.writeHead(status, {...headers, 'Content-Type': 'text/plain; charset=utf-8'}).end(message);
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD'); reply(405, 'Method not allowed.'); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { reply(400, 'Invalid address.'); return; }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { reply(403, 'Forbidden.'); return; }
    try {
      const resolved = await realpath(file);
      if (!resolved.startsWith(await realpath(root) + path.sep)) { reply(403, 'Forbidden.'); return; }
      if (!(await stat(resolved)).isFile()) { reply(404, 'File not found.'); return; }
      const body = await readFile(resolved);
      response.writeHead(200, {...headers, 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length});
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) reply(404, 'File not found.');
      else reply(500, 'Could not load the preview.');
    }
  });
}

export async function listenLocally(server) {
  const port = Number(process.env.PORT || 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a number between 1 and 65535.');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  console.log(`Tiebreak: http://localhost:${port}`);
}
