import type { Pool } from 'pg';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { parseTriggerDelivery } from '@neon/functions/triggers';
import { randomUUID } from 'node:crypto';
import { hasInternalToken } from './security.js';
import { scheduleDue, runOne } from './ingestion.js';
import { publish } from './publication.js';
import type { Storage } from './storage.js';
import { transaction } from './db.js';

export function createWorker(d:{pool:Pool;storage:Storage;internalToken:string;fetcher?:typeof fetch}) {
 if(d.internalToken.length<40)throw new Error('A strong internal worker credential is required');
 const app=new Hono();
 app.use('*',secureHeaders());
 app.use('*',bodyLimit({maxSize:8192}));
 app.use('*',async(c,next)=>{c.header('Cache-Control','no-store');await next();});
 app.onError((error,c)=>{
  const id=randomUUID();console.error(JSON.stringify({event:'worker_error',request_id:id,error_code:(error as {code?:string}).code||error.name}));
  return c.json({error:'worker_unavailable',request_id:id},503);
 });
 async function tick() {
  await scheduleDue(d.pool);
  await d.pool.query('SELECT atlas_control.expire_pending_reports()');
  // Deletions are at-least-once and idempotent; a crash never loses the intent.
  await transaction(d.pool,async db=>{
   const {rows}=await db.query('SELECT * FROM atlas_control.object_deletions WHERE next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20');
   for(const row of rows){try{await d.storage.remove(row.bucket,row.object_key);await db.query('DELETE FROM atlas_control.object_deletions WHERE id=$1',[row.id]);}
    catch{await db.query("UPDATE atlas_control.object_deletions SET attempts=attempts+1,next_attempt_at=now()+interval '1 hour' WHERE id=$1",[row.id]);}}
  });
  const results=[];
  // Bounded work per invocation; unclaimed work survives for the next tick.
  for(let n=0;n<5;n++){const result=await runOne(d.pool,d.storage,d.fetcher);if(!result)break;results.push(result);}
  const {rows:[current]}=await d.pool.query("SELECT id FROM atlas_mart.valid_release WHERE created_at>now()-interval '6 hours' AND created_at>=coalesce((SELECT requested_at FROM atlas_control.publication_requests WHERE singleton=true),'-infinity'::timestamptz)");
  if(!current)await publish(d.pool);
  await d.pool.query('SELECT atlas_research.evaluate_watchlists()');
  return {results};
 }
 app.post('/run',async c=>{
  if(!hasInternalToken(c.req.header('Authorization'),d.internalToken))return c.json({error:'unauthorized'},401);
  const {rows:[role]}=await d.pool.query('SELECT current_user AS role');
  if(role.role!=='atlas_worker_login')throw new Error('dedicated_worker_role_required');
  return c.json(await tick());
 });
 app.post('/cron',async c=>{
  const parsed=await parseTriggerDelivery(c.req.raw);
  if(!parsed.ok)return c.json({error:'unauthorized_trigger'},401);
  if(parsed.invocation.trigger.type!=='schedule'||parsed.invocation.trigger.name!=='atlas-hourly')return c.json({error:'unexpected_trigger'},403);
  return c.json(await tick());
 });
 app.notFound(c=>c.json({error:'not_found'},404));
 return app;
}
