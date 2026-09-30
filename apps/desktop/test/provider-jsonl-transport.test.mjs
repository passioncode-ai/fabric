import assert from 'node:assert/strict'
import { PassThrough, Writable } from 'node:stream'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createProviderJsonlTransport, PROVIDER_RPC_LIMITS as limits } from '../src/main/providerJsonlTransport.ts'
const tick=()=>new Promise(r=>setTimeout(r,0))
function fixture(extra={}) {
 const input=new PassThrough(),writes=[],events=[],closed=[]
 const output=new Writable({write(b,_,cb){writes.push(JSON.parse(b.toString()));cb()}})
 const rpc=createProviderJsonlTransport({input,output,timeoutMs:50,onNotification:(method,params)=>events.push({method,params}),onClosed:r=>closed.push(r),...extra})
 return{input,output,writes,events,closed,rpc,send:v=>input.write(Buffer.from(JSON.stringify(v)+'\n')),end:()=>{rpc.close();input.destroy();output.destroy()}}
}
{
 const f=fixture(),p=f.rpc.request('turn/interrupt',{threadId:'thread',turnId:'turn'})
 const id=f.writes[0].id
 f.send({id,result:{}});assert.deepEqual(await p,{status:'reply',result:{}})
 f.send({id,result:{duplicate:true}});assert.equal(f.rpc.closed,null)
 const line=Buffer.from(JSON.stringify({method:'turn/completed',params:{text:'Привет 🌿'}})+'\n')
 for(const byte of line)f.input.write(Buffer.from([byte]))
 assert.equal(f.events[0].params.text,'Привет 🌿')
 assert.equal(f.rpc.notify('initialized').status,'submitted');f.end()
}
{
 const f=fixture({timeoutMs:2}),p=f.rpc.request('turn/interrupt',{}),id=f.writes[0].id
 assert.deepEqual(await p,{status:'outcome_unknown',reason:'deadline'})
 f.send({id,result:{}});assert.equal(f.writes.length,1,'no blind resend');f.end()
}
{
 const f=fixture({timeoutMs:2}),p=f.rpc.request('turn/interrupt',{})
 const until=performance.now()+8;while(performance.now()<until){}
 f.send({id:f.writes[0].id,result:{}})
 assert.equal((await p).status,'outcome_unknown','late reply cannot beat a starved timeout callback');f.end()
}
for(const payload of [{id:'foreign',result:{}},{method:['turn/completed'],params:{}},{jsonrpc:'1.0',method:'changed'},[],{id:1,result:{}}]) {
 const f=fixture(),p=f.rpc.request('turn/interrupt',{})
 f.send(payload);assert.equal((await p).status,'outcome_unknown');assert(f.rpc.closed);f.end()
}
for(const error of [{code:['1']},null,{code:1.5}]) {
 const f=fixture(),p=f.rpc.request('x',{});f.send({id:f.writes[0].id,error})
 assert.equal((await p).status,'outcome_unknown');f.end()
}
{
 const f=fixture(),p=f.rpc.request('x',{});f.send({id:f.writes[0].id,error:{code:-32000,message:'secret-canary'}})
 assert.deepEqual(await p,{status:'error',code:-32000});assert(!JSON.stringify(f.closed).includes('secret-canary'));f.end()
}
{
 const f=fixture();f.send({method:'item/commandExecution/requestApproval',id:1,params:{}})
 assert.equal(f.writes[0].error.code,-32601);assert.equal(f.events.length,0);f.end()
}
{
 const f=fixture(),pending=Array.from({length:limits.pending},()=>f.rpc.request('x',{}))
 assert.deepEqual(await f.rpc.request('x',{}),{status:'not_sent',reason:'pending_limit'})
 f.rpc.close();assert((await Promise.all(pending)).every(p=>p.status==='outcome_unknown'));f.end()
}
{
 const f=fixture();assert.equal((await f.rpc.request('x',{large:'x'.repeat(limits.frameBytes)})).status,'not_sent')
 const circle={};circle.circle=circle;assert.equal((await f.rpc.request('x',circle)).status,'not_sent')
 assert.equal(f.writes.length,0);f.end()
}
for(const kind of ['oversized','deep','invalid-utf8','truncated','fragments','bad-json']) {
 const f=fixture(),p=f.rpc.request('x',{})
 if(kind==='oversized')f.input.write(Buffer.alloc(limits.frameBytes,97))
 if(kind==='deep')f.input.write(Buffer.from('['.repeat(70)+'0'+']'.repeat(70)+'\n'))
 if(kind==='invalid-utf8')f.input.write(Buffer.from([0xc3,0x28,10]))
 if(kind==='truncated'){f.input.write(Buffer.from('{'));f.input.end()}
 if(kind==='fragments')for(let n=0;n<=limits.fragments;n++)f.input.write(Buffer.from('x'))
 if(kind==='bad-json')f.input.write(Buffer.from('secret-canary\n'))
 assert.equal((await p).status,'outcome_unknown',kind)
 assert(!JSON.stringify(f.closed).includes('secret-canary'));f.end()
}
{
 let callback
 const output=new Writable({highWaterMark:1,write(_b,_e,cb){callback=cb}}),f=fixture({output})
 const p=f.rpc.request('x',{})
 assert.equal((await f.rpc.request('x',{})).status,'not_sent')
 f.rpc.close();callback(Error('secret-canary'));await tick()
 assert.equal((await p).status,'outcome_unknown');output.destroy();f.end()
}
for(const consumer of [()=>{throw Error('secret-canary')},async()=>{throw Error('secret-canary')}]) {
 const f=fixture({onNotification:consumer}),p=f.rpc.request('x',{})
 f.send({method:'turn/completed'});assert.equal((await p).status,'outcome_unknown');await tick();f.end()
}
{
 const f=fixture({onClosed:async()=>{throw Error('secret-canary')}})
 f.rpc.close();await tick();f.end() // An unhandled rejection fails this process.
}
for(const timeoutMs of [NaN,Infinity,-Infinity,'2']) {
 const f=fixture({timeoutMs}),p=f.rpc.request('x',{})
 await new Promise(r=>setTimeout(r,5));f.send({id:f.writes[0].id,result:{}})
 assert.equal((await p).status,'reply','invalid timeout uses finite default');f.end()
}
for(const operation of ['request','notify']) {
 const f=fixture(),params={toJSON(){f.rpc.close();return {safe:true}}}
 const result=await f.rpc[operation]('effect',params)
 assert.equal(result.status,'not_sent');assert.equal(f.writes.length,0);f.end()
}
{
 const input=new PassThrough();input.destroy();await tick()
 const f=fixture({input})
 assert.equal((await f.rpc.request('effect',{})).status,'not_sent');assert.equal(f.writes.length,0);f.end()
}
{
 const f=fixture(),children=[]
 const p=f.rpc.request('outer',{toJSON(){for(let n=0;n<limits.pending;n++)children.push(f.rpc.request('nested',{}));return {}}})
 assert.deepEqual(await p,{status:'not_sent',reason:'pending_limit'});assert.equal(f.writes.length,limits.pending)
 f.rpc.close();await Promise.all(children);f.end()
}
// Real owned child pipes: framing/close behavior is not only EventEmitter fakes.
{
 const f=fixture({timeoutMs:2}),p=f.rpc.request('effect',{},()=>{const until=performance.now()+15;while(performance.now()<until){};return true})
 assert.deepEqual(await p,{status:'not_sent',reason:'deadline'});assert.equal(f.writes.length,0);f.end()
}
for(const operation of ['request','notify'])for(const guard of [()=>false,()=>1,()=>({}),async()=>{throw Error('private guard error')},()=>{throw Error('private guard error')}]) {
 const f=fixture();assert.deepEqual(await f.rpc[operation]('effect',{},guard),{status:'not_sent',reason:'effect_fenced'})
 assert.equal(f.writes.length,0);await tick();f.end()
}
for(const operation of ['request','notify']) {
 const f=fixture();let allowed=true
 const params={toJSON(){allowed=false;return {}}}
 assert.equal((await f.rpc[operation]('effect',params,()=>allowed)).status,'not_sent');assert.equal(f.writes.length,0);f.end()
}
{
 const f=fixture(),p=f.rpc.request('effect',{},()=>{f.rpc.close();return true})
 assert.equal((await p).status,'outcome_unknown');assert.equal(f.writes.length,0);f.end()
}
{
 const child=spawn(process.execPath,['-e',`
 let b='';process.stdin.on('data',c=>{b+=c;let n;while((n=b.indexOf('\\n'))>=0){
 const m=JSON.parse(b.slice(0,n));b=b.slice(n+1);
 const reply=JSON.stringify({id:m.id,result:{accepted:true}})+'\\n';
 process.stdout.write(reply.slice(0,7));setTimeout(()=>process.stdout.write(reply.slice(7)),2);
 }});process.stdin.on('end',()=>process.exit(0));
 `],{stdio:['pipe','pipe','ignore']})
 const exit=once(child,'exit')
 const rpc=createProviderJsonlTransport({input:child.stdout,output:child.stdin,onNotification:()=>{},timeoutMs:1000})
 try {assert.deepEqual(await rpc.request('turn/interrupt',{}),{status:'reply',result:{accepted:true}})}
 finally {rpc.close();child.stdin.end();const cleanup=setTimeout(()=>child.kill('SIGKILL'),1000);await exit;clearTimeout(cleanup)}
}
console.log('PASS bounded provider JSONL transport: correlation, deadlines, framing, backpressure, refusal and no replay')
