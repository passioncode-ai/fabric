/** Trusted native host only. This factory never accepts renderer-supplied
 * identity, RPC names or credentials. No global SDK/fetch mutation or retries. */
import http from 'node:http'
import https from 'node:https'
import { performance } from 'node:perf_hooks'
import type { Identity } from './identity.ts'
import { createCeoConversationService, type CeoTrustedIdentity } from './ceoConversationService.ts'
import { ceoId, ceoInt, ceoJson, ceoObject } from '../shared/ceoConversationDraft.ts'

export interface CeoConversationHostOptions {
 rootDir:string
 estateId:string
 identity:Pick<Identity,'held'|'guard'|'actor'>
 connection:{url:string;serviceKey:string;allowLoopbackHttp?:boolean}
 online:()=>boolean
 timeoutMs?:number
}
const RESPONSE_BYTES=4*1024*1024, REQUEST_BYTES=128*1024
const failure=()=>({data:null,error:{message:'ceo_transport_unavailable'}})
const paths=Object.freeze({open:'ceo_open_conversation',send:'ceo_send_message',read:'ceo_read_conversation',receipt:'ceo_send_receipt'})
/** A single long-lived instance per trusted desktop owner. Keep this object in
 * main; its methods are not an IPC authorization layer or a backup mechanism. */
export function createCeoConversationHost(options:CeoConversationHostOptions){
 const estateId=options.estateId, identity=options.identity, rootDir=options.rootDir, online=options.online
 const timeoutMs=options.timeoutMs??10000
 if(!ceoId(estateId)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('invalid_ceo_host_configuration')
 const configuredUrl=options.connection.url
 if(typeof configuredUrl!=='string'||configuredUrl.length>4096||/[\s?#]/.test(configuredUrl))throw Error('invalid_ceo_host_configuration')
 let base:URL
 try{base=new URL(configuredUrl)}catch{throw Error('invalid_ceo_host_configuration')}
 const loopback=['127.0.0.1','[::1]','localhost'].includes(base.hostname)
 if(base.username||base.password||base.search||base.hash||!['http:','https:'].includes(base.protocol)||
    base.protocol==='http:'&&!(loopback&&options.connection.allowLoopbackHttp===true))throw Error('invalid_ceo_host_configuration')
 const key=options.connection.serviceKey
 if(typeof key!=='string'||key.length<1||key.length>16384||!/^[\x21-\x7e]+$/.test(key))throw Error('invalid_ceo_host_configuration')
 const prefix=base.pathname.replace(/\/$/,'')+'/rest/v1/rpc/'
 const urls=Object.fromEntries(Object.entries(paths).map(([method,name])=>{const u=new URL(base);u.pathname=prefix+name;return [method,u]})) as Record<keyof typeof paths,URL>
 const snapshot=(subject:ReturnType<Identity['held']>):CeoTrustedIdentity|null=>{
  if(!subject||!ceoId(subject.personId)||!ceoInt(subject.revision)||subject.revision<1)return null
  const actor=ceoObject(identity.actor(),['kind','id'])
  if(!actor||actor.kind!=='person'||typeof actor.id!=='string')return null
  return {estateId,personId:subject.personId,revision:subject.revision,actor:actor as CeoTrustedIdentity['actor']}
 }
 const held=()=>{try{return snapshot(identity.held())}catch{/* Fixed unavailable identity; never retain private identity-port diagnostics. */return null}}
 // Identity.guard has no cancellation port. Retain ownership until its raw
 // promise settles; a core timeout must not launch a second membership request.
 // Concurrent calls fail unavailable instead of retaining unbounded waiters.
 let pendingGuard:Promise<CeoTrustedIdentity|null>|undefined
 const guard=():Promise<CeoTrustedIdentity|null>=>{
  if(pendingGuard)return Promise.resolve(null)
  const task=Promise.resolve().then(()=>identity.guard()).then(result=>result.ok?snapshot(result.subject):null).catch(()=>null)
  pendingGuard=task
  void task.then(()=>{if(pendingGuard===task)pendingGuard=undefined})
  return task
 }
 const request=(method:keyof typeof paths,args:unknown,stillAllowed:()=>boolean):Promise<{data:unknown;error?:{message:string}|null}>=>{
  const deadline=performance.now()+timeoutMs
  const allowed=()=>{try{return performance.now()<deadline&&stillAllowed()&&performance.now()<deadline}catch{/* A failed fence refuses the effect; raw authority errors are private. */return false}}
  let body:Buffer
  try{body=Buffer.from(JSON.stringify(ceoJson(args,REQUEST_BYTES)));if(body.length>REQUEST_BYTES||!allowed())return Promise.resolve(failure())}catch{/* The fixed transport refusal is observable; request content must not enter ops logs. */return Promise.resolve(failure())}
  return new Promise(resolve=>{
   let settled=false, req:http.ClientRequest|undefined, timer:ReturnType<typeof setTimeout>|undefined
   const finish=(data?:unknown)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);req?.destroy();resolve(data===undefined?failure():{data,error:null})}
   try{
    if(!allowed()){finish();return}
    timer=setTimeout(()=>finish(),Math.max(1,deadline-performance.now()))
    // agent:false prevents a pooled, already-authenticated socket from bypassing
    // the connect/TLS boundary. No header/body is flushed before its fresh fence.
    req=(base.protocol==='https:'?https:http).request(urls[method],{method:'POST',agent:false,maxHeaderSize:16384,
     headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json','Accept':'application/json','Content-Length':body.length}},res=>{
      if(settled||!allowed()||res.statusCode!==200||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'||!/^application\/json(?:\s*;|$)/i.test(res.headers['content-type']??'')){res.destroy();finish();return}
      const length=res.headers['content-length'];if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>RESPONSE_BYTES)){res.destroy();finish();return}
      const chunks:Buffer[]=[];let size=0
      res.on('data',(chunk:Buffer)=>{if(settled)return;if(!allowed()||(size+=chunk.length)>RESPONSE_BYTES){res.destroy();finish();return}chunks.push(chunk)})
      res.on('aborted',()=>finish());res.on('error',()=>finish())
      res.on('end',()=>{
       if(settled||!allowed()){finish();return}
       try{const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size));const data=ceoJson(JSON.parse(text),RESPONSE_BYTES);if(!allowed()){finish();return}finish(data)}catch{/* finish exposes a fixed refusal and cleans the owned socket without logging private bytes. */finish()}
      })
     })
    req.on('error',()=>finish())
    req.on('socket',socket=>{
     const send=()=>{if(settled||base.protocol==='http:'&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(socket.remoteAddress??'')||!allowed()){finish();return}try{req!.end(body)}catch{/* finish exposes a fixed refusal and cleans the owned socket without logging private bytes. */finish()}}
     socket.once(base.protocol==='https:'?'secureConnect':'connect',send)
    })
   }catch{/* finish exposes a fixed refusal and cleans the owned socket without logging private bytes. */finish()}
  })
 }
 return createCeoConversationService({rootDir,identity:{held,guard},online,timeoutMs,rpc:{
  open:(args,fence)=>request('open',args,fence),send:(args,fence)=>request('send',args,fence),
  read:(args,fence)=>request('read',args,fence),receipt:(args,fence)=>request('receipt',args,fence)
 }})
}
