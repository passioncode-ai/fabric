import assert from 'node:assert/strict'
import { createNativeViewLifecycle, NATIVE_VIEW_LIMITS } from '../src/main/nativeViewLifecycle.ts'
const uuid = n => `019a0000-0000-7000-8000-${String(n).padStart(12,'0')}`
const owner = () => ({fabric:{estateId:uuid(1),projectId:uuid(2),taskId:uuid(3),runId:uuid(4),runOrdinal:1,sessionId:uuid(5)},authority:{personId:uuid(6),revision:1},backend:{ownerId:'backend-1',hostInstanceId:'host-1',bootId:'boot-1',processIdentityRef:'process:'+'a'.repeat(64),connectionId:'connection-1'}})
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
let passed=0
const run=async(name,test)=>{await test();passed++;console.log('PASS '+name)}
function fixture(overrides={},timeoutMs=100){
 const source=owner(),local=new Map(),effects=[];let current=structuredClone(source)
 const ports={currentOwner:()=>current,ownsView:t=>local.get(t.attachment)===t,
  openView:async(t,allowed)=>{assert(allowed());local.set(t.attachment,t);effects.push(['open',t.attachment]);return {ticket:t,opened:true}},
  writeView:async(t,text,allowed)=>{assert(allowed());effects.push(['write',t.attachment,text]);return {ticket:t,written:true}},
  closeView:async(t,allowed)=>{assert(allowed());effects.push(['close',t.attachment]);local.delete(t.attachment);return {ticket:t,closed:true}},
  disposeView:async(t,allowed)=>{assert(allowed());effects.push(['dispose',t.attachment]);local.delete(t.attachment);return {ticket:t,closed:true}},...overrides}
 const c=createNativeViewLifecycle(source,ports,{timeoutMs})
 return {c,ports,source,local,effects,replace:v=>current=v,current:()=>current}
}
await run('idle owner is separate; attach, view exit and reconnect never stop execution',async()=>{
 const f=fixture();assert.equal(f.c.snapshot().views.length,0);assert.equal(f.c.isAdmissionFenced(),false)
 const a=await f.c.attach('window');assert.equal(a.state,'attached');assert(Object.isFrozen(a.ticket.owner.fabric))
 assert.equal(f.c.viewExited(a.ticket),true);assert.equal(f.c.snapshot().state,'connected')
 assert.equal(f.c.isAdmissionFenced(),false);assert.equal(f.effects.some(x=>x[0]==='close'),false)
 const b=await f.c.reconnect(a.ticket);assert.equal(b.state,'attached');assert.notEqual(b.ticket.attachment,a.ticket.attachment)
 assert.equal(f.c.acceptOutput(a.ticket,1),false);assert.equal(f.c.acceptOutput(b.ticket,1),true);assert.equal(f.c.acceptOutput(b.ticket,1),false)
 assert.equal((await f.c.write(a.ticket,'stale')).reasonCode,'view_input_fenced')
 assert.equal((await f.c.write(b.ticket,'current')).state,'attached');assert.equal(f.effects.filter(x=>x[0]==='write').length,1)
 assert.equal((await f.c.detach(b.ticket)).state,'detached');assert.equal(f.c.snapshot().state,'connected')
 assert.deepEqual(f.effects.map(x=>x[0]),['open','open','write','close'])
})
await run('double/reentrant attachment is one native open, detached ID needs explicit reconnect',async()=>{
 const opened=deferred();let calls=0,f
 f=fixture({openView:async(t,allowed)=>{calls++;f.local.set(t.attachment,t);const repeat=f.c.attach(t.viewId);await opened.promise;assert(allowed());return {ticket:t,opened:true}}})
 const first=f.c.attach('window'),second=f.c.attach('window');assert.equal(first,second);opened.resolve();const a=await first;assert.equal(calls,1)
 await f.c.detach(a.ticket);assert.equal((await f.c.attach('window')).state,'detached');assert.equal(calls,1)
})
await run('owner or authority change after open triggers exact local view disposal, no newer owner action',async()=>{
 for(const change of ['run','connection','authority','process']){
  const d=deferred();let f,seenTicket
  f=fixture({openView:async(t,allowed)=>{seenTicket=t;f.local.set(t.attachment,t);await d.promise;return {ticket:t,opened:true}}})
  const pending=f.c.attach('window');await Promise.resolve();await Promise.resolve();const next=structuredClone(f.current())
  if(change==='run'){next.fabric.runId=uuid(44);next.fabric.runOrdinal=2}else if(change==='connection')next.backend.connectionId='connection-2';else if(change==='authority')next.authority.revision++;else next.backend.processIdentityRef='process:'+'b'.repeat(64)
  f.replace(next);d.resolve();const result=await pending;assert.equal(result.state,'detached');assert.equal(f.c.snapshot().state,'outcome_unknown')
  assert.deepEqual(f.effects,[['dispose',seenTicket.attachment]]);assert.equal(f.c.isAdmissionFenced(),true)
  await assert.rejects(f.c.reconnect(result.ticket),/owner_fenced/)
 }
})
await run('owner loss fences queued input at actual edge and remains sticky across apparent reconnection',async()=>{
 const d=deferred();let f,writes=0
 f=fixture({writeView:async(t,text,allowed)=>{await d.promise;if(allowed())writes++;return {ticket:t,written:true}}})
 const a=await f.c.attach('window');const pending=f.c.write(a.ticket,'text');await Promise.resolve()
 assert.equal(f.c.connectionLost('foreign'),false);assert.equal(f.c.connectionLost('connection-1'),true);d.resolve()
 assert.equal((await pending).state,'outcome_unknown');assert.equal(writes,0);assert.equal(f.c.isAdmissionFenced(),true)
 f.replace(structuredClone(f.source));assert.equal(f.c.isAdmissionFenced(),true);assert.equal(f.c.acceptOutput(a.ticket,2),false)
})
await run('partial write failure is unknown, no replay and no second concurrent write',async()=>{
 const d=deferred();let f,writes=0
 f=fixture({writeView:async()=>{writes++;await d.promise;throw Error('partial')}})
 const a=await f.c.attach('window'),first=f.c.write(a.ticket,'one');await Promise.resolve()
 assert.equal((await f.c.write(a.ticket,'two')).reasonCode,'view_write_busy');d.resolve();assert.equal((await first).state,'outcome_unknown')
 assert.equal((await f.c.write(a.ticket,'retry')).reasonCode,'view_input_fenced');assert.equal(writes,1)
 await assert.rejects(f.c.reconnect(a.ticket),/view_not_closed/);assert.equal(f.c.viewExited(a.ticket),true)
 assert.equal(f.c.isAdmissionFenced(),true);await assert.rejects(f.c.reconnect(a.ticket),/owner_fenced/)
})
await run('uncertain detach is not closure; exact observed view exit can settle it',async()=>{
 const f=fixture({closeView:async()=>{throw Error('lost')}});const a=await f.c.attach('window')
 assert.equal((await f.c.detach(a.ticket)).state,'outcome_unknown');await assert.rejects(f.c.reconnect(a.ticket),/view_not_closed/)
 assert.equal(f.c.viewExited(a.ticket),true);assert.equal(f.c.snapshot().state,'connected');assert.equal((await f.c.reconnect(a.ticket)).state,'attached')
})
await run('detach coalesces and observed exit wins over a late lost reply',async()=>{
 const d=deferred();let f,closes=0
 f=fixture({closeView:async()=>{closes++;await d.promise;throw Error('lost')}});const a=await f.c.attach('window')
 const one=f.c.detach(a.ticket),two=f.c.detach(a.ticket);await Promise.resolve();f.c.viewExited(a.ticket);d.resolve()
 assert.equal((await one).state,'exited');assert.equal((await two).state,'exited');assert.equal(closes,1)
})
await run('late open after deadline gets only scoped disposal, cannot become attached',async()=>{
 const d=deferred(),done=deferred();let f,lateFence
 f=fixture({openView:async(t,allowed)=>{lateFence=allowed;await d.promise;f.local.set(t.attachment,t);return {ticket:t,opened:true}},disposeView:async(t,allowed)=>{assert(allowed());f.effects.push(['dispose',t.attachment]);done.resolve();return {ticket:t,closed:true}}},5)
 const result=await f.c.attach('window');assert.equal(result.state,'outcome_unknown');assert.equal(lateFence(),false)
 d.resolve();await done.promise;await Promise.resolve();await Promise.resolve();assert(!f.c.snapshot().views.some(v=>v.state==='attached'));assert.equal(f.effects.length,1)
})
await run('malformed replies and false/truthy ownership cannot grant an attached view',async()=>{
 for(const bad of [{},1,Promise.resolve(true),Promise.reject(Error('owned'))]){
  const f=fixture({ownsView:()=>bad});const a=await f.c.attach('window');assert.equal(a.state,'outcome_unknown')
 }
 const f=fixture({openView:async t=>({ticket:{...t,attachment:99},opened:true})});assert.equal((await f.c.attach('window')).state,'outcome_unknown')
})
await run('retirement and bounded non-evicting identity history reject unsafe reuse',async()=>{
 const f=fixture();let current=await f.c.attach('window')
 for(let i=1;i<NATIVE_VIEW_LIMITS.attachments;i++){f.c.viewExited(current.ticket);current=await f.c.reconnect(current.ticket)}
 f.c.viewExited(current.ticket);await assert.rejects(f.c.reconnect(current.ticket),/view_capacity/)
 assert.equal(f.c.snapshot().views.length,NATIVE_VIEW_LIMITS.attachments);assert.equal(f.c.acceptOutput(f.c.snapshot().views[0].ticket,1),false)
 f.c.retire();assert.equal(f.c.snapshot().state,'retired');assert.equal(f.c.isAdmissionFenced(),true);await assert.rejects(f.c.attach('new'),/owner_fenced/)
 const g=fixture();for(let i=0;i<NATIVE_VIEW_LIMITS.active;i++)await g.c.attach('v'+i);await assert.rejects(g.c.attach('overflow'),/view_capacity/)
})
await run('invalid caller objects do not run getters, corrupt identity or permit private payload metadata',async()=>{
 let touched=false;const bad=owner();Object.defineProperty(bad.fabric,'runId',{get(){touched=true;return uuid(4)}})
 assert.throws(()=>createNativeViewLifecycle(bad,{}),/invalid_view_owner/);assert.equal(touched,false)
 const f=fixture(),a=await f.c.attach('window');const foreign={...a.ticket,owner:{...a.ticket.owner,backend:{...a.ticket.owner.backend,connectionId:'foreign'}}}
 await assert.rejects(f.c.write(foreign,'text'),/unknown_view/);assert.equal(f.c.viewExited(foreign),false)
 assert.equal((await f.c.write(a.ticket,'x'.repeat(NATIVE_VIEW_LIMITS.inputChars+1))).reasonCode,'invalid_view_input')
 assert(!JSON.stringify(f.c.snapshot()).includes('text'))
})

