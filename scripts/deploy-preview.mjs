import { spawnSync } from 'node:child_process';
const args = ['deploy', '--yes', '--scope', 'edwins-projects-f08b7343'];
for (const [key, value] of Object.entries({ VITE_API_URL: process.env.NEON_FUNCTION_ATLAS_BASE_URL, VITE_NEON_AUTH_URL: process.env.NEON_AUTH_BASE_URL, VITE_NEON_REALTIME_URL: process.env.NEON_REALTIME_URL })) {
  if (!value) throw new Error(`Missing ${key}`);
  args.push('--build-env', `${key}=${value}`);
}
// Call Node's CLI entry directly so no shell quoting or interpolation is involved.
const result = spawnSync(process.execPath, [`${process.env.APPDATA}/npm/node_modules/vercel/dist/index.js`, ...args], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
