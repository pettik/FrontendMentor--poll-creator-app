import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
for(const directory of ['src','scripts','tests']) {
  for(const file of await readdir(directory)) {
    if(!file.endsWith('.js'))continue;
    const result=spawnSync(process.execPath,['--check',`${directory}/${file}`],{stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status)process.exit(result.status);
  }
}
console.log('JavaScript syntax checks passed.');
