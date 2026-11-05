import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPair,exportJWK,SignJWT } from 'jose';
import { tokenVerifier } from '../functions/backend/security.js';

test('JWT verification enforces signature, issuer, algorithm, subject and expiry',async()=>{
 const pair=await generateKeyPair('EdDSA'),publicKey=await exportJWK(pair.publicKey);publicKey.kid='test-key';
 const server=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[publicKey]}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=(server.address() as {port:number}).port,origin=`http://127.0.0.1:${port}`;
 try{
  const verify=tokenVerifier(origin+'/auth',origin+'/jwks');
  const mint=(issuer=origin,expiry='5m',subject='user-a')=>new SignJWT({}).setProtectedHeader({alg:'EdDSA',kid:'test-key'}).setSubject(subject).setIssuer(issuer).setIssuedAt().setExpirationTime(expiry).sign(pair.privateKey);
  assert.equal((await verify(await mint())).id,'user-a');
  await assert.rejects(verify(await mint('https://attacker.test')));
  await assert.rejects(verify(await mint(origin,'-1h')));
  await assert.rejects(verify(await mint(origin,'5m','')));
  const key=await generateKeyPair('EdDSA');
  await assert.rejects(verify(await new SignJWT({sub:'user-a'}).setProtectedHeader({alg:'EdDSA',kid:'test-key'}).setIssuer(origin).setIssuedAt().setExpirationTime('5m').sign(key.privateKey)));
  await assert.rejects(verify('invalid.token.value'));
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
