// Fault injection against the actual native launch coordinator, no live CLI.
import assert from 'node:assert/strict'
import { createManagedLaunch } from '../src/main/managedLaunch.ts'
import { LaunchRefusedBeforeSpawn, PtyLaunchFailure } from '../src/main/launchFailure.ts'
function fixture(fault = '') {
  const calls = [], sessions = new Map(), tracked = new Map()
  let begun = false, count = 0, runReceipt
  const deps = {
    estateId: 'estate', actor: {kind:'person',id:'operator'}, authority: () => ({personId:'person',revision:7}),
    admit: async (taskId,sessionId) => {
      calls.push('admit')
      if (fault === 'admit') throw Error('private dependency')
      runReceipt = {admitted:true,task_id:taskId,task_run_id:'run',session_id:sessionId,project_id:'project',instruction:'do work',option_id:'shell'}
      return {admitted:true,receipt:runReceipt}
    },
    db: { rpc: async (name,args) => {
      calls.push(name)
      if (name === 'begin_task_run_launch') {
        assert.equal(args.p_person_id,'person'); assert.equal(args.p_revision,7)
        if (fault==='begin-lost') { begun=true; throw Error('private begin') }
        if (begun || fault==='begin-refused') return {data:{granted:false,reason_code:'already_begun'}}
        begun=true; return {data:{granted:true,task_run_id:'run',session_id:args.p_session_id}}
      }
      if(name==='validate_task_run_launch') {
        if(fault==='validate-lost') return {data:null,error:{message:'private database'}}
        return {data:{valid:fault!=='validate-refused',task_run_id:'run',session_id:args.p_session_id}}
      }
      if (name === 'bind_task_run') {
        if(fault==='bind-lost') throw Error('private bind')
        return {data:{bound:fault!=='bind-refused',task_run_id:'run',session_id:args.p_session_id}}
      }
      if(name==='fail_task_launch') {
        assert.equal(args.p_process_started, ['spawn-after','bind-refused','bind-lost','exit','stop'].includes(fault))
        if(fault==='compensation-lost') throw Error('private compensation')
        return {data:{compensated:true}}
      }
      throw Error('unexpected RPC '+name)
    } },
    prepare: async () => {
      calls.push('prepare')
      if(fault==='prepare' || fault==='compensation-lost') throw Error('private preparation')
      return async (sessionId, validate) => {
        if(!await validate()) throw Error('launch no longer valid')
        calls.push('open'); assert.equal(tracked.get(sessionId),'task','tracking precedes a possible synchronous exit')
        if(fault==='spawn-before') throw Error('private spawn')
        sessions.set(sessionId,{running:fault!=='exit'}); count++
        if(fault==='spawn-after') throw new PtyLaunchFailure(sessionId)
        return {sessionId}
      }
    },
    track:(sid,tid)=>tracked.set(sid,tid), untrack:(sid)=>tracked.delete(sid), get:sid=>sessions.get(sid)??null,
    stop:async sid=>{calls.push('stop');assert.ok(sessions.has(sid));if(fault==='stop') throw Error('private kill')},
    dispatch: async (...args)=>{ calls.push('dispatch'); if(fault==='delivery') throw Error('private write');
      assert.equal(args[4],'do work');return {state:'delivering',says:'written, not acknowledged'} }
  }
  if(fault==='stop') deps.db.rpc = ((original)=>async(n,a)=> n==='bind_task_run' ? {data:{bound:false}} : original(n,a))(deps.db.rpc)
  return {deps,calls,tracked,sessions,get count(){return count},get receipt(){return runReceipt}}
}
for(const fault of ['admit','begin-lost','begin-refused','prepare','spawn-before','validate-lost','validate-refused','compensation-lost','spawn-after','bind-refused','bind-lost','exit','stop','delivery','']) {
  const f=fixture(fault); const result=await createManagedLaunch(f.deps)({taskId:'task',trigger:'operator'})
  assert.equal(result.started,['delivery',''].includes(fault),fault)
  assert.ok(!result.says.includes('private'),fault+' must not leak dependency details')
  if(['admit','begin-lost','begin-refused'].includes(fault)) {
    assert.equal(f.count,0);assert.equal(f.calls.includes('fail_task_launch'),false,'no begin winner, no compensation')
  }
  if(['prepare','spawn-before','validate-lost','validate-refused','compensation-lost'].includes(fault)) assert.equal(f.tracked.size,0)
  if(['spawn-after','bind-refused','bind-lost','exit','stop'].includes(fault)) {
    assert.equal(f.calls.includes('stop'),true);assert.equal(f.tracked.size,1);assert.equal(f.calls.includes('dispatch'),false)
  }
  if(fault==='delivery') {assert.equal(result.deliveryState,'outcome_unknown');assert.equal(f.calls.includes('stop'),false)}
}
// Two consumers of the same durable admission share the begin boundary. Only
// one may prepare/spawn; the loser must never compensate the winner.
{
  const f=fixture();const admission=await f.deps.admit('task','same-session')
  const launch=createManagedLaunch(f.deps)
  const input={taskId:'task',trigger:'chain',admission:{receipt:admission.receipt,sessionId:'same-session'}}
  const results=await Promise.all([launch(input),launch(input)])
  assert.equal(results.filter(r=>r.started).length,1);assert.equal(f.count,1)
  assert.equal(f.calls.includes('fail_task_launch'),false)
}
console.log('PASS managed launch: faults at every async boundary, exact session, begin winner, compensation, exit-before-bind, no replay after uncertain delivery')

for (const boundary of ['admit', 'begin', 'bind']) {
  const f = fixture()
  if(boundary==='admit') {
    const original=f.deps.admit
    f.deps.admit=async(...args)=>{const a=await original(...args);a.receipt.task_id='different-task';return a}
  } else {
    const original=f.deps.db.rpc
    f.deps.db.rpc=async(n,a)=>{
      if(boundary==='bind' && n==='fail_task_launch') {assert.equal(a.p_process_started,true);return {data:{compensated:true}}}
      const r=await original(n,a)
      if(n===(boundary==='begin'?'begin_task_run_launch':'bind_task_run')) r.data.session_id='different-session'
      return r
    }
  }
  const result=await createManagedLaunch(f.deps)({taskId:'task',trigger:'operator'})
  assert.equal(result.started,false)
  assert.equal(f.calls.includes('dispatch'),false)
  assert.equal(f.count,boundary==='bind'?1:0)
}
console.log('PASS launch receipt identity mismatch never spawns or dispatches against another generation')
{
  // B1: a typed refusal before spawn is "not started" even when get() still holds a stale record for
  // the session (an owned-backend registry keeps the refused attempt's handle and marker).
  const f = fixture()
  f.deps.prepare = async () => async (sessionId, validate) => {
    await validate(); f.sessions.set(sessionId, { running: false })
    throw new LaunchRefusedBeforeSpawn(sessionId, 'spawn_not_granted')
  }
  const result = await createManagedLaunch(f.deps)({ taskId: 'task', trigger: 'operator' })
  assert.equal(result.reasonCode, 'launch_failed_before_spawn'); assert.equal(result.sessionId, undefined)
  assert.equal(f.calls.includes('stop'), false)
}
console.log('PASS a typed refusal before spawn classifies by the result, not by a stale session record')
