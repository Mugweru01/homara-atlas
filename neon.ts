import { defineConfig } from '@neon/config/v1';

const origins=(process.env.ATLAS_ALLOWED_ORIGINS || 'http://localhost:5184,http://127.0.0.1:5184,http://localhost:8080,https://atlas.homara.co.ke,https://homara-atlas-i8styuatl-edwins-projects-f08b7343.vercel.app').split(',');
export default defineConfig({
 preview:{realtime:{allowedOrigins:origins}},
 auth:true,
 functions:{
  atlas:{name:'Atlas API',source:'./functions/atlas.ts',env:{
   ATLAS_API_DATABASE_URL:process.env.ATLAS_API_DATABASE_URL!,
   DATABASE_URL:process.env.ATLAS_API_DATABASE_URL!,
   DATABASE_URL_UNPOOLED:process.env.ATLAS_API_DATABASE_URL!,
   ATLAS_RATE_LIMIT_SECRET:process.env.ATLAS_RATE_LIMIT_SECRET!,
   ATLAS_INTERNAL_TOKEN:process.env.ATLAS_INTERNAL_TOKEN!,
   ATLAS_WORKER_BASE_URL:process.env.ATLAS_WORKER_BASE_URL!,
   ATLAS_ALLOWED_ORIGINS:origins.join(','),
   NEON_REALTIME_SECRET:process.env.NEON_REALTIME_SECRET!,
  }},
  worker:{name:'Atlas durable ingestion worker',source:'./functions/worker.ts',env:{
   ATLAS_WORKER_DATABASE_URL:process.env.ATLAS_WORKER_DATABASE_URL!,
   DATABASE_URL:process.env.ATLAS_WORKER_DATABASE_URL!,
   DATABASE_URL_UNPOOLED:process.env.ATLAS_WORKER_DATABASE_URL!,
   ATLAS_INTERNAL_TOKEN:process.env.ATLAS_INTERNAL_TOKEN!,
  }},
 },
 buckets:{assets:{access:'private'},atlasraw:{access:'private'}},
 triggers:{'atlas-hourly':{type:'schedule',function:'worker',functionPath:'/cron',cron:'0 * * * *',enabled:process.env.NEON_BRANCH==='production'}},
 branch:branch=>!branch.isDefault&&!branch.exists?{ttl:'1d'}:{},
});
