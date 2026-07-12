/**
 * Build-time environment variable validation
 * This script runs before the build to ensure all required environment variables are set
 */

const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const optionalEnvVars = [
  'VITE_UPSTASH_REDIS_REST_URL',
  'VITE_UPSTASH_REDIS_REST_TOKEN',
];

const missingVars: string[] = [];

console.log('🔍 Validating environment variables...');

// Check required variables
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these variables in your .env.local file or CI/CD secrets.');
  process.exit(1);
}

console.log('✅ All required environment variables are set');

// Log optional variables status
optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName} is set`);
  } else {
    console.log(`⚠️  ${varName} is not set (optional)`);
  }
});

console.log('\n✨ Environment validation passed!');
