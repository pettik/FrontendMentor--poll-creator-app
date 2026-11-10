import { access } from 'node:fs/promises';
import { createStaticServer, listenLocally } from './serve.js';

try { await access('dist/index.html'); }
catch { throw new Error('Build the app with npm run build before starting its production preview.'); }
const server = createStaticServer('dist');
await listenLocally(server);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()));