await run('reentrant host guards and synchronous deadline starvation cannot authorize a write',async()=>{
 const f=fixture();const a=await f.c.attach('window');let calls=0
 f.ports.ownsView=()=>{calls++;f.c.retire();return true}
 assert.equal((await f.c.write(a.ticket,'text')).state,'outcome_unknown');assert.equal(f.effects.filter(x=>x[0]==='write').length,0)
 let g,writes=0,busy=false
 g=fixture({currentOwner:()=>{if(busy){const until=performance.now()+15;while(performance.now()<until){}}return g.source},writeView:async(t,text,allowed)=>{if(allowed())writes++;return {ticket:t,written:true}}},5)
 const b=await g.c.attach('window');busy=true;await g.c.write(b.ticket,'text');assert.equal(writes,0)
})

await run('output and open receipts recheck state after reentrant local ownership callbacks',async()=>{
 const f=fixture(),a=await f.c.attach('window')
 f.ports.ownsView=()=>{f.c.viewExited(a.ticket);return true}
 assert.equal(f.c.acceptOutput(a.ticket,1),false)
 const g=fixture(),b=await g.c.attach('window');g.ports.ownsView=()=>{g.c.retire();return true}
 assert.equal(g.c.acceptOutput(b.ticket,1),false)
 let h;h=fixture({ownsView:()=>{h.c.retire();return true}});assert.notEqual((await h.c.attach('window')).state,'attached')
})
await run('late materialized view is disposed even after earlier exact exit event',async()=>{
 const d=deferred(),disposed=deferred();let f,ticket
 f=fixture({openView:async(t)=>{ticket=t;await d.promise;f.local.set(t.attachment,t);return {ticket:t,opened:true}},disposeView:async(t,allowed)=>{assert(allowed());f.effects.push(['dispose',t.attachment]);f.local.delete(t.attachment);disposed.resolve();return {ticket:t,closed:true}}})
 const p=f.c.attach('window');await Promise.resolve();await Promise.resolve();f.c.viewExited(ticket);d.resolve();await p;await disposed.promise;assert.equal(f.effects.length,1)
 assert.equal(f.c.snapshot().views[0].state,'detached')
})

