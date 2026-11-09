// Keep the user's Git history and GitHub remote untouched by Sites publication.
import { cp, mkdir, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root=await realpath('.');
const stage=path.resolve(root,'.sites/publish');
if(!stage.startsWith(root+path.sep))throw new Error('Staging directory must be inside the project.');
await mkdir(stage,{recursive:true});
const entries=['.gitignore','.openai','data/sample-polls.json','docs','index.html','package.json','package-lock.json','playwright.config.js','public','src','starter/tokens.css','scripts','tests','README.md','THIRD_PARTY_NOTICES.md','dist'];
for(const entry of entries) {
  await mkdir(path.dirname(path.join(stage,entry)),{recursive:true});
  await cp(path.join(root,entry),path.join(stage,entry),{recursive:true,force:true});
}
const git=args=>execFileSync('git',args,{cwd:stage,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
git(['init','--quiet']);
git(['add','--all']);
if(git(['status','--porcelain'])) {
  let identity=[];
  try {git(['var','GIT_AUTHOR_IDENT']);}catch {identity=['-c','user.name=Sites','-c','user.email=sites@users.noreply.openai.com'];}
  git([...identity,'commit','--quiet','-m','feat(polls): build pass-the-phone polling app']);
}
console.log(JSON.stringify({checkout_path:stage,commit_sha:git(['rev-parse','HEAD'])}));
