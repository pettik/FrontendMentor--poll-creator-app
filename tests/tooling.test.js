import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createZip } from '../scripts/archive.js';
import { createStaticServer } from '../scripts/serve.js';

test('local ZIP has valid directory offsets and preserves all static bytes',()=>{
  const files=[{name:'index.html',content:Buffer.from('<h1>Tiebreak</h1>')},{name:'assets/žluťoučký.txt',content:Buffer.from('A crew\nwith opinions.')}];
  const zip=createZip(files);
  const end=zip.length-22;
  assert.equal(zip.readUInt32LE(end),0x06054b50);
  assert.equal(zip.readUInt16LE(end+10),files.length);
  let entry=zip.readUInt32LE(end+16);
  for(const file of files){
    assert.equal(zip.readUInt32LE(entry),0x02014b50);
    const offset=zip.readUInt32LE(entry+42);
    const nameSize=zip.readUInt16LE(entry+28);
    assert.equal(zip.subarray(entry+46,entry+46+nameSize).toString('utf8'),file.name);
    assert.equal(zip.readUInt32LE(offset),0x04034b50);
    const dataAt=offset+30+zip.readUInt16LE(offset+26);
    assert.deepEqual(inflateRawSync(zip.subarray(dataAt,dataAt+zip.readUInt32LE(offset+18))),file.content);
    entry+=46+nameSize;
  }
  assert.deepEqual(createZip(files),zip);
  assert.throws(()=>createZip([{name:'../outside.txt',content:'wrong'}]),/relative/);
});
test('local preview serves files, reports missing assets, and accepts only reads',async()=>{
  const server=createStaticServer(fileURLToPath(new URL('../public/',import.meta.url)));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    let response=await fetch(url+'/favicon.svg');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/svg\+xml/);
    const length=(await response.arrayBuffer()).byteLength;
    response=await fetch(url+'/favicon.svg',{method:'HEAD'});assert.equal(+response.headers.get('content-length'),length);assert.equal((await response.text()).length,0);
    response=await fetch(url+'/missing.js');assert.equal(response.status,404);assert.doesNotMatch(await response.text(),/<!doctype/i);
    response=await fetch(url+'/favicon.svg',{method:'POST'});assert.equal(response.status,405);
    response=await fetch(url+'/%2e%2e%2fpackage.json');assert.equal(response.status,403);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
