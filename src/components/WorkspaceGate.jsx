import React, { useState, useEffect, useSyncExternalStore } from 'react';
import App from '../App.jsx';
import * as api from '../services/supabase.js';
import { createWorkspaceController } from '../../shared/workspace-controller.js';

export default function WorkspaceGate() {
 const [controller] = useState(() => createWorkspaceController({ loadMemberships: api.memberships, loadOrganization: api.loadOrganization }));
 const {mode,session,access,active,data,error,busy} = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
 const [email,setEmail] = useState('');
 const [password,setPassword] = useState('');
 const [loginBusy,setLoginBusy] = useState(false);
 const [logoutPending,setLogoutPending] = useState(false);
 useEffect(() => {
  if (!api.configured) { controller.clear(); return; }
  let live = true;
  api.supabase.auth.getSession().then(({data,error}) => {
   if (!live) return;
   if (error) { controller.clear('login'); controller.setError(error.message); }
   else controller.start(data.session);
  });
  const {data:subscription} = api.supabase.auth.onAuthStateChange((event,next) => {
   if (!['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED'].includes(event)) return;
   setTimeout(() => { if (live) { setPassword(''); controller.start(next); } }, 0);
  });
  return () => { live=false; controller.invalidate(); subscription.subscription.unsubscribe(); };
 }, [controller]);
 useEffect(() => {
  if (mode!=='shared' || !active || !data) return;
  const fetch=()=>controller.refresh(active.orgId).catch(()=>{});
  const onFocus=()=>{ if(document.visibilityState==='visible')fetch(); };
  window.addEventListener('focus',fetch);
  document.addEventListener('visibilitychange',onFocus);
  const timer=setInterval(fetch,15000);
  return()=>{window.removeEventListener('focus',fetch);document.removeEventListener('visibilitychange',onFocus);clearInterval(timer);};
 }, [controller,mode,active?.orgId,Boolean(data)]);
 const signOut=async()=>{
  setLogoutPending(true);
  try {
   const {error}=await api.supabase.auth.signOut({scope:'local'});
   if(error)throw error;
   controller.clear(); setEmail(''); setPassword('');
  } catch(error) { controller.setError(error.message); }
  finally { setLogoutPending(false); }
 };
 if(logoutPending)return <div className="page-content" role="status">Signing out…</div>;
 if(mode==='checking')return <div className="page-content" role="status">Loading your workspace…</div>;
 if(mode==='demo')return <><div className="connection-bar"><span>Standalone demo · தனிப்பட்ட டெமோ · data stays in this browser</span><button className="button button-secondary" onClick={()=>controller.showLogin()}>Sign in to shared workspace / உள்நுழை</button></div><App/></>;
 if(mode==='login')return <div className="page-content"><section className="card auth-card"><p className="eyebrow">FAIRSHIFT SHARED WORKSPACE</p><h1>Sign in / உள்நுழை</h1><p className="muted">Use your assigned worker or employer account. Roles and organizations are assigned by the project owner.</p>{error&&<p role="alert" className="notice notice-danger">{error}</p>}{!api.configured&&<p className="notice notice-warning">Shared workspace is not configured on this deployment. The standalone demo is available.</p>}<form className="report-form" onSubmit={async e=>{e.preventDefault();setLoginBusy(true);controller.setError('');try{const result=await api.supabase.auth.signInWithPassword({email,password});if(result.error)throw result.error;setPassword('');}catch(err){controller.setError(err.message);}finally{setLoginBusy(false);}}}><div><label htmlFor="login-email">Email / மின்னஞ்சல்</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div><label htmlFor="login-password">Password / கடவுச்சொல்</label><input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div><button className="button button-primary" disabled={!api.configured||busy||loginBusy}>{loginBusy?'Signing in…':'Sign in / உள்நுழை'}</button><button type="button" className="button button-secondary" onClick={()=>{controller.setError('');controller.showDemo();}}>Use standalone demo / டெமோ</button></form></section></div>;
 if(!data||!active)return <div className="page-content"><section className="card"><h1>Shared workspace</h1>{error?<p role="alert" className="notice notice-danger">{error}</p>:<p role="status">Loading authorized records…</p>}<button className="button button-secondary" onClick={signOut}>Sign out</button></section></div>;
 const role=active.role==='worker'?'worker':'employer';
 return <>{error&&<div className="notice notice-danger" role="alert">Shared data refresh failed: {error}. No local fallback was used.<button onClick={()=>controller.refresh(active.orgId).catch(()=>{})}>Retry</button></div>}<App key={active.orgId+'_'+session.user.id} cloud={{data,role,user:session.user,orgs:access.map(m=>m.organization),refresh:controller.refresh,selectOrg:orgId=>controller.selectOrg(orgId).catch(err=>controller.setError(err.message)),signOut,busy}}/></>;
}