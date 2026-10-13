import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { catalog } from '../../artifacts/api-server/src/data/catalog';
import { searchCatalog } from '../../lib/catalog-search';
import { extractMarketResult, sourceUrl, lookupMarket, type MarketResult } from '../../artifacts/api-server/src/lib/market-search';
import { marketProductFromEvidence, marketProductPhoto } from '../../artifacts/api-server/src/lib/market-products';

const source = { title:'Sony Alpha ILCE-7M4M camera lens kit', url:'https://shopatsc.com/products/ilce-7m4m-bq-in5' };
const evidence: MarketResult = {status:'used',checkedAt:'2026-10-13T10:00:00Z',sources:[source],evidence:'Sony Alpha ILCE-7M4M camera lens kit is listed at ₹1,83,990 by Sony Center India. Retailer checkout prices may change.'};
const candidate = { name:'Sony Alpha ILCE-7M4M',brand:'Sony',category:'Cameras',priceInr:183990,priceQuote:'₹1,83,990',sourceIndex:1,specs:['33MP full-frame camera'],description:'Camera lens kit listed by Sony Center India.' };
const root = resolve(import.meta.dirname,'../..');

test('expanded catalog has unique IDs, positive INR prices, source dates and real local photos',()=>{
  assert.equal(catalog.length,114);
  assert.equal(new Set(catalog.map(p=>p.id)).size,catalog.length);
  for(const product of catalog){
    assert.ok(product.price>0);
    assert.ok(product.priceSource.url.startsWith('https://'));
    assert.ok(product.priceSource.asOf);
    assert.ok(existsSync(resolve(root,'artifacts/circuit-house/public'+product.image)));
  }
});

test('model searches match spacing, multiple words, category terms and INR budgets',()=>{
  assert.ok(searchCatalog(catalog,'DJI Osmo Pocket3').some(p=>p.name.includes('Pocket 3')));
  const under=searchCatalog(catalog,'osmo camera under 50k');
  assert.ok(under.length>0);
  assert.ok(under.every(p=>p.price<=50000&&p.category==='Cameras'));
  assert.ok(searchCatalog(catalog,'Sony WH CH720N').some(p=>p.name==='Sony WH-CH720N'));
  assert.ok(searchCatalog(catalog,'tv above 1 lakh').every(p=>p.price>=100000));
  assert.equal(searchCatalog(catalog,'nonexistent test model').length,0);
});

test('only HTTPS citations from real retailer/manufacturer hosts are accepted',()=>{
  assert.ok(sourceUrl(source.url));
  for(const url of ['http://amazon.in/p','https://amazon.in.evil.example/p','https://user:pass@amazon.in/p','https://127.0.0.1/p','javascript:alert(1)'])assert.equal(sourceUrl(url),null);
});

test('market status requires completed search, completed response and actual citations',()=>{
  assert.equal(extractMarketResult({status:'completed',output:[]}).status,'not-needed');
  assert.equal(extractMarketResult({status:'incomplete',output:[{type:'web_search_call',status:'completed'}]}).status,'unavailable');
  assert.equal(extractMarketResult({status:'completed',output_text:'Unverified price',output:[{type:'web_search_call',status:'completed'}]}).status,'unavailable');
  const result=extractMarketResult({status:'completed',output_text:evidence.evidence,output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',annotations:[{type:'url_citation',...source},{type:'url_citation',...source}]}]}]},new Date(evidence.checkedAt!));
  assert.equal(result.status,'used');assert.equal(result.sources.length,1);assert.equal(result.checkedAt,new Date(evidence.checkedAt!).toISOString());
});

test('a sourced outside-catalog listing becomes a stable, cart-compatible product snapshot',()=>{
  assert.ok(!catalog.some(p=>p.name===candidate.name));
  const product=marketProductFromEvidence(candidate,evidence)!;
  assert.ok(product.id.startsWith('market-'));assert.equal(product.origin,'market');assert.equal(product.price,183990);
  assert.equal(product.priceSource.url,source.url);
  assert.equal(product.id,marketProductFromEvidence(candidate,evidence)!.id);
  assert.ok(marketProductFromEvidence({...candidate,priceQuote:'₹183990'},evidence));
  const restored=JSON.parse(JSON.stringify([{product,quantity:2}]));
  assert.equal(restored[0].product.price*restored[0].quantity,367980);
  assert.equal(restored[0].product.origin,'market');
});

test('unsupported external products, invented prices and missing sources are rejected',()=>{
  for(const invalid of [{...candidate,priceInr:1},{...candidate,priceQuote:'₹12,345'},{...candidate,sourceIndex:2},{...candidate,name:'Invented camera model'},{...candidate,category:'Anything'}])assert.equal(marketProductFromEvidence(invalid,evidence),null);
  assert.equal(marketProductFromEvidence(candidate,{...evidence,status:'unavailable'}),null);
  assert.equal(marketProductFromEvidence(candidate,{...evidence,sources:[]}),null);
  for (const url of ['https://www.croma.com/accessories/dslr-cameras/c/6849','https://www.flipkart.com/cameras/pr?q=sony','https://shopatsc.com/collections/cameras']) {
    assert.equal(marketProductFromEvidence(candidate,{...evidence,sources:[{...source,url}]}),null);
  }
});

test('web search uses the existing model, India location, domain filters and a bounded timeout',async()=>{
  let seen:any,options:any;
  const client={responses:{create:async(input:any,config:any)=>{seen=input;options=config;return {status:'completed',output:[]}}}};
  await lookupMarket(client as Parameters<typeof lookupMarket>[0],'Osmo current price',[],catalog.map(p=>p.name));
  assert.equal(seen.model,'gpt-5-mini');assert.equal(seen.store,false);assert.equal(seen.tools[0].user_location.country,'IN');
  assert.equal(seen.tool_choice,'required');
  assert.ok(seen.tools[0].filters.allowed_domains.includes('flipkart.com'));assert.equal(options.maxRetries,0);assert.equal(options.timeout,25000);
});

test('external photo comes from product-page metadata, never a model URL',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response('<head><meta property="og:image" content="https://cdn.shopify.com/s/files/test-camera.jpg"></head>',{status:200});
  try{assert.equal(await marketProductPhoto(source.url),'https://cdn.shopify.com/s/files/test-camera.jpg');assert.equal(await marketProductPhoto('https://example.invalid/product'),null);}finally{globalThis.fetch=original;}
});

test('original catalog image bytes remain unchanged',()=>{
  const path=resolve(root,'tmp/original-image-hashes.json');
  if(!existsSync(path))return;
  const baseline=JSON.parse(readFileSync(path,'utf8')) as Record<string,string>;
  assert.equal(Object.keys(baseline).length,54);
  for(const [file,hash] of Object.entries(baseline))assert.equal(createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex'),hash);
});
