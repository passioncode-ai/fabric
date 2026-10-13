import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {preparedFixture} from './prepared-launch-fixture.mjs'
import {createManagedLaunch} from '../src/main/managedLaunch.ts'
import {createBundleCompiler} from '../src/main/sessionBundle.ts'
import {readPart} from '../src/main/executionPacket.ts'
import {createAdmitExisting} from '../src/main/admitExisting.ts'
import {LaunchRefusedBeforeSpawn} from '../src/main/launchFailure.ts'
function fixture(){
 const f=preparedFixture({instruction:'  exact\nинструкция 🌍  '}),root=mkdtempSync(path.join(tmpdir(),'fabric-prepared-bundle-')),calls=[]
 let live=false;const run=f.id.project,resources={mode:'required',inputs:f.inputs,matches:()=>true,current:async()=>{calls.push('resource-current');return true},cancelUnbegun:async()=>{calls.push('cancel');return true},releaseCompensated:async()=>{calls.push('release');return true}}
 const bundles=createBundleCompiler({root,preparedInputs:f.inputs,recordPreparedContext:async packet=>{calls.push('journal');f.journaled=packet;if(f.journalFail)throw Error('private journal')},surface:{endpoint:'http://127.0.0.1:1/mcp',mint(){calls.push('mint');return {token:'synthetic'}},revokeSession(){calls.push('revoke')}},context:async()=>{throw Error('must never recompile')}})
 const deps={estateId:f.id.estate,actor:{kind:'system',id:'fixture'},authority:()=>null,resources,
  db:{rpc:async(name,args)=>{calls.push(name);if(name==='fail_task_launch')return {data:{compensated:true}};return {data:{granted:true,valid:true,bound:true,task_run_id:run,session_id:args.p_session_id}}}},
  admit:async(taskId,sessionId,trigger,packet)=>{calls.push('admit');f.packet=packet;assert.ok(f.inputs.owns(packet));assert.equal(f.reads.filter(x=>x.table==='memory_facts').length,1);f.afterPrepared?.()
   return {admitted:true,receipt:{admitted:true,task_id:taskId,session_id:sessionId,project_id:f.id.project,task_run_id:run,instruction:f.task.instruction,option_id:f.task.option_id}}},
  prepare:async(receipt,input,packet)=>{assert.equal(packet,f.packet);return async(sessionId,guard)=>{
   await bundles.compile(sessionId,f.id.project,f.id.task,'claude-code','mcp-config-flag',null,null,packet)
   f.beforeSpawn?.();if(!await guard())throw new LaunchRefusedBeforeSpawn(sessionId,'prepared_changed')
   calls.push('spawn');live=true;return {sessionId}
  }},track(){},untrack(){},get:()=>live?{running:true}:null,stop:async()=>{},dispatch:async(_t,_r,_s,_d,body)=>{calls.push('dispatch');f.dispatched=body;return {state:'delivering',says:'fixture'}}}
 return Object.assign(f,{root,calls,resources,bundles,deps,launch:createManagedLaunch(deps),cleanup:()=>rmSync(root,{recursive:true,force:true})})
}
test('actual compiler, managed admission, actual bundle files and dispatch share same exact content',async()=>{
 const f=fixture();try{const r=await f.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,true,JSON.stringify(r));assert.equal(f.dispatched,f.packet.instructionBody);assert.equal(f.journaled,f.packet)
 const packet=JSON.parse(readFileSync(path.join(f.root,'packets',`packet-${r.sessionId}.json`),'utf8'))
 assert.equal(readPart(path.join(f.root,'packets'),packet,'instruction'),f.dispatched)
 assert.equal(readPart(path.join(f.root,'packets'),packet,'context'),f.packet.context.markdown)
 assert.equal(readFileSync(path.join(f.root,'sessions',r.sessionId,'context.md'),'utf8'),f.packet.context.markdown)
 assert.equal(f.reads.filter(x=>x.table==='memory_facts').length,1);assert.ok(f.calls.indexOf('admit')<f.calls.indexOf('mint'));assert.equal(f.inputs.owns(f.packet),false)
 }finally{f.cleanup()}
})
for(const field of ['instruction','option_id'])test(`receipt ${field} drift refuses before begin and uses exact cancellation hook`,async()=>{
 const f=fixture();try{f.afterPrepared=()=>{f.task[field]='changed'};const r=await f.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,false);assert.ok(f.calls.includes('cancel'));assert.ok(!f.calls.includes('begin_task_run_launch'));assert.ok(!f.calls.includes('mint'))}finally{f.cleanup()}
})
test('actual task changes after bundle before owned spawn; no process and compensation remains exact',async()=>{
 const f=fixture();try{f.beforeSpawn=()=>{f.task.instruction='changed'};const r=await f.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,false);assert.ok(!f.calls.includes('spawn'));assert.ok(f.calls.includes('fail_task_launch'));assert.ok(f.calls.includes('release'))}finally{f.cleanup()}
})
test('required context journal rejection rolls back bundle and cannot degrade to missing context',async()=>{
 const f=fixture();try{f.journalFail=true;const r=await f.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,false);assert.ok(f.calls.includes('revoke'));assert.ok(!f.calls.includes('spawn'));assert.equal(existsSync(path.join(f.root,'sessions',f.packet.sessionId)),false)}finally{f.cleanup()}
})
for(const unsupported of [{trigger:'chain'},{trigger:'operator',instruction:'override'},{trigger:'operator',admission:{sessionId:'fixed',receipt:{}}}])test(`required ${JSON.stringify(unsupported)} refuses before any admission or preparation`,async()=>{
 const f=fixture();try{const r=await f.launch({taskId:f.id.task,...unsupported});assert.equal(r.started,false);assert.equal(f.calls.length,0);assert.equal(f.reads.length,0)}finally{f.cleanup()}
})
test('shared required admission door refuses early chain and missing packet, never invokes resource or legacy RPC',async()=>{
 let calls=0;const f=preparedFixture(),resources={mode:'required',inputs:f.inputs,admit:async()=>{calls++;return {admitted:true}}},door=createAdmitExisting({rpc(){calls++}},resources)
 const input={estateId:f.id.estate,taskId:f.id.task,sessionId:f.id.session,trigger:'operator',actor:{kind:'system',id:'fixture'}}
 assert.equal((await door(input)).admitted,false);const captured=await f.inputs.prepare(f.request);assert.equal(captured.state,'observed')
 assert.equal((await door({...input,trigger:'chain'},captured.packet)).admitted,false);assert.equal(calls,0)
 assert.equal((await door(input,captured.packet)).admitted,true);assert.equal(calls,1)
})
test('bundle refuses foreign/copy packet before mint, even when exact bytes match',async()=>{
 const f=fixture();try{const r=await f.inputs.prepare(f.request);assert.equal(r.state,'observed');await assert.rejects(f.bundles.compile(f.id.session,f.id.project,f.id.task,'claude-code','mcp-config-flag',null,null,{...r.packet}));assert.equal(f.calls.length,0)}finally{f.cleanup()}
})

test('task changes during resource refresh are checked afterward before SQL/native spawn',async()=>{
 const f=fixture();try{f.resources.current=async()=>{f.task.instruction='changed while resource check awaited';return true}
 const r=await f.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,false);assert.ok(!f.calls.includes('spawn'));assert.ok(!f.calls.includes('validate_task_run_launch'))
 }finally{f.cleanup()}
})
