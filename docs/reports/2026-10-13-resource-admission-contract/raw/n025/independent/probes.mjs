import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
const checks=[];
{
 const f=fixture({existing:true});await f.publisher.configure();f.readHook=()=>{if(f.reads===3)f.wall+=101};
 const r=await f.publisher.publish();assert.equal(r.reason,'observation_stale');assert.equal(f.writes.length,0);checks.push('stale-after-sample-no-write');
}
for(const field of ['host_id','pool_id']){
 const f=fixture({existing:true});f.row[field]='other';const r=await f.publisher.configure();assert.equal(r.state,'unknown');assert.equal(f.writes.length,0);checks.push('foreign-row-'+field+'-refused');
}
{
 const f=fixture({existing:true});await f.publisher.configure();let writes=0;
 f.rpcHook=(_name,args)=>{writes++;f.row.observed={...args.p_observed};f.row.observed_at=args.p_at;f.row.configuration_generation=3;throw Error('synthetic unknown commit')};
 assert.equal((await f.publisher.publish()).state,'unknown');for(let i=0;i<30;i++){assert.equal((await f.publisher.publish()).reason,'reconcile_required');assert.equal((await f.publisher.reconcile()).state,'unknown')};assert.equal(writes,1);checks.push('ABA-read-reconciliation-never-rewrites');
}
{
 const f=fixture({timeoutMs:10});let reject;
 f.rpcHook=()=>new Promise((_resolve,r)=>reject=r);
 assert.equal((await f.publisher.configure()).reason,'write_unconfirmed');const reads=f.reads;
 for(let i=0;i<100;i++)for(const method of ['configure','publish','reconcile'])assert.equal((await f.publisher[method]()).reason,'io_outstanding');
 assert.equal(f.reads,reads);assert.equal(f.writes.length,1);reject(Error('synthetic-late-rejection'));await new Promise(r=>setTimeout(r,20));assert.equal(f.reads,reads);
 assert.equal((await f.publisher.publish()).reason,'reconcile_required');assert.equal((await f.publisher.reconcile()).state,'unknown');assert.equal(f.writes.length,1);checks.push('300-cross-method-retries-one-write-late-rejection-consumed');
}
console.log(JSON.stringify({checks,pass:checks.length}));
