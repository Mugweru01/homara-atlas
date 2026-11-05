import { readFile,mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createDecipheriv,createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { rootCertificates } from 'node:tls';
import { S3Client,PutObjectCommand } from '@aws-sdk/client-s3';

// Never silently restore over production. This executable is for restore drills.
if(process.env.NEON_BRANCH!=='codex-backend-restore'||process.env.ATLAS_RESTORE_CONFIRM!=='codex-backend-restore')throw new Error('Restore drills require the exact isolated codex-backend-restore branch and confirmation env');
const path=process.argv[2];if(!path)throw new Error('Supply an encrypted Atlas backup');
const key=Buffer.from(process.env.ATLAS_BACKUP_KEY||'','base64'),file=await readFile(path);
if(key.length!==32||file.subarray(0,8).toString()!=='ATLASBK1')throw new Error('Invalid backup or key');
const decipher=createDecipheriv('aes-256-gcm',key,file.subarray(8,20));decipher.setAuthTag(file.subarray(20,36));
const payload=JSON.parse(gunzipSync(Buffer.concat([decipher.update(file.subarray(36)),decipher.final()]),{maxOutputLength:300*1024*1024}).toString('utf8'));
if(payload.version!==1||!Array.isArray(payload.objects))throw new Error('Invalid backup format');
const url=new URL(process.env.DATABASE_URL_UNPOOLED||'');
if(url.hostname.includes('-pooler'))throw new Error('A direct restore URL is required');
const {execFileSync}=await import('node:child_process');
const cli=join(process.env.APPDATA||'', 'npm/node_modules/neon/dist/cli.js');
const expected=new URL(execFileSync(process.execPath,[cli,'connection-string','--branch','codex-backend-restore','--database-name',url.pathname.slice(1),'--role-name',decodeURIComponent(url.username)],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim());
if(expected.hostname!==url.hostname)throw new Error('Restore database does not belong to the isolated restore branch');
const branch=JSON.parse(execFileSync(process.execPath,[cli,'branches','get','codex-backend-restore','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const storageUrl=new URL(process.env.AWS_ENDPOINT_URL_S3||'');
if(storageUrl.protocol!=='https:'||!storageUrl.hostname.startsWith(branch.id+'.storage.')||!storageUrl.hostname.endsWith('.neon.tech'))throw new Error('Restore storage does not belong to the isolated restore branch');
const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1),PGSSLMODE:'verify-full',PGSSLROOTCERT:'system'};
const dir=await mkdtemp(join(tmpdir(),'atlas-restore-')),dump=join(dir,'atlas.dump'),s3=new S3Client({forcePathStyle:true});
try{
 const caPath=join(dir,'roots.pem');await writeFile(caPath,rootCertificates.join('\n'));env.PGSSLROOTCERT=caPath;
 await writeFile(dump,Buffer.from(payload.dump,'base64'),{mode:0o600});
 // Managed cloud_admin default ACLs are not ours to restore. Keep Atlas table ACLs.
 const toc=execFileSync('pg_restore',['--list',dump],{encoding:'utf8'}).split('\n').filter(line=>!line.includes('DEFAULT ACL')).join('\n');
 const listPath=join(dir,'restore.list');await writeFile(listPath,toc);
 await new Promise((done,fail)=>{
  const child=spawn('pg_restore',['--clean','--if-exists','--no-owner','--exit-on-error','--single-transaction','--use-list',listPath,'--dbname',url.pathname.slice(1),dump],{env,stdio:['ignore','pipe','pipe']});
  let errors='';child.stdout.resume();child.stderr.on('data',b=>{if(errors.length<20000)errors+=b.toString();});
  child.on('error',fail);child.on('exit',code=>code?fail(new Error('pg_restore_failed: '+errors.replaceAll(decodeURIComponent(url.password),'[redacted]'))):done());
 });
 for(const item of payload.objects){
  if(!['assets','atlasraw'].includes(item.bucket)||typeof item.key!=='string'||!item.key.startsWith(item.bucket==='assets'?'reports/':'sources/'))throw new Error('Invalid object manifest');
  const body=Buffer.from(item.body,'base64');if(createHash('sha256').update(body).digest('hex')!==item.sha256)throw new Error('Backup checksum mismatch');
  await s3.send(new PutObjectCommand({Bucket:item.bucket,Key:item.key,Body:body,ContentType:item.bucket==='assets'?'text/plain; charset=utf-8':'application/gzip'}));
 }
 console.log(JSON.stringify({restored_branch:process.env.NEON_BRANCH,objects:payload.objects.length,source_created_at:payload.created_at}));
}finally{
 const target=resolve(dir),base=resolve(tmpdir());
 if(!target.startsWith(base+requireSeparator())||!target.split(requireSeparator()).pop().startsWith('atlas-restore-'))throw new Error('Unsafe temporary cleanup target');
 await rm(target,{recursive:true,force:true});
}
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
