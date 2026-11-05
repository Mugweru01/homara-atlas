import { createPool } from './backend/db.js';
import { createStorage } from './backend/storage.js';
import { createWorker } from './backend/worker-app.js';
if(new URL(process.env.DATABASE_URL!).username!=='atlas_worker_login')throw new Error('Provider runtime must use the dedicated worker credential');
export default createWorker({pool:createPool(process.env.ATLAS_WORKER_DATABASE_URL),storage:createStorage(),internalToken:process.env.ATLAS_INTERNAL_TOKEN!});
