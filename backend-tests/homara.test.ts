import test from 'node:test';import assert from 'node:assert/strict';
import {downloadHomara,homaraListing,homaraExportUrl}from'../functions/backend/homara.js';
const id='00000000-0000-4000-8000-000000000001',county='00000000-0000-4000-8000-000000000002';
const when='2026-01-01T12:00:00.000Z';
const row={id,county:'Nairobi City',listing_type:'rent',property_type:'Apartment - 1 Bedroom',bedrooms:1,bathrooms:1,price_amount:15000,updated_at:'2026-01-01T10:00:00.000Z'};
const response=(records:unknown[],has_more=false)=>new Response(JSON.stringify({schema_version:1,records,has_more}));
test('Homara mapping preserves monthly asking prices and county aliases without inventing dimensions',()=>{
 const r=homaraListing(row,[{id:county,name:'Nairobi'}],when);assert.equal(r.price_amount,15000);assert.equal(r.rent_period,'month');assert.equal(r.county_id,county);assert.equal(r.floor_area_sqm,null);assert.equal(r.neighbourhood,null);assert.equal(r.bathrooms,1);assert.equal(r.status_evidence,'advertisement');
 assert.throws(()=>homaraListing({...row,county:'Unknown'},[{id:county,name:'Nairobi'}],when),/unmapped_county/);
 assert.throws(()=>homaraListing({...row,listing_type:'airbnb'},[{id:county,name:'Nairobi'}],when),/invalid_enum/);
 assert.throws(()=>homaraListing({...row,property_type:'Mystery'},[{id:county,name:'Nairobi'}],when),/unmapped_property_type/);
});
test('Homara fetch has a fixed origin, secret gate and a strict projection',async()=>{
 process.env.ATLAS_HOMARA_FEED_TOKEN='a'.repeat(64);
 const data=await downloadHomara('public-test',async(url,init)=>{assert.equal(url,homaraExportUrl);assert.equal(init?.redirect,'error');assert.equal(new Headers(init?.headers).has('Authorization'),false);return response([row]);});
 assert.equal((data.value as {records:unknown[]}).records.length,1);
 await assert.rejects(downloadHomara(undefined),/not_configured/);
 await assert.rejects(downloadHomara('public-test',async()=>response([{...row,owner_id:'private'}])),/unexpected_fields/);
 await assert.rejects(downloadHomara('public-test',async()=>response([row],true)),/pagination_invalid/);
 await assert.rejects(downloadHomara('public-test',async()=>response([row,row])),/pagination_invalid/);
 await assert.rejects(downloadHomara('public-test',async()=>new Response(null,{status:302,headers:{location:'http://localhost'}})),/unavailable/);
});
