import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { EnrolledSessions, joinBoardSession, MAX_BOARD_SESSIONS_PER_BINDING } = await import(pathToFileURL(process.argv[2]).href);
function fixture() {
 let count=0,peak=0;const held=new Map();
 const sessions=new EnrolledSessions({state:t=>held.has(t)?'unclaimed':'gone',end:id=>{for(const[t,s]of held)if(s===id)held.delete(t)}});
 const deps={sessions,check:async()=>({capabilities:['work'],grants:['g']}),liveGrants:async()=>[{id:'g',expires_at:new Date(Date.now()+100000).toISOString()}],stillLive:async()=>true,mint:(p,id)=>{const token='t'+(++count);held.set(token,id);peak=Math.max(peak,held.size);return{token}}};
 return{deps,sessions,held,get count(){return count},get peak(){return peak}};
}
const binding={id:'binding',agent_id:'agent'};
const f=fixture();const first=await Promise.all(Array.from({length:8},()=>joinBoardSession(binding,{projectId:'project'},f.deps)));
assert.equal(f.sessions.liveOf(binding.id).length,1,'concurrent retries share one fully verified session');
assert.equal(new Set(first.map(x=>x.session.sessionId)).size,1);
const burst=fixture(); await Promise.all(Array.from({length:40},(_,i)=>joinBoardSession(binding,{projectId:'p'+i},burst.deps)));
assert.equal(burst.sessions.liveOf(binding.id).length,MAX_BOARD_SESSIONS_PER_BINDING);assert.ok(burst.peak<=MAX_BOARD_SESSIONS_PER_BINDING);
const reject=fixture();let checks=0;reject.deps.check=async()=>{if(++checks===1)throw Error('read failed');return{capabilities:['work'],grants:['g']}};
const outcomes=await Promise.allSettled([joinBoardSession(binding,{projectId:'project'},reject.deps),joinBoardSession(binding,{projectId:'project'},reject.deps)]);
assert.equal(outcomes[0].status,'rejected');assert.equal(outcomes[1].status,'fulfilled');assert.equal(outcomes[1].value.ok,true);assert.equal(reject.count,1);
const separation=fixture();let unblock,enter;const entered=new Promise(r=>enter=r);let reads=0;
separation.deps.stillLive=async()=>{if(++reads===1){enter();return new Promise(r=>unblock=r)}return true};
const waiting=joinBoardSession(binding,{projectId:'project'},separation.deps);await entered;
const other=await joinBoardSession({...binding,id:'other'},{projectId:'project'},separation.deps);assert.equal(other.ok,true);unblock(true);assert.equal((await waiting).ok,true);
console.log(JSON.stringify({status:'PASS',controls:4,concurrentRetryCalls:8,distinctProjectCalls:40,peak:burst.peak,cap:MAX_BOARD_SESSIONS_PER_BINDING,checkFailureQueueReleased:true,otherBoardBindingIndependent:true}));
