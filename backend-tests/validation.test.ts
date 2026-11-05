import test from 'node:test';
import assert from 'node:assert/strict';
import { listing,hash,pagination } from '../functions/backend/validation.js';
import { allowedDownload,parseWorldBank,parseBoundaryMetadata } from '../functions/backend/connectors.js';
import { hasInternalToken } from '../functions/backend/security.js';
import { validateManualEnvelope } from '../functions/backend/ingestion.js';

const base={source_listing_id:'rental-1',source_url:'https://partner.example/property/1',observed_at:'2026-11-05T00:00:00Z',listing_type:'rent',property_type:'apartment',county_id:'3d69da89-eaee-491d-b659-14ce3ba85399',bedrooms:0,price_amount:25000,currency:'KES',rent_period:'month',availability:'active',status_evidence:'advertisement'};
test('rental-only observation needs no invented sale value; unknown area remains null',()=>{
 const row=listing(base);assert.equal(row.bedrooms,0);assert.equal(row.price_amount,25000);assert.equal(row.floor_area_sqm,null);
 const sale=listing({...base,listing_type:'sale',rent_period:null});assert.equal(sale.rent_period,null);
});
test('reject personal/unknown fields, fabricated outcomes, invalid units, future timestamps and zero prices',()=>{
 for(const patch of [{email:'person@example.test'},{availability:'let'},{currency:'USD'},{price_amount:0},{bedrooms:-1},{observed_at:'2099-01-01T00:00:00Z'},{rent_period:'annual'},{source_url:'https://example.test/property?token=secret'}])assert.throws(()=>listing({...base,...patch}));
});
test('canonical hash ignores object key order; data changes alter its identity',()=>{
 assert.equal(hash({b:2,a:1}),hash({a:1,b:2}));assert.notEqual(hash(base),hash({...base,price_amount:24000}));
});
test('SSRF defenses reject localhost, other countries, credentials and redirect targets outside fixed source paths',()=>{
 for(const url of ['http://127.0.0.1/','https://169.254.169.254/latest/meta-data','https://api.worldbank.org.attacker.test/v2/country/KEN/indicator/SP.POP.TOTL','https://api.worldbank.org/v2/country/USA/indicator/SP.POP.TOTL','https://user:pass@api.worldbank.org/v2/country/KEN/indicator/SP.POP.TOTL','https://github.com/attacker/geoBoundaries/raw/main/data.json'])assert.throws(()=>allowedDownload(url));
 assert.ok(allowedDownload('https://api.worldbank.org/v2/country/KEN/indicator/SP.POP.TOTL?format=json'));
});
test('incomplete or license-changed upstream results cannot publish',()=>{
 assert.throws(()=>parseWorldBank([{pages:2,total:1},[]]));
 assert.throws(()=>parseBoundaryMetadata({boundaryISO:'KEN',boundaryType:'ADM1',boundaryLicense:'All Rights Reserved',admUnitCount:'47'}));
});
test('pagination and internal worker authorization reject bypasses',()=>{
 assert.throws(()=>pagination({limit:'100000'}));assert.throws(()=>pagination({offset:'-1'}));
 const secret='a'.repeat(64);assert.equal(hasInternalToken(undefined,secret),false);assert.equal(hasInternalToken('Bearer '+'b'.repeat(64),secret),false);assert.equal(hasInternalToken('Bearer '+secret,secret),true);
});
test('manual envelopes reject contact fields, nested payloads and credential-bearing URLs before persistence',()=>{
 for(const row of [{...base,phone:'+254700000000'},{...base,price_amount:{phone:'hidden'}},{...base,source_listing_id:'email@example.test'},{...base,source_url:'https://partner.example/?token=private'}])assert.throws(()=>validateManualEnvelope({records:[row]}));
 assert.throws(()=>validateManualEnvelope({records:[],owner_id:'invented'}));
 assert.doesNotThrow(()=>validateManualEnvelope({records:[base]}));
});
