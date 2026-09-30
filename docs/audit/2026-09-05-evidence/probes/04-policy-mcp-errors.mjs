// Captured from the audit invocation; saved afterwards without rerunning.
// No real DB. Actual modules + injected DB responses + ephemeral loopback HTTP.
import { Policy } from 'apps/desktop/src/main/policy.ts';
import { AgentSurface } from 'apps/desktop/src/main/agentSurface.ts';
const grant={id:'g',estate_id:'e',floor_class:'deletion',target:'f',expires_at:'2099-01-01',consumed_at:null};
const events=[];let inserts=0,updates=0;
const chain=data=>new Proxy(Promise.resolve(data),{get(p,k){if(['then','catch','finally'].includes(k))return p[k].bind(p);return ()=>chain(data)}});
const db={from:table=>({select:()=>chain({data:{...grant},error:null}),insert:()=>{inserts++;return chain({error:null})},update:()=>{updates++;return chain({error:{message:'injected update failure'}})}})};
const journal={append:async e=>{events.push(e);return {seq:events.length}}};
const p=new Policy({db,journal});const req={estateId:'e',projectId:'p',actionClass:'file.overwrite',floorClass:'deletion',target:'f',actor:{kind:'person',id:'op'},grantId:'g'};
const d=await Promise.all([p.decide(req),p.decide(req)]);console.log('same one-shot concurrent decisions:',d.map(x=>x.verdict));
await Promise.all(d.map(x=>p.recordEffect(req,x)));console.log('receipts after consumed_at update failed:',{inserts,updates,consumedEvents:events.filter(e=>e.type==='grant.consumed@1').length});
const errorsDb={from:()=>chain({data:null,error:{message:'injected DB outage'}})};
const surface=new AgentSurface({db:errorsDb,journal,ptys:()=>({list:()=>[]}),estateId:'00000000-0000-0000-0000-0000000000fe'});await surface.start();
const scope=surface.mint('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000ab',null);
const headers={'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+scope.token};
const init=await fetch(surface.endpoint,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'audit',version:'1'}}})});
headers['mcp-session-id']=init.headers.get('mcp-session-id');await init.text();
const response=await fetch(surface.endpoint,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'fabric_memory_search',arguments:{query:'exists'}}})});
console.log('MCP database outage result:',await response.text());console.log('MCP logged hits for outage:',events.at(-1).payload.hits);await surface.stop();
