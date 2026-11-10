import { context } from 'esbuild';
import { prepare, options } from './build.js';
import { createStaticServer, listenLocally } from './serve.js';

await prepare();
const builder = await context({...options,minify:false});
await builder.rebuild();
await builder.watch();
const server = createStaticServer('dist');
try { await listenLocally(server); }
catch (error) { await builder.dispose(); throw error; }
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{server.close();await builder.dispose();process.exit();});
