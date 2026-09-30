// Owned fixture processes only. This does not launch an agent or prove provider
// cancellation. It measures the POSIX group boundary used by the supervisor.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createProcessBoundary } from '../src/main/processBoundary.ts'
if(!['darwin','linux'].includes(process.platform)) {
  console.error('NOT_RUN: POSIX process fixture is unsupported on this platform'); process.exit(2)
}
const observer=createProcessBoundary()
const childProgram=`process.on('SIGTERM',()=>{}); console.log('ready'); setInterval(()=>{},1000)`
const parentProgram=`
const {spawn}=require('node:child_process');
process.on('SIGTERM',()=>{});
const child=spawn(process.execPath,['-e',${JSON.stringify(childProgram)}],{stdio:['ignore','pipe','ignore']});
child.stdout.once('data',()=>console.log(JSON.stringify({pid:process.pid,child:child.pid})));
process.stdin.once('data',()=>process.exit(0));
setInterval(()=>{},1000);
`
for(const parentExits of [false,true]) {
  const parent=spawn(process.execPath,['-e',parentProgram],{detached:true,stdio:['pipe','pipe','pipe']})
  let exited=false; parent.once('exit',()=>{exited=true})
  let owned
  try {
    const ids=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('fixture did not become ready')),3000)
      parent.once('error',reject)
      parent.stdout.once('data',chunk=>{clearTimeout(timer);resolve(JSON.parse(chunk.toString()))})
    })
    assert.equal(ids.pid,parent.pid)
    owned=await observer.capture(parent.pid)
    assert.ok((await observer.observe(owned,false)).members.includes(ids.child))
    if(parentExits) {
      parent.stdin.write('exit\n')
      for(let i=0;i<30&&!exited;i++) await new Promise(r=>setTimeout(r,25))
      assert.equal(exited,true)
      const after=await observer.observe(owned,true)
      assert.equal(after.state,'active','parent exit must not hide its surviving child')
      assert.ok(after.members.includes(ids.child))
    }
    assert.equal((await observer.signal(owned,'SIGTERM')).sent,true)
    await new Promise(r=>setTimeout(r,100))
    assert.equal((await observer.observe(owned,exited)).state,'active','ignored TERM is not stopped')
    assert.equal((await observer.signal(owned,'SIGKILL')).sent,true)
    let final
    for(let i=0;i<50;i++) {
      await new Promise(r=>setTimeout(r,25))
      final=await observer.observe(owned,exited)
      if(final.state==='quiescent') break
    }
    assert.equal(final.state,'quiescent','group must be empty after observed parent exit')
  } finally {
    if(owned) await observer.signal(owned,'SIGKILL')
    else if(parent.exitCode===null && parent.signalCode===null) { try { process.kill(-parent.pid,'SIGKILL') } catch {} }
    parent.stdin.destroy();parent.stdout.destroy();parent.stderr.destroy()
  }
}
console.log('PASS native owned POSIX groups: ignored TERM, explicit escalation, child survives parent, quiescence after actual exit; no provider acceptance claimed')
