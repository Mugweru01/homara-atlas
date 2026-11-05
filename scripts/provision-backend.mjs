import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';

const branch=process.env.NEON_BRANCH;
const output=process.argv[2];
if(!branch||!output||!output.endsWith('.local'))throw new Error('Load the selected branch env file and supply an ignored output .local file');
const invoke=args=>process.platform==='win32'
 ? execFileSync(process.execPath,[`${process.env.APPDATA}/npm/node_modules/neon/dist/cli.js`,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
 : execFileSync('neon',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const common=['--project-id','withered-cell-31446643','--branch',branch];
let roles=JSON.parse(invoke(['roles','list',...common,'--output','json']));
roles=Array.isArray(roles)?roles:roles.roles;
for(const name of ['atlas_api_login','atlas_worker_login']){
 if(!roles.some(role=>role.name===name))invoke(['roles','create','--name',name,'--access','read_only','--schema','atlas_mart',...common,'--output','json']);
}
const db=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED?.replace('sslmode=require','sslmode=verify-full')});
try{
 await db.connect();
 await db.query('GRANT atlas_api TO atlas_api_login');
 await db.query('GRANT atlas_worker TO atlas_worker_login');
 const {rows}=await db.query("SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,pg_has_role(rolname,'neon_superuser','member') admin FROM pg_roles WHERE rolname IN ('atlas_api_login','atlas_worker_login')");
 if(rows.length!==2||rows.some(r=>r.rolsuper||r.rolcreaterole||r.rolcreatedb||r.admin))throw new Error('Runtime roles must not have administrative privileges');
}finally{await db.end();}
const values={};
for(const [key,role] of [['ATLAS_API_DATABASE_URL','atlas_api_login'],['ATLAS_WORKER_DATABASE_URL','atlas_worker_login']]){
 values[key]=invoke(['connection-string',branch,'--project-id','withered-cell-31446643','--role-name',role,'--pooled']).trim();
 if(!/^postgres(?:ql)?:\/\//.test(values[key]))throw new Error('Could not obtain the dedicated role connection');
}
// Preserve independently generated application secrets when re-running setup.
let existing='';try{existing=await readFile(output,'utf8');}catch{}
for(const key of ['ATLAS_INTERNAL_TOKEN','ATLAS_RATE_LIMIT_SECRET'])values[key]=existing.match(new RegExp(`^${key}=(.+)$`,'m'))?.[1]||randomBytes(32).toString('hex');
values.ATLAS_WORKER_BASE_URL=`https://${branch==='production'?'br-tiny-cake-bb448b4a':process.env.ATLAS_BRANCH_ID}-worker.compute.c-15.us-east-1.aws.neon.tech`;
values.ATLAS_ALLOWED_ORIGINS='http://localhost:5184,http://127.0.0.1:5184,http://localhost:8080,https://atlas.homara.co.ke,https://homara-atlas.vercel.app,https://homara-atlas-i8styuatl-edwins-projects-f08b7343.vercel.app';
await writeFile(output,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
console.log(`Provisioned non-admin runtime roles on ${branch}; wrote ignored credentials to ${output}`);
