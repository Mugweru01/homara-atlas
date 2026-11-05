import { spawn } from 'node:child_process';
import { createCipheriv,createHash,randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir,writeFile,mkdtemp,unlink,rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import pg from 'pg';
import { S3Client,GetObjectCommand } from '@aws-sdk/client-s3';

const key=Buffer.from(process.env.ATLAS_BACKUP_KEY||'','base64');
if(key.length!==32)throw new Error('A separate 32-byte base64 ATLAS_BACKUP_KEY is required');
const url=new URL(process.env.DATABASE_URL_UNPOOLED||'');
if(url.hostname.includes('-pooler'))throw new Error('Backup requires a direct connection');
const output=process.argv[2]||`.atlas-backups.local/atlas-${new Date().toISOString().replace(/[:.]/g,'-')}.enc`;
const caDir=await mkdtemp(join(tmpdir(),'atlas-ca-')),caPath=join(caDir,'roots.pem');await writeFile(caPath,rootCertificates.join('\n'));
const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1),PGSSLMODE:'verify-full',PGSSLROOTCERT:caPath};
const db=new pg.Client({connectionString:url.toString().replace('sslmode=require','sslmode=verify-full')}),s3=new S3Client({forcePathStyle:true});
try{
 await db.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const snapshot=(await db.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
 const args=['--format=custom','--no-owner','--schema=atlas_meta','--schema=atlas_control','--schema=atlas_core','--schema=atlas_mart','--schema=atlas_security','--schema=public',`--snapshot=${snapshot}`];
 const dump=await new Promise((resolve,reject)=>{
  const child=spawn('pg_dump',args,{env,stdio:['ignore','pipe','pipe']}),chunks=[];let size=0;let failure='';
  child.stdout.on('data',b=>{size+=b.length;if(size>128*1024*1024){child.kill();reject(new Error('backup_budget_exceeded'));}else chunks.push(b);});
  child.stderr.on('data',b=>{failure+=b.toString();});child.on('error',reject);child.on('exit',code=>code?reject(new Error('pg_dump_failed: '+failure.replaceAll(decodeURIComponent(url.password),'[redacted]'))):resolve(Buffer.concat(chunks)));
 });
 const raw=(await db.query('SELECT object_key FROM atlas_control.artifacts')).rows.map(r=>({bucket:'atlasraw',key:r.object_key}));
 const reports=(await db.query("SELECT object_key FROM public.atlas_reports WHERE storage_state='ready'")).rows.map(r=>({bucket:'assets',key:r.object_key}));
 const objects=[];let size=dump.length;
 for(const item of [...raw,...reports]){
  const response=await s3.send(new GetObjectCommand({Bucket:item.bucket,Key:item.key}));
  if(!response.Body)throw new Error('backup_object_missing');const bytes=Buffer.from(await response.Body.transformToByteArray());
  size+=bytes.length;if(size>200*1024*1024)throw new Error('backup_budget_exceeded');
  objects.push({...item,sha256:createHash('sha256').update(bytes).digest('hex'),body:bytes.toString('base64')});
 }
 const payload=gzipSync(Buffer.from(JSON.stringify({version:1,created_at:new Date().toISOString(),branch:process.env.NEON_BRANCH,notice:'Atlas-owned schemas and referenced objects; managed Auth identities/config require the provider recovery process.',dump:dump.toString('base64'),objects})));
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),ciphertext=Buffer.concat([cipher.update(payload),cipher.final()]);
 const {dirname}=await import('node:path');await mkdir(dirname(output),{recursive:true});
 await writeFile(output,Buffer.concat([Buffer.from('ATLASBK1'),iv,cipher.getAuthTag(),ciphertext]),{mode:0o600});
 console.log(JSON.stringify({backup:output,object_count:objects.length,database_bytes:dump.length,encrypted_bytes:ciphertext.length,auth_identities:'provider-managed recovery, not included'}));
 await db.query('COMMIT');
}finally{await db.end();await unlink(caPath);await rmdir(caDir);}