await run('late materialization while earlier disposal receipt is pending triggers a second exact cleanup',async()=>{
 const openDone=deferred(),closeReply=deferred(),firstDisposed=deferred();let f,ticket,calls=0
 f=fixture({openView:async(t)=>{ticket=t;f.local.set(t.attachment,t);await openDone.promise;f.local.set(t.attachment,t);return {ticket:t,opened:true}},disposeView:async(t,allowed)=>{assert(allowed());calls++;f.local.delete(t.attachment);if(calls===1){firstDisposed.resolve();await closeReply.promise}return {ticket:t,closed:true}}},100)
 const attach=f.c.attach('window');await Promise.resolve();await Promise.resolve()
 const detach=f.c.detach(ticket);await firstDisposed.promise;openDone.resolve();await Promise.resolve();await Promise.resolve();closeReply.resolve()
 await attach;await detach;assert.equal(calls,2);assert.equal(f.local.size,0);assert.equal(f.c.snapshot().views[0].state,'detached')
})

await run('recursive host callbacks fail closed without stack recursion or duplicate effects',async()=>{
 let f,nested
 f=fixture({currentOwner:()=>{if(f){nested=f.c.attach('nested').catch(e=>e.message)}return f?.source??owner()}})
 const a=await f.c.attach('window');assert.equal(a.state,'attached');assert.equal(await nested,'owner_fenced');assert.equal(f.effects.filter(x=>x[0]==='open').length,1)
 let nestedOutput;f.ports.ownsView=()=>{nestedOutput=f.c.acceptOutput(a.ticket,1);return true}
 assert.equal(f.c.acceptOutput(a.ticket,1),true);assert.equal(nestedOutput,false)
})

