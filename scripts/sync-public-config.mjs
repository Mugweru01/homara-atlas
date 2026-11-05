import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
const variables = { VITE_API_URL: process.env.NEON_FUNCTION_ATLAS_BASE_URL, VITE_NEON_AUTH_URL: process.env.NEON_AUTH_BASE_URL, VITE_NEON_REALTIME_URL: process.env.NEON_REALTIME_URL };
const cli = `${process.env.APPDATA}/npm/node_modules/vercel/dist/index.js`;
const input = '.public-variable.local';
try {
  for (const [key, value] of Object.entries(variables)) {
    if (!value) throw new Error(`Missing ${key}`);
    let result = spawnSync('gh', ['variable','set',key,'--repo','Mugweru01/homara-atlas','--body',value], { stdio:'inherit' });
    if (result.status) process.exit(result.status);
    writeFileSync(input, JSON.stringify({ key,value,type:'plain',target:['preview','production'] }));
    result = spawnSync(process.execPath, [cli,'api','/v10/projects/prj_Vtf0rMAHj1U39pXC9iT1Hmt8gJio/env?upsert=true','--method','POST','--header','Content-Type: application/json','--input',input,'--silent','--scope','edwins-projects-f08b7343'], { stdio:'inherit' });
    if (result.status) process.exit(result.status);
  }
  console.log('Synced the three public URLs to GitHub variables and Vercel preview/production settings');
} finally { try { unlinkSync(input); } catch {} }
