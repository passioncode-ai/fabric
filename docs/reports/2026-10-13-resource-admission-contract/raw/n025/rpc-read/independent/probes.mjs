import assert from 'node:assert/strict';import {fixture} from './fixture-base.mjs';import {pathToFileURL} from 'node:url';
const {createResourcePoolPublisher}=await import(pathToFileURL(process.env.N025_SOURCE));
let checks=0;
function setup(){const f=fixture({existing:true});let readHook=null;const db={rpc:async(name,args)=>{if(name==='read_resource_pool'){assert.deepEqual(args,{p_host:'host',p_pool:'pool'});f.reads++;return readHook?await readHook():{data:structuredClone(f.row),error:null}}}};db.rpc=(()=>{const read=db.rpc;return async(name,args)=>name==='read_resource_pool'?read(name,args):f.deps.db.rpc(name,args)})();Object.defineProperty(db,'from',{get(){throw Error('generic table fallback forbidden')}});return {f,p:createResourcePoolPublisher({...f.deps,db}),hook(fn){readHook=fn}}}
{
 const x=setup();assert.equal((await x.p.configure()).state,'configured');assert.equal((await x.p.publish()).state,'published');assert.equal(x.f.writes.length,1);assert.equal(x.f.writes[0].name,'observe_resource_pool');checks++;
}
for(const type of ['missing','denied','array','extra','partial','foreign-host','foreign-pool']){
 const x=setup();x.hook(()=>{if(type==='missing')return undefined;if(type==='denied')return {data:x.f.row,error:{code:'42501'}};let data=structuredClone(x.f.row);if(type==='array')data=[data];if(type==='extra')data.unselected='hidden';if(type==='partial')delete data.policy_revision;if(type==='foreign-host')data.host_id='other';if(type==='foreign-pool')data.pool_id='other';return {data,error:null}});
 const r=await x.p.configure();assert.equal(r.state,'unknown',type);assert.equal(r.executionAuthorized,false);assert.equal(x.f.writes.length,0);checks++;
}
{
 const x=setup();x.f.deps.timeoutMs=10;let reject; x.hook(()=>new Promise((_r,j)=>reject=j));
 // setup publisher has100ms deadline; timeout never discards underlying read.
 assert.equal((await x.p.configure()).state,'unknown');for(let i=0;i<30;i++)for(const fn of ['configure','publish','reconcile'])assert.equal((await x.p[fn]()).reason,'io_outstanding');assert.equal(x.f.reads,1);assert.equal(x.f.writes.length,0);reject(Error('synthetic late read rejection'));await new Promise(r=>setImmediate(r));assert.equal(x.f.writes.length,0);checks++;
}
console.log(JSON.stringify({pass:checks,genericTableAccess:'forbidden by getter',lateReadRetryCalls:90}));
