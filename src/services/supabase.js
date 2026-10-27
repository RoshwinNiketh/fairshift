import { createClient } from '@supabase/supabase-js';
import { evaluateFatigueRisk } from '../../shared/calculations.js';
export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const supabase = configured ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) : null;
export function unwrap(result) { if (result.error) throw new Error(result.error.message); return result.data; }
export function camelRow(row) { return Object.fromEntries(Object.entries(row).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),v])); }
export async function memberships() {
 const rows=unwrap(await supabase.from('organization_memberships').select('org_id,role'));
 const orgs=unwrap(await supabase.from('organizations').select('*'));
 return rows.map(m=>({ ...camelRow(m), organization:orgs.find(o=>o.id===m.org_id) }));
}
export async function loadOrganization(orgId) {
 const results=await Promise.all(['organizations','workers','shifts','safety_reports'].map(table=>supabase.from(table).select('*').eq(table==='organizations'?'id':'org_id',orgId)));
 const [orgs,rawWorkers,rawShifts,rawReports]=results.map(unwrap);
 if(!orgs[0]) throw new Error('Organization access denied.');
 const shifts=rawShifts.map(camelRow);
 const workers=rawWorkers.map(w=>({...camelRow(w),activeShiftId:shifts.find(s=>s.workerId===w.id&&!s.endTime)?.id||null}));
 const names=Object.fromEntries(workers.map(w=>[w.id,w.name]));
 const reports=rawReports.map(r=>({...camelRow(r),workerName:names[r.worker_id]||''}));
 const organization=orgs[0];
 const fatigueAlerts=workers.flatMap(w=>{const risk=evaluateFatigueRisk(shifts.filter(s=>s.workerId===w.id&&s.endTime),{maxDailyHours:organization.settings.maxDailyHoursThreshold,minRestHours:organization.settings.minRestHoursThreshold,maxWeeklyHours:organization.settings.maxWeeklyHoursThreshold});return risk.hasWarning?[{...risk,workerId:w.id,workerName:w.name,role:w.role}]:[];});
 return {organization,workers,shifts:shifts.map(s=>({...s,workerName:names[s.workerId]||''})),reports,fatigueAlerts};
}
export const checkIn=orgId=>supabase.rpc('fairshift_check_in',{p_org_id:orgId}).single().then(unwrap);
export async function checkOut(orgId) { const row=camelRow(unwrap(await supabase.rpc('fairshift_check_out',{p_org_id:orgId}).single())); return {earnings:row}; }
export const submitReport=r=>supabase.from('safety_reports').insert({worker_id:r.workerId,org_id:r.orgId,category:r.category,severity:r.severity,title:r.title,description:r.description}).select().single().then(unwrap);
export const updateReport=(id,status,note)=>supabase.from('safety_reports').update({status,resolution_note:note}).eq('id',id).select().single().then(unwrap);
export const loadSkills=orgId=>supabase.from('skill_passport_entries').select('*').eq('org_id',orgId).order('created_at',{ascending:false}).then(unwrap);
export const saveSkill=(entry,id)=> { const {worker_id,org_id,...editable}=entry; return (id?supabase.from('skill_passport_entries').update(editable).eq('id',id):supabase.from('skill_passport_entries').insert(entry)).select().single().then(unwrap); };
export const sendFeedback=entry=>supabase.from('worker_feedback').insert(entry).then(unwrap);
export const feedbackSummary=orgId=>supabase.rpc('fairshift_feedback_summary',{p_org_id:orgId}).then(unwrap);