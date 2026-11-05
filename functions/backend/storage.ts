import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface Storage {
  put(bucket:string,key:string,body:Uint8Array,contentType:string):Promise<void>;
  get(bucket:string,key:string):Promise<Uint8Array>;
  remove(bucket:string,key:string):Promise<void>;
  exists(bucket:string,key:string):Promise<boolean>;
  url(bucket:string,key:string):Promise<string>;
}
export function createStorage():Storage {
  const s3=new S3Client({forcePathStyle:true});
  return {
    async put(bucket,key,body,contentType){await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:contentType,CacheControl:'private, no-store'}));},
    async get(bucket,key){const r=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));if(!r.Body)throw new Error('missing_object');return r.Body.transformToByteArray();},
    async remove(bucket,key){await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));},
    async exists(bucket,key){try{await s3.send(new HeadObjectCommand({Bucket:bucket,Key:key}));return true;}catch(e){if((e as {name:string}).name==='NotFound')return false;throw e;}},
    async url(bucket,key){return getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:key,ResponseContentDisposition:'attachment',ResponseContentType:'text/plain; charset=utf-8'}),{expiresIn:60});},
  };
}
