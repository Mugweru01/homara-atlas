import type {Hono,MiddlewareHandler} from 'hono';
import {HTTPException} from 'hono/http-exception';
import type {Dependencies,Variables} from './app.js';
import {hasInternalToken,rateLimit} from './security.js';
import {transaction} from './db.js';
import {validateKpcEnvelope} from './kpc.js';
import {hash,uuid} from './validation.js';
export function registerSourcePush(app:Hono<{Variables:Variables}>,d:Dependencies){
 const base='/api/v1/collector/kpc';
 const auth:MiddlewareHandler<{Variables:Variables}>=async(c,next)=>{if(!hasInternalToken(c.req.header('Authorization'),d.collectorToken||''))throw new HTTPException(401,{message:'unauthorized'});await rateLimit(d.pool,d.rateSecret,'kpc-source-push',30);await next();};
 app.use(base,auth);app.use(base+'/*',auth);
 const source=async()=>{const s=(await d.pool.query("SELECT id FROM atlas_control.sources WHERE slug='kpc-market-statistics' AND driver='kpc_market' AND collection_transport='source_push' AND status='active' AND publication_allowed AND (rights_expire_at IS NULL OR rights_expire_at>now()) AND (not_before_at IS NULL OR not_before_at<=now())")).rows[0];if(!s)throw new HTTPException(409,{message:'source_not_approved_or_paused'});return s.id as string;};
 app.post(base,async c=>{
  const id=await source(),value=validateKpcEnvelope(await c.req.json());
  const digest=hash(value);
  const job=await transaction(d.pool,async db=>{
   await db.query('SELECT id FROM atlas_control.sources WHERE id=$1 FOR UPDATE',[id]);
   const existing=(await db.query('SELECT id,status FROM atlas_control.jobs WHERE source_id=$1 AND idempotency_key=$2',[id,'source-push:'+digest])).rows[0];if(existing)return existing;
   const pending=(await db.query("SELECT count(*)::int n FROM atlas_control.jobs WHERE source_id=$1 AND status IN ('queued','retry','running')",[id])).rows[0].n;if(pending>=5)throw new HTTPException(429,{message:'collector_queue_full'});
   return(await db.query("INSERT INTO atlas_control.jobs(source_id,idempotency_key,payload,requested_by,request_hash) VALUES($1,$2,$3,'system:kpc-source-push',$4) RETURNING id,status",[id,'source-push:'+digest,JSON.stringify(value),digest])).rows[0];
  });d.kick?.();return c.json(job,202);
 });
 app.get(base+'/jobs/:id',async c=>{const id=await source(),job=(await d.pool.query("SELECT id,status,error_code,received_count,accepted_count,duplicate_count FROM atlas_control.jobs WHERE id=$1 AND source_id=$2 AND requested_by='system:kpc-source-push'",[uuid(c.req.param('id')||''),id])).rows[0];if(!job)throw new HTTPException(404,{message:'not_found'});d.kick?.();return c.json(job);});
}
