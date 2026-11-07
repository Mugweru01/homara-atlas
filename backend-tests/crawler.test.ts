import test from 'node:test';import assert from 'node:assert/strict';
import {publicAddress,crawlUrl,robotsAllowed,jsonLd,htmlReferences} from '../functions/backend/crawl-http.js';
import {parseWebListings} from '../functions/backend/listing-crawler.js';
import {parseKpc,kpcOrigin,kpcPath} from '../functions/backend/kpc.js';
const county='00000000-0000-4000-8000-000000000001';
const config={origin:'https://agency.example',path_prefix:'/properties',seed_paths:['/properties'],listing_type:'rent' as const,max_pages:2};
const product={'@type':'Product',category:'apartment',sku:'advert-42',url:'https://agency.example/properties/42/',address:{addressRegion:'Nairobi',streetAddress:'DO NOT IMPORT'},numberOfBedrooms:2,numberOfBathroomsTotal:1,description:'DO NOT IMPORT phone and contacts',seller:{email:'do-not-copy@example.test'},image:'https://images.example/private.jpg',offers:{price:'25000',priceCurrency:'KES',priceSpecification:{unitCode:'MON'},availability:'https://schema.org/InStock'}};
const html=(v:unknown)=>'<script type="application/ld+json">'+JSON.stringify(v)+'</script>';
test('crawl network guards deny private/reserved addresses and out-of-scope URLs',()=>{
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.31.1.1','100.100.100.200','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1','2001::1','2002:7f00:1::','3fff::1'])assert.equal(publicAddress(address),false,address);
 for(const address of ['8.8.8.8','1.1.1.1','2606:4700::1111','2001:4860:4860::8888'])assert.equal(publicAddress(address),true,address);
 for(const url of ['http://agency.example/properties/42','https://user:pass@agency.example/properties/42','https://agency.example.attacker.test/properties/42','https://agency.example/admin','https://agency.example/properties%2fadmin','https://127.0.0.1/properties/42'])assert.throws(()=>crawlUrl(url,config.origin,[config.path_prefix],['agency.example']));
 assert.throws(()=>crawlUrl(product.url,config.origin,[config.path_prefix],[]));assert.equal(crawlUrl(product.url,config.origin,[config.path_prefix],['agency.example']).hostname,'agency.example');
 assert.throws(()=>crawlUrl('https://[::1]/properties','https://[::1]',['/properties'],['[::1]']));assert.equal(publicAddress('168.63.129.16'),false);
});
test('robots rules apply before crawling, with specific agents, wildcard paths and Allow tie breaks',()=>{
 const robots='User-agent: OtherBot\nDisallow: /\nUser-agent: *\nDisallow: /properties/private\nAllow: /properties/private/public\nDisallow: *token=*\n';
 assert.equal(robotsAllowed(robots,'/properties/42'),true);assert.equal(robotsAllowed(robots,'/properties/private/42'),false);assert.equal(robotsAllowed(robots,'/properties/private/public/42'),true);assert.equal(robotsAllowed(robots,'/properties/42?token=x'),false);assert.equal(robotsAllowed(robots,'/properties/42','OtherBot'),false);
});
test('HTML parser never executes scripts; listing extraction discards contacts, images, descriptions and addresses',()=>{
 const parsed=parseWebListings('<script>throw new Error("never execute")</script>'+html(product),product.url,config,[{id:county,name:'Nairobi'}],new Date().toISOString());
 assert.equal(parsed.records.length,1);const row=parsed.records[0];assert.equal(row.source_listing_id,'advert-42');assert.equal(row.source_url,'https://agency.example/properties/42');assert.equal(row.price_amount,25000);assert.equal(row.rent_period,'month');assert.ok(!JSON.stringify(parsed).includes('DO NOT IMPORT'));assert.ok(!JSON.stringify(parsed).includes('do-not-copy'));assert.ok(!JSON.stringify(parsed).includes('private.jpg'));
 const noId={...product,sku:undefined};assert.equal(parseWebListings(html(noId),product.url,config,[{id:county,name:'Nairobi'}],new Date().toISOString()).issues[0],'missing_stable_advertisement_id');
 assert.equal(parseWebListings(html({...product,offers:{...product.offers,priceSpecification:{unitCode:'DAY'}}}),product.url,config,[{id:county,name:'Nairobi'}],new Date().toISOString()).issues[0],'unconfirmed_rent_period');
 assert.throws(()=>jsonLd(html({})+html('{not json').replace('"{not json"','{not json')),/invalid_jsonld/);
 assert.equal(htmlReferences('<a href="/properties?page=2&amp;sort=price">next</a>').links[0],'/properties?page=2&sort=price');
});
const dataset=(type:string,value:number)=>({'@type':'Dataset',url:kpcOrigin+kpcPath+'/'+type,creator:{name:'Kenya Property Centre'},license:'https://creativecommons.org/licenses/by/4.0/',temporalCoverage:'2026-09-01/2026-10-31',measurementTechnique:'Publisher monthly asking-price method, not completed transactions.',variableMeasured:[{unitText:'KES',value}]});
test('licensed report parser preserves reference month, exact numbers and scope; schema/licence changes block ingestion',()=>{
 const types=['for-rent','for-sale','for-rent/short-let'];const page=types.map((t,i)=>html(dataset(t,(i+1)*10000))+`<table><tr data-sort-name="Nairobi" data-sort-figure="${(i+1)*12000.25}" data-sort-listings="24"><td><a href="${kpcOrigin}${kpcPath}/${t}/nairobi">Nairobi</a></td></tr></table>`).join('');
 const rows=parseKpc(page);assert.equal(rows.length,6);assert.equal(rows[0].period_start,'2026-10-01');assert.equal(rows[0].period_end,'2026-10-31');assert.equal(rows.find(r=>r.geography==='Nairobi'&&r.market_type==='rent')?.median_price,12000.25);assert.equal(rows.find(r=>r.geography==='Nairobi')?.sample_count,24);assert.equal(rows[0].sample_count,null);
 assert.throws(()=>parseKpc(page.replaceAll('https://creativecommons.org/licenses/by/4.0/','All rights reserved')),/license_or_schema_changed/);assert.throws(()=>parseKpc(page.replace('data-sort-figure="12000.25"','data-sort-figure="NaN"')),/schema_changed/);assert.throws(()=>parseKpc(html(dataset('for-rent',1))),/incomplete_source_response/);
});