await run('late failed open with newly owned handle is compensated after timeout or prior exit',async()=>{
 for(const prior of ['timeout','exit']){
  const d=deferred(),disposed=deferred();let f,ticket
  f=fixture({openView:async t=>{ticket=t;await d.promise;f.local.set(t.attachment,t);throw Error('late_handshake_failed')},disposeView:async(t,allowed)=>{assert(allowed());f.local.delete(t.attachment);f.effects.push(['dispose',t.attachment]);disposed.resolve();return {ticket:t,closed:true}}},prior==='timeout'?5:100)
  const p=f.c.attach('window');await Promise.resolve();await Promise.resolve()
  if(prior==='timeout')assert.equal((await p).state,'outcome_unknown');else f.c.viewExited(ticket)
  d.resolve();await disposed.promise;await p;await f.c.detach(ticket)
  assert.equal(f.effects.length,1);assert.equal(f.local.size,0);assert.equal(f.c.snapshot().views[0].state,'detached')
 }
})

await run('a one-time slow initial authority read cannot reset the action deadline before open/write',async()=>{
 let f,block=false
 f=fixture({currentOwner:()=>{if(block){block=false;const until=performance.now()+15;while(performance.now()<until){}}return f.source}},5)
 block=true;assert.equal((await f.c.attach('late-open')).state,'outcome_unknown');assert.equal(f.effects.length,0)
 const g=fixture({},5),a=await g.c.attach('window');let once=true
 g.ports.currentOwner=()=>{if(once){once=false;const until=performance.now()+15;while(performance.now()<until){}}return g.source}
 await g.c.write(a.ticket,'text');assert.equal(g.effects.filter(x=>x[0]==='write').length,0)
})
await run('hung operation timer uses only budget remaining after initial ownership preflight',async()=>{
 let f,once=true;const scheduled=[],realTimeout=globalThis.setTimeout
 f=fixture({currentOwner:()=>{if(once){once=false;const until=performance.now()+30;while(performance.now()<until){}}return f.source},openView:()=>new Promise(()=>{})},100)
 globalThis.setTimeout=(callback,delay,...args)=>{scheduled.push(delay);return realTimeout(callback,delay,...args)}
 try{assert.equal((await f.c.attach('window')).state,'outcome_unknown')}finally{globalThis.setTimeout=realTimeout}
 assert.equal(scheduled.length,1);assert(scheduled[0]>0&&scheduled[0]<85,`remaining delay ${scheduled[0]}`)
})
console.log(`PASS ${passed} native-view lifecycle groups; no provider/network/model or journal effects`)
