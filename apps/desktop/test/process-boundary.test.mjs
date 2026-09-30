import assert from 'node:assert/strict'
import { createProcessBoundary, parseProcessSnapshot } from '../src/main/processBoundary.ts'
const row=(pid,parent,group,start='birth-'+pid,status='S')=>({pid,parent,group,start,status})
const host=row(50,1,50)
let rows=[host,row(100,50,100),row(101,100,100)], readsFail=false
const signals=[]
const observer=createProcessBoundary({ownPid:50,snapshot:async()=>{if(readsFail)throw Error('unreadable');return rows},signal:(...args)=>signals.push(args)})
const owned=await observer.capture(100)
assert.deepEqual((await observer.observe(owned,false)).members,[100,101])
assert.deepEqual(await observer.signal(owned,'SIGTERM'),{sent:true,reasonCode:'signal_sent'})
rows=[host,row(101,1,100)]
assert.equal((await observer.observe(owned,true)).state,'active','surviving child is not a stopped execution')
assert.equal((await observer.signal(owned,'SIGKILL')).sent,true)
rows=[host]
assert.equal((await observer.observe(owned,false)).state,'active','absence is not observed root exit')
assert.equal((await observer.observe(owned,true)).state,'quiescent')
rows=[host,row(100,1,100,'a-new-process')]
assert.equal((await observer.signal(owned,'SIGTERM')).sent,false,'PID reuse cannot target another process')
assert.equal((await observer.observe(owned,true)).state,'unknown')
rows=[host,row(100,50,100),row(102,100,102)]
const escaped=await observer.capture(100)
assert.equal((await observer.observe(escaped,false)).reasonCode,'descendant_left_group')
rows=[host]
assert.equal((await observer.observe(escaped,true)).state,'unknown','sampling is not containment for escaped descendants')
readsFail=true
assert.equal((await observer.signal(owned,'SIGKILL')).sent,false)
assert.equal((await observer.observe(owned,true)).reasonCode,'process_read_unavailable')
readsFail=false
rows=[host,row(100,50,50)]
await assert.rejects(observer.capture(100),/owned process group/)
assert.equal(signals.length,2)
assert.equal(parseProcessSnapshot(' 100 50 100 S Sat Sep 26 22:00:00 2026\n')[0].start,'Sat Sep 26 22:00:00 2026')
assert.throws(()=>parseProcessSnapshot('not a process snapshot'))
console.log('PASS process boundary: group continuity, child survival, PID reuse, escape, unreadable, no host-group signal; no sandbox claim')
rows=[host,row(100,50,100)]
const cancellationTarget=await observer.capture(100)
const beforeCancelled=signals.length
assert.deepEqual(await observer.signal(cancellationTarget,'SIGKILL',()=>false),{sent:false,reasonCode:'signal_cancelled'})
assert.equal(signals.length,beforeCancelled,'native boundary enforces cancelled coordinator after sampling')
console.log('PASS signal cancellation checked at the OS boundary after the process snapshot')
