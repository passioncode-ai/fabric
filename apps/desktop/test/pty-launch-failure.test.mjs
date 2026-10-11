// Drive the real manager across failures after native spawn. No real agent runs.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTranscriptStore } from '../src/main/transcripts.ts'
import { createTranscriptReceipt } from '../src/main/transcriptReceipt.ts'
import { PtyManager } from '../src/main/pty.ts'
import { AGENTS } from '../src/shared/agents.ts'
import { randomUUID } from 'node:crypto'
import { PtyLaunchFailure, retainFailedLaunch } from '../src/main/launchFailure.ts'
AGENTS.push({ ...AGENTS.find(a => a.id === 'shell'), id: 'launch-fixture', connectsToSurface: true, surfaceAdapter: 'mcp-config-flag', resultChannel: 'surface' })
for (const adapter of ['config-content-env', 'acp-session'])
  AGENTS.push({ ...AGENTS.find(a => a.id === 'shell'), id: `bundle-only-${adapter}`, label: `Fixture ${adapter}`, connectsToSurface: true, surfaceAdapter: adapter, resultChannel: 'surface' })

// 0.3.3 verification ER-1: a pre-spawn check that THROWS (the launch receipt could not be read) takes the
// minted session credential back, as a refusal does; 0.3.2 did, and 0.3.3's move of the check had lost it.
{
  const revoked = []
  let spawns = 0
  const sessionId = randomUUID()
  const manager = new PtyManager({ append: async () => ({ seq: 1 }) }, randomUUID(), { onData() {}, onExit() {} }, {
    compile: async () => ({ dir: '/not-used', args: [] }),
    discard: sid => revoked.push(sid)
  }, () => { spawns++; throw Error('unexpected native spawn') }, undefined, () => ({ kind: 'person', id: 'operator' }))
  await assert.rejects(
    manager.open(randomUUID(), process.cwd(), 'launch-fixture', null, null, null, sessionId, async () => { throw Error('launch receipt unavailable') }),
    /launch receipt unavailable/)
  assert.equal(spawns, 0)
  assert.deepEqual(revoked, [sessionId], 'the credential minted with the bundle is discarded when the pre-spawn check throws')
  assert.equal(manager.list().length, 0)
}

// Launch references are immutable authority, not free text to rewrite later.
// Refuse before bundle preparation, native spawn, capture or journalling.
{
  let effects=0
  const hit=()=>{effects++;throw Error('must not reach any launch effect')}
  const manager=new PtyManager({append:hit},randomUUID(),{onData(){},onExit(){}},
    {compile:hit,discard:hit},hit,{open:hit,write:hit},()=>({kind:'person',id:'operator'}))
  const secret='sk-'+ 'B'.repeat(48)
  for(const [cwd,option] of [[`/tmp/${secret}`,'shell'],[process.cwd(),secret]])
    await assert.rejects(manager.open(randomUUID(),cwd,option),error=>!error.message.includes(secret))
  const oldShell=process.env.SHELL
  try {
    process.env.SHELL=`/tmp/${secret}`
    await assert.rejects(manager.open(randomUUID(),process.cwd(),'shell'),error=>!error.message.includes(secret))
  } finally {
    if(oldShell===undefined)delete process.env.SHELL;else process.env.SHELL=oldShell
  }
  assert.equal(effects,0)
  assert.equal(manager.list().length,0)
}

