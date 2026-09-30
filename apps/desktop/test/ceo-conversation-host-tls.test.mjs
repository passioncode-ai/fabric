/** Owned TLS fixture. No production trust overrides, accounts or provider calls. */
import assert from 'node:assert/strict'
import https from 'node:https'
import net from 'node:net'
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createCeoConversationHost} from '../src/main/ceoConversationHost.ts'
const here=fileURLToPath(import.meta.url),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve}}
if(process.argv[2]!=='--child'){
 const oldMask=process.umask(0o077),dir=mkdtempSync(path.join(tmpdir(),'fabric-ceo-tls-'))
 try{
  const openssl=args=>{const r=spawnSync('openssl',args,{cwd:dir,env:{PATH:process.env.PATH??'',OPENSSL_CONF:'/dev/null'},timeout:10000,maxBuffer:1024*1024,encoding:'utf8'});assert.equal(r.status,0,'owned certificate generation failed')}
  openssl(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.pem','-subj','/CN=Fabric Owned Fixture CA','-days','1','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign'])
  openssl(['req','-new','-newkey','rsa:2048','-nodes','-keyout','leaf.key','-out','leaf.csr','-subj','/CN=Owned Loopback Fixture'])
  for(const [name,san,serial] of [['valid','IP:127.0.0.1','2'],['wrong','DNS:wrong.invalid','3']]){
   writeFileSync(path.join(dir,name+'.ext'),`basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\n`)
   openssl(['x509','-req','-in','leaf.csr','-CA','ca.pem','-CAkey','ca.key','-set_serial',serial,'-days','1','-extfile',name+'.ext','-out',name+'.pem'])
  }
  for(const mode of ['untrusted','trusted']){
   // NODE_EXTRA_CA_CERTS is read by Node at process start. No global trust store,
   // inherited NODE_OPTIONS, proxy, credential or TLS-verification override.
   const env={PATH:process.env.PATH??'',...(mode==='trusted'?{NODE_EXTRA_CA_CERTS:path.join(dir,'ca.pem')}:{})}
   const r=spawnSync(process.execPath,['--experimental-strip-types',here,'--child',dir,mode],{env,timeout:20000,maxBuffer:1024*1024,encoding:'utf8'})
   process.stdout.write(r.stdout??'');if(r.status!==0)process.stderr.write(r.stderr??'')
   assert.equal(r.status,0,`owned ${mode} TLS fixture failed`)
  }
 }finally{rmSync(dir,{recursive:true,force:true});process.umask(oldMask);assert.equal(existsSync(dir),false);console.log('PASS cleanup: ephemeral CA/private keys and temporary host directory removed')}
}else{
 const dir=process.argv[3],trusted=process.argv[4]==='trusted',resources=[]
 let groups=0
 const test=async(name,fn)=>{await fn();groups++;console.log('PASS '+name)}
 const deadline=(promise)=>Promise.race([promise,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('fixture deadline')),3000);t.unref()})])
 async function fixture({wrong=false,proxy=false,timeoutMs=1000}={}){
  const state={valid:true},received=[],tlsErrors=[],allSockets=new Set();let writes=0,secure=0,applicationWrites=0
  const server=https.createServer({key:readFileSync(path.join(dir,'leaf.key')),cert:readFileSync(path.join(dir,wrong?'wrong.pem':'valid.pem'))},async(req,res)=>{
   let body='';for await(const chunk of req)body+=chunk
   const args=JSON.parse(body);received.push({url:req.url,headers:req.headers,args})
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,conversation_id:args.p_conversation_id,revision:0,receipt_seq:1,repeated:false}))
  })
  const track=s=>{allSockets.add(s);s.on('close',()=>allSockets.delete(s));s.on('error',()=>{})}
  let bridge
  resources.push(async()=>{const closed=[...allSockets].map(s=>new Promise(r=>s.once('close',r)));for(const s of allSockets)s.destroy();await Promise.all([...closed,new Promise(r=>server.close(r)),...(bridge?[new Promise(r=>bridge.close(r))]:[])]);assert.equal(allSockets.size,0)})
  server.on('connection',track);server.on('tlsClientError',()=>{})
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let port=server.address().port,release
  const connected=deferred()
  if(proxy){
   bridge=net.createServer(client=>{track(client);client.pause();connected.resolve();release=()=>{const upstream=net.connect({host:'127.0.0.1',port:server.address().port},()=>{client.pipe(upstream);upstream.pipe(client);client.resume()});track(upstream);client.on('close',()=>upstream.destroy());upstream.on('close',()=>client.destroy())}})
   await new Promise(r=>bridge.listen(0,'127.0.0.1',r));port=bridge.address().port
  }
  const subject={personId:id(2),revision:1,source:'authenticated',role:'owner',displayName:'fixture',authUser:null}
  const identity={held:()=>state.valid?subject:null,actor:()=>({kind:'person',id:subject.personId}),guard:async()=>state.valid?{ok:true,subject}:{ok:false,why:'not_a_member',says:'unavailable'}}
  const host=createCeoConversationHost({rootDir:dir,estateId:id(1),identity,connection:{url:`https://127.0.0.1:${port}`,serviceKey:'synthetic-owned-tls-key'},online:()=>true,timeoutMs})
  const open=async()=>{
   const original=https.request
   // Observe the actual ClientRequest end edge and real TLS event. No CA,
   // hostname or verification option is changed by this instrumentation.
   https.request=(...args)=>{const req=original(...args),end=req.end;req.on('error',e=>{if(tlsErrors.length<4)tlsErrors.push(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID'].includes(e.code)?e.code:'other')});req.end=function(...a){writes++;return end.apply(this,a)};req.prependOnceListener('socket',s=>{const write=s.write;s.write=function(...a){applicationWrites++;return write.apply(this,a)};s.prependOnceListener('secureConnect',()=>secure++)});return req}
   try{return await host.open({operationId:id(4),conversationId:id(3),subjectKind:'global',subjectId:id(3)})}finally{https.request=original}
  }
  return {state,received,tlsErrors,open,connected:connected.promise,release:()=>release(),counts:()=>({writes,secure,applicationWrites})}
 }
 try{
  if(!trusted){
   await test('untrusted local certificate refuses before any HTTP request/header/body write',async()=>{const f=await fixture();const r=await f.open();assert.equal(r.ok,false);assert.deepEqual(f.counts(),{writes:0,secure:0,applicationWrites:0});assert.equal(f.received.length,0);assert(f.tlsErrors.some(c=>['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(c)));assert(!JSON.stringify(r).includes('synthetic-owned-tls-key'))})
  }else{
   await test('per-process extra CA trusts owned chain and verifies loopback IP before the exact RPC write',async()=>{const f=await fixture(),r=await f.open();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(f.counts().writes,1);assert.equal(f.counts().secure,1);assert(f.counts().applicationWrites>0);assert.equal(f.received.length,1);const q=f.received[0];assert.equal(q.url,'/rest/v1/rpc/ceo_open_conversation');assert.equal(q.headers.authorization,'Bearer synthetic-owned-tls-key');assert.equal(q.args.p_person_id,id(2));assert.equal(q.args.p_estate_id,id(1))})
   await test('trusted chain with wrong hostname refuses before any HTTP write',async()=>{const f=await fixture({wrong:true});assert.equal((await f.open()).ok,false);assert.deepEqual(f.counts(),{writes:0,secure:0,applicationWrites:0});assert.equal(f.received.length,0);assert(f.tlsErrors.includes('ERR_TLS_CERT_ALTNAME_INVALID'))})
   await test('authority revoked during a delayed actual TLS handshake fences secureConnect before HTTP',async()=>{const f=await fixture({proxy:true}),pending=f.open();await deadline(f.connected);f.state.valid=false;f.release();assert.equal((await pending).ok,false);assert.deepEqual(f.counts(),{writes:0,secure:1,applicationWrites:0});assert.equal(f.received.length,0)})
   await test('handshake that never completes has a bounded outcome and no HTTP write',async()=>{const f=await fixture({proxy:true,timeoutMs:30}),pending=f.open();await deadline(f.connected);assert.equal((await pending).state,'commit_unknown');assert.deepEqual(f.counts(),{writes:0,secure:0,applicationWrites:0});assert.equal(f.received.length,0)})
  }
  console.log(`PASS ${groups} ${trusted?'trusted':'untrusted'} actual owned TLS groups; no database/model/external network calls`)
 }finally{for(const close of resources.reverse())await close();console.log('PASS cleanup: owned HTTPS/proxy servers and TLS sockets closed')}
}
