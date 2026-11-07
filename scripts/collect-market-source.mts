import {downloadKpc} from '../functions/backend/kpc.js';
const base='https://br-tiny-cake-bb448b4a-atlas.compute.c-15.us-east-1.aws.neon.tech/api/v1/collector/kpc';
const token=process.env.ATLAS_KPC_COLLECTOR_TOKEN;
if(!token||token.length<40)throw Error('ATLAS_KPC_COLLECTOR_TOKEN is required');
async function call(path:string,body?:unknown){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('collector_api_http_'+response.status);return response.json();}
try{
 const data=await downloadKpc();const job=await call('',data.value);
 for(let attempt=0;attempt<24;attempt++){
  const state=await call('/jobs/'+job.id);
  if(state.status==='succeeded'){console.log(JSON.stringify({event:'licensed_market_collection',...state}));process.exit(0);}
  if(['blocked','failed'].includes(state.status))throw Error('collector_job_'+state.status+':'+state.error_code);
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 throw Error('collector_job_pending');
}catch(error){const code=error instanceof Error?error.message:'collection_failed';console.error(JSON.stringify({event:'licensed_market_collection_failed',code:/^[a-z0-9_:]+$/.test(code)?code:'collection_failed'}));process.exitCode=1;}
