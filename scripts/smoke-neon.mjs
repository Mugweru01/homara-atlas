import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createRealtimeClient } from '@neon/realtime/client';
const base = process.env.NEON_FUNCTION_ATLAS_BASE_URL.replace(/\/$/, '');
const auth = process.env.NEON_AUTH_BASE_URL.replace(/\/$/, '');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL?.replace('sslmode=require','sslmode=verify-full') });
const s3 = new S3Client({ forcePathStyle: true });
const created = []; const objects = []; let live;
async function identity() {
  let cookies = new Map();
  async function call(path, body) {
    const response = await fetch(`${auth}/${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8080', Cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; ') },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const index = pair.indexOf('='); cookies.set(pair.slice(0,index), pair.slice(index+1)); }
    const result = await response.json();
    assert.ok(response.ok, `Auth ${path}: ${response.status} ${JSON.stringify(result)}`);
    return result;
  }
  const email = `atlas-smoke-${randomUUID()}@example.test`;
  const password = `${randomUUID()}Aa!`;
  const signed = await call('sign-up/email', { email, password, name: 'Atlas integration check' });
  const userId = signed.user.id; created.push(userId);
  await call('sign-out', {});
  const signIn = await call('sign-in/email', { email, password });
  assert.equal(signIn.user.id, userId);
  const session = await call('get-session'); assert.equal(session.user.id, userId);
  const tokenResult = await call('token'); assert.ok(tokenResult.token);
  return { userId, token: tokenResult.token, async refresh(){this.token=(await call('token')).token;},signOut: () => call('sign-out', {}) };
}
async function api(path, token, body) {
  return fetch(`${base}/api/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
}
try {
  await db.connect();
  const health = await api('system/health'); assert.equal(health.status, 200); console.log('PASS deployed Function health');
  assert.equal((await api('system/ready')).status,200);
  const counties=await (await api('geography/counties')).json();assert.equal(counties.results.length,47);
  const dataHealth=await (await api('system/data-health')).json();assert.equal(dataHealth.status,'current');
  console.log('PASS dedicated API role readiness, 47 counties and current source collections');
  const worker=process.env.ATLAS_WORKER_BASE_URL;
  if(worker){
    assert.equal((await fetch(worker+'/run',{method:'POST'})).status,401);
    const invocation=randomUUID();const forged=await fetch(worker+'/cron',{method:'POST',headers:{'Content-Type':'application/json','x-neon-trigger-invocation-id':invocation},body:JSON.stringify({version:1,invocation_id:invocation,trigger:{type:'schedule',name:'atlas-hourly',id:'forged'},data:{scheduled_at:new Date().toISOString()}})});
    assert.equal(forged.status,401);console.log('PASS public worker execution and forged trigger headers rejected');
  }
  const overview = await api('analytics/overview'); assert.equal(overview.status, 200); console.log('PASS PostgreSQL analytics read');
  assert.equal((await api('workspace/reports')).status, 401);
  assert.equal((await api('workspace/reports', 'invalid')).status, 401); console.log('PASS anonymous and invalid-token rejection');
  const one = await identity(); const two = await identity(); console.log('PASS two-user signup, signout, signin and session restoration');
  await one.refresh();await two.refresh();
  assert.equal((await api('admin/jobs',one.token)).status,403);console.log('PASS authenticated non-operator denied ingestion access');
  const sealedResponse = await api('workspace/reports/live', one.token, {}); assert.equal(sealedResponse.status, 200);
  live = createRealtimeClient({ url: process.env.NEON_REALTIME_URL });
  const subscription = live.subscribe(await sealedResponse.json());
  let expectedId;
  let resolveObserved;
  const observed = new Promise(resolve => { resolveObserved = resolve; });
  subscription.onChange(snapshot => { if (expectedId && snapshot.data.some(item => item.id === expectedId)) resolveObserved(); });
  const initial = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Realtime initial result timed out')), 30000);
    subscription.onStateChange(state => { if (state.status === 'live') { clearTimeout(timer); resolve(); } if (state.status === 'error') { clearTimeout(timer); reject(new Error('Realtime subscription failed: '+JSON.stringify(state.error))); } });
  });
  await initial;
  const content = 'Atlas integration verification report';
  const save = await api('workspace/reports', one.token, { title: 'Integration verification', content });
  assert.equal(save.status, 201, await save.clone().text());
  const report = await save.json(); expectedId = report.id;
  objects.push(`reports/${one.userId}/${report.id}.txt`);
  // A snapshot can arrive before the POST response.
  if (subscription.getSnapshot().data.some(item => item.id === expectedId)) resolveObserved();
  await Promise.race([observed, new Promise((_,reject) => setTimeout(() => reject(new Error('Committed Realtime update timed out')),30000))]);
  console.log('PASS report write observed by Realtime subscription');
  await one.refresh();await two.refresh();
  const download = await api(`workspace/reports/${report.id}`, one.token); assert.equal(download.status, 200);
  const { url } = await download.json(); assert.equal(await (await fetch(url)).text(), content); console.log('PASS private object upload/download');
  assert.equal((await api(`workspace/reports/${report.id}`, two.token)).status, 404);
  assert.equal((await (await api('workspace/reports', two.token)).json()).length, 0); console.log('PASS cross-user report isolation');
  assert.equal((await api('workspace/reports', one.token, { title: '', content })).status, 400); console.log('PASS invalid report rejection');

  const deleted=await fetch(`${base}/api/v1/workspace/reports/${report.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${one.token}`}});assert.equal(deleted.status,204);
  assert.equal((await api(`workspace/reports/${report.id}`,one.token)).status,404);console.log('PASS report deletion and durable cleanup intent');

  await one.signOut(); await two.signOut();
} finally {
  live?.close();
  for (const key of objects) await s3.send(new DeleteObjectCommand({ Bucket: 'assets', Key: key }));
  for (const id of created) {
    await db.query('DELETE FROM atlas_reports WHERE owner_id=$1', [id]);
    await db.query('DELETE FROM neon_auth."user" WHERE id=$1', [id]);
  }
  await db.end();
  console.log('Cleaned integration test accounts and reports');
}