async function probe(boundary) {
  const id = randomUUID(), project = randomUUID()
  const events = [], writes = [], revoked = []
  let output, exit, kills = 0
  const native = {
    pid: 1234, resize() {}, write(text) { writes.push(text) },
    onData(cb) { output = cb }, onExit(cb) { exit = cb },
    kill() { kills++; if (boundary === 'kill') throw Error('private kill failure') }
  }
  const manager = new PtyManager({ append: async e => {
    if (e.type === 'terminal.opened@1' && boundary !== 'transcript') throw Error('private journal failure')
    events.push(e); return { seq: events.length }
  } }, id, { onData() {}, onExit() { if (boundary === 'observer') throw Error('private observer failure') } }, {
    compile: async () => ({ dir: '/not-used', args: [] }),
    discard: sid => { revoked.push(sid); if (boundary === 'revoke') throw Error('private revoke failure') }
  }, () => native, {
    open() { if (boundary === 'transcript') throw Error('private spool failure') }, write() {}
  }, () => ({ kind: 'person', id: 'operator' }))
  let failure
  try { await manager.open(project, process.cwd(), 'launch-fixture') } catch (error) { failure = error }
  assert.ok(failure, 'open must not succeed when setup failed')
  const rows = manager.list()
  assert.equal(rows.length, 1, 'failed setup must not erase a possibly live process')
  assert.equal(rows[0].running, true, 'a signal is not an observed exit')
  assert.equal(kills, 1, 'cleanup attempts termination even when another cleanup step fails')
  assert.equal(typeof exit, 'function', 'exit must be watched before transcript storage can throw')
  assert.equal(revoked.length, 1, 'cleanup attempts credential revocation')
  assert.equal(revoked[0], rows[0].sessionId)
  assert.equal(failure.sessionId, rows[0].sessionId, 'the coordinator can reconcile exactly this process')
  assert.equal(failure.processStarted, true, 'a post-spawn throw cannot be compensated as no process')
  assert.equal(failure.message.includes('private'), false, 'dependency diagnostics stay out of launch result')
  output('late native output')
  assert.equal((await manager.deliverWhenReady(rows[0].sessionId, 'must not execute')).state, 'failed_before_write')
  assert.equal(writes.length, 0)
  manager.write(rows[0].sessionId, 'manual input after failed launch')
  assert.equal(writes.length, 0, 'manual input shares the launch-failure halt fence')
  await exit({ exitCode: 143 })
  assert.equal(manager.get(rows[0].sessionId).running, false, 'only observed exit changes liveness')
  assert.equal(events.filter(e => e.type === 'terminal.closed@1').length, 1)
}
for (const boundary of ['journal', 'transcript', 'kill', 'revoke', 'observer']) await probe(boundary)
for (const running of [true, false]) {
  const failure = new PtyLaunchFailure('exact-session'), tracked = []
  let closes = 0
  const handled = await retainFailedLaunch(failure, {
    track: id => tracked.push(id), get: () => ({ running, exitCode: running ? null : 143 }),
    close: async id => { assert.equal(id,'exact-session'); closes++; throw Error('database unavailable during recovery') }
  })
  assert.equal(handled,true,'a recovery error never reclassifies a process as not started')
  assert.deepEqual(tracked,['exact-session'])
  assert.equal(closes,running ? 0 : 1)
}
assert.equal(await retainFailedLaunch(Error('before spawn'), {
  track() { throw Error('unexpected tracking') }, get() { throw Error('unexpected read') }, close() { throw Error('unexpected close') }
}), false)
// Audit 2026-10-05 A6-006: an agent whose permissions travel in the bundle is never started without
// one (the surface down → no bundle → Kilo's own allow-all default under a journalled "ask").
for (const adapter of ['config-content-env', 'acp-session']) {
  let spawned = 0, appended = 0
  const manager = new PtyManager({ append: async () => { appended++; return { seq: 1 } } }, randomUUID(), { onData() {}, onExit() {} },
    { compile: async () => null, discard() {} }, () => { spawned++; throw Error('must not spawn') },
    { open() {}, write() {} }, () => ({ kind: 'person', id: 'operator' }))
  await assert.rejects(manager.open(randomUUID(), process.cwd(), `bundle-only-${adapter}`), /agent surface is not running/)
  assert.equal(spawned, 0, `${adapter}: nothing started`)
  assert.equal(appended, 0, `${adapter}: nothing journalled as opened`)
  assert.equal(manager.list().length, 0)
}
console.log('PASS launch failure: journal/spool/kill/revoke faults retain exact process identity and observation; no false stopped receipt')
// Same durable session ID reaches bundle and PTY; an in-flight compile cannot
// admit a second local open under the same identity. Authority is rechecked
// after compilation, immediately before the native spawn.
{
  let finishCompile, spawns = 0
  const revoked = []
  const sessionId = randomUUID()
  const manager = new PtyManager({append:async()=>({seq:1})}, randomUUID(), {onData(){},onExit(){}}, {
    compile:async sid=>{assert.equal(sid,sessionId);await new Promise(r=>{finishCompile=r});return {dir:'/not-used',args:[]}},
    discard:sid=>revoked.push(sid)
  }, ()=>{spawns++;throw Error('unexpected native spawn')}, undefined, ()=>({kind:'person',id:'operator'}))
  const first=manager.open(randomUUID(),process.cwd(),'launch-fixture',null,null,null,sessionId,async()=>false)
  await assert.rejects(manager.open(randomUUID(),process.cwd(),'launch-fixture',null,null,null,sessionId),/identity already used/)
  finishCompile()
  await assert.rejects(first,/authority changed/)
  assert.equal(spawns,0);assert.deepEqual(revoked,[sessionId]);assert.equal(manager.list().length,0)
}
console.log('PASS pre-spawn authority recheck and concurrent session identity fencing')
// Dismissing a root that exited must not erase its recovery identity while the
// close receipt or its asynchronous finalizer is still pending.
for (const fault of ['pending', 'receipt-failure', 'finalizer-failure']) {
  let exit, releaseReceipt, releaseFinalizer, callbackStarted=false, closeAttempts=0
  const closeGate=new Promise(r=>{releaseReceipt=r}), finalGate=new Promise(r=>{releaseFinalizer=r})
  const native={pid:1234,resize(){},write(){},kill(){},onData(){},onExit(cb){exit=cb}}
  const manager=new PtyManager({append:async e=>{
    if(e.type==='terminal.closed@1') {
      closeAttempts++
      if(fault==='receipt-failure' && closeAttempts===1) throw Error('lost exit receipt')
      if(fault==='pending') await closeGate
    }
    return{seq:1}
  }},randomUUID(),{onData(){},onExit:async()=>{
    callbackStarted=true
    if(fault==='pending')await finalGate
    if(fault==='finalizer-failure')throw Error('finalization unavailable')
  }},undefined,()=>native,undefined,()=>({kind:'person',id:'operator'}))
  const s=await manager.open(randomUUID(),process.cwd(),'shell')
  const pending=exit({exitCode:0})
  manager.dismiss(s.sessionId)
  assert.ok(manager.get(s.sessionId),'pending receipt cannot lose session metadata')
  releaseReceipt()
  for(let i=0;i<20&&!callbackStarted;i++)await Promise.resolve()
  if(fault==='pending'){
    assert.equal(callbackStarted,true)
    manager.dismiss(s.sessionId)
    assert.ok(manager.get(s.sessionId),'pending finalizer cannot lose session metadata')
  }
  releaseFinalizer();await pending
  manager.dismiss(s.sessionId)
  if(fault==='pending')assert.equal(manager.get(s.sessionId),null)
  else assert.ok(manager.get(s.sessionId),'failed close/finalization retains recovery identity')
  if(fault==='receipt-failure'){
    assert.equal(await manager.ensureClosedReceipt(s.sessionId),true)
    manager.dismiss(s.sessionId);assert.equal(manager.get(s.sessionId),null)
  }
}
console.log('PASS exit dismissal: await receipt and finalizer; failure retains metadata and retryable close evidence')

