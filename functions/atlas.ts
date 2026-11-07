import { createRealtime, rawSql } from '@neon/realtime/server';
import { waitUntil } from '@neon/functions';
import { createPool } from './backend/db.js';
import { createStorage } from './backend/storage.js';
import { createApp } from './backend/app.js';
import { tokenVerifier } from './backend/security.js';

const apiUrl=process.env.ATLAS_API_DATABASE_URL;
if(!apiUrl)throw new Error('ATLAS_API_DATABASE_URL is required; owner credentials are not a fallback');
if(new URL(process.env.DATABASE_URL!).username!=='atlas_api_login')throw new Error('Provider runtime must use the dedicated API credential');
const realtime=createRealtime({secret:process.env.NEON_REALTIME_SECRET!,db:new URL(apiUrl).pathname.slice(1)});
const origins=(process.env.ATLAS_ALLOWED_ORIGINS||'https://atlas.homara.co.ke').split(',');
export default createApp({
 collectorToken:process.env.ATLAS_KPC_COLLECTOR_TOKEN,
 pool:createPool(apiUrl),storage:createStorage(),rateSecret:process.env.ATLAS_RATE_LIMIT_SECRET!,origins,
 verify:tokenVerifier(process.env.NEON_AUTH_BASE_URL!,process.env.NEON_AUTH_JWKS_URL!),
 // Realtime is a sealed capability; owner is fixed by the verified JWT, never request input.
 seal:userId=>realtime.seal({query:rawSql("SELECT id,title,created_at FROM public.atlas_report_live WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",[userId])}),
 kick:()=>{
  const base=process.env.ATLAS_WORKER_BASE_URL,secret=process.env.ATLAS_INTERNAL_TOKEN;
  if(!base||!secret)return;
  waitUntil(fetch(new URL('/run',base),{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(120000)})
   .then(r=>{if(!r.ok)console.error(JSON.stringify({event:'worker_kick_failed',status:r.status}));}).catch(()=>console.error(JSON.stringify({event:'worker_kick_failed'}))));
 },
});
