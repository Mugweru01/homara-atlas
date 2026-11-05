import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [sourceId,path]=process.argv.slice(2);
if(!sourceId||!path)throw new Error('Usage: node --env-file=.env.operator.local scripts/import-listings.mjs <approved-source-uuid> <observations.json>');
const token=process.env.ATLAS_OPERATOR_TOKEN,base=process.env.NEON_FUNCTION_ATLAS_BASE_URL;
if(!token||!base)throw new Error('A signed-in operator JWT and the public Atlas API URL are required');
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId))throw new Error('A valid source UUID is required');
const target=new URL(base),allowedOrigin=process.env.ATLAS_IMPORT_ALLOWED_ORIGIN||'https://br-tiny-cake-bb448b4a-atlas.compute.c-15.us-east-1.aws.neon.tech';
if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash||!['','/'].includes(target.pathname)||target.origin!==allowedOrigin)throw new Error('Importer target must be the explicitly trusted HTTPS Atlas origin');
const bytes=await readFile(path);if(bytes.length>1024*1024)throw new Error('Maximum batch size is 1 MiB');
const parsed=JSON.parse(bytes.toString('utf8'));const body=JSON.stringify(Array.isArray(parsed)?{records:parsed}:parsed);
const key=createHash('sha256').update(body).digest('hex');
// Explicit operator-selected JSON import to the validated Atlas origin; redirects
// are forbidden so neither the selected file nor the JWT can follow another host.
const response=await fetch(new URL(`/api/v1/admin/sources/${encodeURIComponent(sourceId)}/jobs`,target),{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':`cli:${key}`},body,signal:AbortSignal.timeout(30000)});
const result=await response.json();if(!response.ok)throw new Error(`Import rejected: ${result.error||response.status}`);console.log(JSON.stringify(result));
