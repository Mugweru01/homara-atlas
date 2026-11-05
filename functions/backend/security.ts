import { createHmac, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Pool } from 'pg';
import { HTTPException } from 'hono/http-exception';
export type Principal={id:string};
export function tokenVerifier(baseUrl:string,jwksUrl:string) {
 const jwks=createRemoteJWKSet(new URL(jwksUrl),{timeoutDuration:5000});
 return async (token:string):Promise<Principal>=>{
  const {payload}=await jwtVerify(token,jwks,{issuer:new URL(baseUrl).origin,algorithms:['EdDSA'],requiredClaims:['sub','exp','iat'],clockTolerance:5});
  if(!payload.sub||payload.sub.length>200)throw new Error('invalid_subject');return {id:payload.sub};
 };
}
export function hasInternalToken(header:string|undefined,expected:string) {
 if(!header?.startsWith('Bearer ')||expected.length<40)return false;
 const a=Buffer.from(header.slice(7)),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function rateLimit(pool:Pool,secret:string,bucket:string,limit:number) {
 const key=createHmac('sha256',secret).update(bucket).digest('hex');
 const {rows:[row]}=await pool.query('SELECT atlas_security.take_rate_limit($1,$2) AS allowed',[key,limit]);
 if(!row.allowed)throw new HTTPException(429,{message:'rate_limit_exceeded'});
}