// A sealed capture can still belong to a pending runtime receipt. The
// background path must never settle it out from under a Stop retry.
{
  const root=mkdtempSync(join(tmpdir(),'fabric-recovery-ownership-'))
  try {
    const captures=createTranscriptStore({root}), estateId=randomUUID()
    let exit,data,appendCalls=0
    const journal={append:async e=>{
      if(e.type==='transcript.captured@1' && ++appendCalls===1)throw Error('lost reply')
      return {...e,estate_id:estateId,seq:appendCalls+1}
    }}
    const native={pid:1234,resize(){},write(){},kill(){},onData(cb){data=cb},onExit(cb){exit=cb}}
    const manager=new PtyManager(journal,estateId,{onData(){},onExit(){}},undefined,()=>native,captures,()=>({kind:'person',id:'operator'}))
    const session=await manager.open(randomUUID(),root,'shell')
    data('retained runtime output');await exit({exitCode:0})
    const finalize=createTranscriptReceipt({estateId,journal,get:id=>manager.get(id),task:()=>null,
      finalize:id=>manager.finalizeTranscript(id),settle:id=>manager.settleTranscript(id)})
    assert.equal((await finalize(session.sessionId)).committed,false)
    assert.equal(captures.recoverFinalizations().items.length,1,'sealed evidence exists on disk')
    assert.equal(manager.recoverTranscriptFinalizations({after:null,limit:8}).items.length,0,'owned exited generation is excluded')
    assert.equal((await finalize(session.sessionId)).committed,true)
    assert.equal(appendCalls,2,'runtime retries its own receipt')
  } finally {rmSync(root,{recursive:true,force:true})}
}
console.log('PASS recovery exclusion: exited runtime generation keeps its pending capture until own receipt')
