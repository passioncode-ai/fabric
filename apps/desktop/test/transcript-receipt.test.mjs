import assert from 'node:assert/strict'
import { createTranscriptReceipt } from '../src/main/transcriptReceipt.ts'
const session = {sessionId:'s',projectId:'p',optionId:'shell',startedAt:'2026-09-27T10:00:00Z',lastActivityAt:'2026-09-27T10:01:00Z',exitCode:0}
function fixture(final = {state:'empty',truncated:false}) {
 const calls=[]; let fail=false, malformed=false
 const capture=createTranscriptReceipt({estateId:'e',get:()=>session,task:()=>null,finalize:()=>final,
 settle:id=>calls.push(['settle',id]),journal:{append:async e=>{
 calls.push(['append',e]); if(fail)throw Error('lost response')
 return {...e,estate_id:'e',seq:malformed?NaN:4,payload:e.payload}
 }}})
 return {capture,calls,setFail:v=>fail=v,setMalformed:v=>malformed=v}
}
for(const reason of ['missing-capture','spool-unreadable','capture-gap']) {
 const f=fixture({state:'unavailable',reason});assert.deepEqual(await f.capture('s'),{committed:false});assert.equal(f.calls.length,0)
}
{
 const f=fixture();const [a,b]=await Promise.all([f.capture('s'),f.capture('s')]);assert.deepEqual(a,b);assert.equal(a.committed,true)
 assert.equal(f.calls.filter(c=>c[0]==='append').length,1);assert.equal(f.calls[0][1].payload.capture_state,'empty')
 assert.equal(f.calls[0][1].payload.body,'');assert.equal(f.calls[0][1].payload.ended_at,session.lastActivityAt)
 await f.capture('s');assert.equal(f.calls.length,2)
}
{
 const f=fixture();f.setFail(true);assert.equal((await f.capture('s')).committed,false);assert.equal(f.calls.length,1)
 f.setFail(false);assert.equal((await f.capture('s')).committed,true);assert.deepEqual(f.calls[0][1],f.calls[1][1]);assert.equal(f.calls[2][0],'settle')
}
{
 const f=fixture();f.setMalformed(true);assert.equal((await f.capture('s')).committed,false);assert.equal(f.calls.length,1)
}
console.log('PASS transcript receipts: unavailable never empty, coalesced finalization, acknowledged journal before settlement, lost-reply retry, stable exit metadata')
