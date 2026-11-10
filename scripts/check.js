import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
async function check(directory) {
  for(const file of await readdir(directory,{withFileTypes:true})) {
    const target=`${directory}/${file.name}`;
    if(file.isDirectory()){await check(target);continue;}
    if(!file.name.endsWith('.js'))continue;
    const result=spawnSync(process.execPath,['--check',target],{stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status)process.exit(result.status);
  }
}
for(const directory of ['src','scripts','tests'])await check(directory);
const config=spawnSync(process.execPath,['--check','playwright.config.js'],{stdio:'inherit'});
if(config.error)throw config.error;
if(config.status)process.exit(config.status);
console.log('JavaScript syntax checks passed.');
