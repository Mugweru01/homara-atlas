import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const origin='https://br-tiny-cake-bb448b4a-atlas.compute.c-15.us-east-1.aws.neon.tech';
const source='123e4567-e89b-42d3-a456-426614174000';
const run=(base:string,extra:Record<string,string>={})=>spawnSync(process.execPath,['scripts/import-listings.mjs',source,'nonexistent-import-fixture.json'],{encoding:'utf8',env:{...process.env,ATLAS_OPERATOR_TOKEN:'test-only-not-a-real-token',NEON_FUNCTION_ATLAS_BASE_URL:base,ATLAS_IMPORT_ALLOWED_ORIGIN:origin,...extra}});
test('importer rejects untrusted or credential-bearing targets before reading a selected file',()=>{
 for(const target of [origin.replace('https:','http:'),'https://attacker.example',origin+'/another-path',origin+'?token=private',origin+'#fragment',origin.replace('https://','https://user:password@')]){
  const result=run(target);assert.notEqual(result.status,0);assert.match(result.stderr,/explicitly trusted HTTPS Atlas origin/);assert.doesNotMatch(result.stderr,/ENOENT/);
 }
});
test('importer accepts only its default origin or an explicit trusted branch override',()=>{
 assert.match(run(origin).stderr,/ENOENT/);
 const branch='https://trusted-preview.example';assert.match(run(branch,{ATLAS_IMPORT_ALLOWED_ORIGIN:branch}).stderr,/ENOENT/);
 assert.match(run('http://trusted-preview.example',{ATLAS_IMPORT_ALLOWED_ORIGIN:'http://trusted-preview.example'}).stderr,/explicitly trusted HTTPS Atlas origin/);
});
