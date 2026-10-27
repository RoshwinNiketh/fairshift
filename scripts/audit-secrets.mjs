import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,readdirSync,writeFileSync} from 'node:fs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024});
const credentials=existsSync('.qa-accounts.local')?JSON.parse(readFileSync('.qa-accounts.local','utf8')).map(a=>a.password):[];
const findings=[];
function inspect(text,path,revision){
 const kinds=[];
 if(/sb_secret_[A-Za-z0-9_-]{20,}/.test(text))kinds.push('Supabase secret key');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))kinds.push('Private key');
 if(/postgres(?:ql)?:\/\/[^\s:]+:[^\s@]{8,}@/.test(text))kinds.push('Database credential URI');
 if(credentials.some(p=>p&&text.includes(p)))kinds.push('Private QA password');
 for(const jwt of text.matchAll(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g)){try{const payload=JSON.parse(Buffer.from(jwt[0].split('.')[1],'base64url'));if(['authenticated','service_role'].includes(payload.role))kinds.push('Privileged or user JWT');}catch{}}
 if(kinds.length)findings.push({path,revision,kinds:[...new Set(kinds)]});
}
const revisions=git('rev-list','--all').trim().split('\n');
let blobs=0;const seen=new Set();
for(const revision of revisions){for(const line of git('ls-tree','-r',revision).trim().split('\n')){const match=line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/);if(!match||seen.has(match[1]))continue;seen.add(match[1]);const path=match[2];if(/(?:^|\/)(?:\.env(?:\.local)?|\.qa-accounts\.local)$/.test(path))findings.push({path,revision,kinds:['Credential filename tracked']});if(/\.(png|jpg|webp|pdf)$/.test(path))continue;inspect(git('cat-file','blob',match[1]),path,revision);blobs++;}}
for(const path of git('ls-files','--cached','--others','--exclude-standard').trim().split('\n'))if(existsSync(path)&&!path.match(/\.(png|jpg|webp|pdf)$/))inspect(readFileSync(path,'utf8'),path,'working-tree');
if(existsSync('dist/assets'))for(const file of readdirSync('dist/assets'))if(file.endsWith('.js'))inspect(readFileSync('dist/assets/'+file,'utf8'),'dist/assets/'+file,'build');
const result={executedAt:new Date().toISOString(),revisions:revisions.length,uniqueTextBlobs:blobs,findings,scope:'Tracked/untracked nonignored text, all reachable Git history, built JS; high-signal patterns and exact private QA passwords. No credential values recorded.'};
writeFileSync('docs/SECRET_SCAN.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(findings.length)process.exitCode=1;