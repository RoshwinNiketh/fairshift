// Read-only remote Auth/RLS probes. Mutating policy tests live in security_rollback.sql.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const config=Object.fromEntries(readFileSync('.env.local','utf8').trim().split(/\r?\n/).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const accounts=JSON.parse(readFileSync('.qa-accounts.local','utf8'));
const results=[];
const ok=name=>{results.push({name,passed:true});console.log('PASS',name);};
const data=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
const make=(options={})=>createClient(config.VITE_SUPABASE_URL,config.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,...options}});
const w=make(),e=make(),anon=make();
try{
 for(const[c,a]of[[w,accounts[0]],[e,accounts[1]]])data(await c.auth.signInWithPassword({email:a.email,password:a.password}));ok('Worker and employer authenticate in separate actual Supabase sessions');
 for(const table of ['organizations','user_profiles','organization_memberships','workers','shifts','safety_reports','skill_passport_entries','worker_feedback']){const r=await anon.from(table).select('*');assert.ok(r.error||r.data.length===0);}ok('Eight application tables deny unauthenticated data');
 for(const name of ['fairshift_check_in','fairshift_check_out','fairshift_feedback_summary'])assert.ok((await anon.rpc(name,{p_org_id:'org-buildright'})).error);ok('Anonymous RPC calls denied');
 const own=data(await w.from('workers').select('*'));assert.equal(own.length,1);assert.equal(own[0].id,'w-c1');assert.equal(data(await w.from('workers').select('*').eq('id','w-c2')).length,0);ok('Worker-to-worker isolation');
 assert.equal(data(await w.from('shifts').select('id').eq('worker_id','w-c2')).length,0);assert.equal(data(await w.from('skill_passport_entries').select('id').eq('worker_id','w-c2')).length,0);ok('Other worker shifts and skills are unreadable');
 for(const c of[w,e])assert.equal(data(await c.from('organizations').select('id').eq('id','org-apexcollege')).length,0);ok('Both worker and employer are isolated from unassigned organization');
 assert.equal(data(await e.from('worker_feedback').select('*')).length,0);const summary=data(await e.rpc('fairshift_feedback_summary',{p_org_id:'org-buildright'}));assert.ok(!('worker_id'in summary)&&!('comment'in summary));ok('Employer receives no raw feedback, identities, or comments');
 assert.ok((await w.rpc('fairshift_feedback_summary',{p_org_id:'org-buildright'})).error);assert.ok((await e.rpc('fairshift_feedback_summary',{p_org_id:'org-apexcollege'})).error);ok('Feedback summary worker/cross-org authorization');
 const storage=new Map();const adapter={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const first=make({persistSession:true,storage:adapter,storageKey:'fairshift-security-session'});data(await first.auth.signInWithPassword({email:accounts[0].email,password:accounts[0].password}));const second=make({persistSession:true,storage:adapter,storageKey:'fairshift-security-session'});assert.equal(data(await second.auth.getSession()).session.user.id,own[0].user_id);ok('SDK restores a persisted authenticated session (memory adapter, not browser)');
 data(await second.auth.signOut({scope:'local'}));assert.equal(data(await second.auth.getSession()).session,null);assert.equal(storage.size,0);assert.ok(data(await e.auth.getUser()).user.id);ok('Local logout clears persisted session and preserves independent employer session');
 const result={project:config.VITE_SUPABASE_URL,executedAt:new Date().toISOString(),kind:'Actual remote Supabase Auth/RLS, read-only records; session persistence uses SDK memory storage. Mutating security tests use rolled-back SQL fixtures.',results};writeFileSync('docs/SUPABASE_TEST_RESULTS.json',JSON.stringify(result,null,2));console.log(`${results.length} remote checks passed`);
}catch(error){console.error('FAIL',error.message);writeFileSync('docs/SUPABASE_TEST_RESULTS.json',JSON.stringify({results,failure:error.message},null,2));process.exitCode=1;}