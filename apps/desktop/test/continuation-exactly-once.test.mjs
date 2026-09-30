// Contract tests: durable RPC remains the authority; PTY write is not exactly-once.
import assert from 'node:assert/strict'
import { createContinuationDelivery, continuationDeliveryId } from '../src/main/continuationDelivery.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
const run = { estate_id: 'estate', task_run_id: 'run', task_id: 'task', session_id: 'session', state: 'active' }
function fixture({ readError = false, writeState = 'written', finishError = false, legacy = false, beginError = false, claimError = false, transportThrow = false, guard = async()=>true } = {}) {
  const calls = [], writes = [], rows = new Map()
  if (legacy) rows.set(continuationDeliveryId('decision', 'task'), { state: 'legacy' })
  const db = {
    from() { const q = { select(){return q},eq(){return q},order(){return q},limit(){return q},
      then(resolve){return Promise.resolve({data:readError?null:[run],error:readError?{message:'private detail'}:null}).then(resolve)} }; return q },
    async rpc(name, a) {
      assert.equal(name, 'continuation_dispatch'); calls.push(a)
      assert.equal(a.p_estate_id,'estate')
      let row=rows.get(a.p_delivery_id)
      if(a.p_action==='claim') {
        if(claimError)return {data:null,error:{message:'private detail'}}
        if(row && !['failed_before_write'].includes(row.state)) return {data:{state:row.state==='legacy'?'outcome_unknown':row.state==='write_started'?'outcome_unknown':row.state,granted:false},error:null}
        row={state:'reserved',claim:a.p_claim_id};rows.set(a.p_delivery_id,row)
        return {data:{state:row.state,granted:true},error:null}
      }
      assert.equal(row.claim,a.p_claim_id)
      if(a.p_action==='begin' && beginError)return {data:null,error:{message:'private detail'}}
      if(a.p_action==='begin'){row.state='write_started';return {data:{state:row.state,granted:true},error:null}}
      if(finishError)return {data:null,error:{message:'secret'}}
      row.state=a.p_action;return {data:{state:row.state,granted:false},error:null}
    }
  }
  const delivery=createContinuationDelivery({db,guard,authority:()=>null,store:createScopedStore(db,{kind:'estate',estateId:'estate'}),
    estateId:'estate',actor:{kind:'operator',id:'op'},
    withDeliveryHeader:(text,id,digest)=>`${id}:${digest}\n${text}`,
    ptys:{list:()=>[{sessionId:'session',running:true}],async deliverWhenReady(session,text,options){
      if(transportThrow)throw Error('transport failed after unknown effect')
      if(writeState==='failed_before_write')return {state:writeState}
      if(!await options.beforeWrite())return {state:'failed_before_write'}
      writes.push(text);return {state:writeState}
    }}})
  return {delivery,calls,writes,rows}
}
const id=continuationDeliveryId('decision','task')
assert.equal(id,continuationDeliveryId('decision','task'))
assert.notEqual(id,continuationDeliveryId('other','task'))
{
 const f=fixture();const [a,b]=await Promise.all([f.delivery.deliver('task','decision','yes'),f.delivery.deliver('task','decision','yes')])
 assert.equal(f.writes.length,1);assert.equal([a,b].filter(x=>x.deliveryState==='reserved').length,1)
 const retry=await f.delivery.deliver('task','decision','yes');assert.equal(retry.alreadyDelivered,true)
 assert.equal(f.writes.length,1);assert.equal(f.calls.filter(x=>x.p_action==='written').length,1)
}
{
 const f=fixture({legacy:true});const r=await f.delivery.deliver('task','decision','yes')
 assert.equal(r.deliveryState,'outcome_unknown');assert.notEqual(r.alreadyDelivered,true);assert.equal(f.writes.length,0)
}
{
 const f=fixture({writeState:'failed_before_write'});const r=await f.delivery.deliver('task','decision','yes')
 assert.equal(r.state,'retryable');await f.delivery.deliver('task','decision','yes')
 assert.equal(f.calls.filter(x=>x.p_action==='failed_before_write').length,2);assert.equal(f.writes.length,0)
}
{
 const f=fixture({finishError:true});const r=await f.delivery.deliver('task','decision','yes')
 assert.equal(r.deliveryState,'outcome_unknown');const retry=await f.delivery.deliver('task','decision','yes')
 assert.equal(retry.deliveryState,'outcome_unknown');assert.equal(f.writes.length,1)
}
{
 const f=fixture({writeState:'outcome_unknown'});const r=await f.delivery.deliver('task','decision','yes')
 assert.equal(r.deliveryState,'outcome_unknown');assert.equal(f.calls.filter(x=>x.p_action==='written').length,0)
}
{
 const f=fixture({readError:true});await assert.rejects(()=>f.delivery.deliver('task','decision','yes'),/target is unavailable/)
 assert.equal(f.calls.length,0);assert.equal(f.writes.length,0)
}
{
 const f=fixture({claimError:true});await assert.rejects(()=>f.delivery.deliver('task','decision','yes'),/receipt is unavailable/)
 assert.equal(f.writes.length,0)
}
{
 const f=fixture({beginError:true});const r=await f.delivery.deliver('task','decision','yes')
 assert.equal(r.deliveryState,'outcome_unknown');assert.equal(f.writes.length,0)
}
{
 const f=fixture({transportThrow:true});const r=await f.delivery.deliver('task','decision','yes')
 assert.equal(r.deliveryState,'outcome_unknown');assert.equal(f.calls.filter(x=>x.p_action==='written').length,0)
}
{
 const f=fixture({guard:async()=>false});const r=await f.delivery.deliver('task','decision','yes')
 assert.equal(r.state,'rejected');assert.equal(f.calls.length,0);assert.equal(f.writes.length,0)
}
{
 let checks=0;const f=fixture({guard:async()=>++checks===1})
 const r=await f.delivery.deliver('task','decision','yes')
 assert.equal(r.state,'retryable');assert.equal(f.calls.some(c=>c.p_action==='begin'),false);assert.equal(f.writes.length,0)
}
console.log('PASS continuation dispatch contract: concurrent callers, legacy crash, safe retry, lost completion, unknown transport, read failure')
