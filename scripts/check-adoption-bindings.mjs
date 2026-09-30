import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const need=(value,message)=>{if(!value)throw Error(message)};
const text=(value,label)=>need(typeof value==='string'&&value.trim().length>0,label+' must be nonempty text');
const exact=(value,keys,label,optional=[])=>{
 need(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');
 for(const key of Object.keys(value))need(keys.includes(key)||optional.includes(key),label+' unknown field '+key);
 for(const key of keys)need(Object.hasOwn(value,key),label+' missing field '+key);
};
const strings=(value,label,allowEmpty=false)=>{need(Array.isArray(value)&&(allowEmpty||value.length>0),label+' must be an array');value.forEach(v=>text(v,label));need(new Set(value).size===value.length,label+' duplicates');};
const safeFile=(file)=>{text(file,'file');need(!path.isAbsolute(file)&&!file.includes('\\')&&!file.includes(':')&&!/[\x00-\x1f]/.test(file)&&file.split('/').every(s=>s&&s!=='.'&&s!=='..'),'unsafe file '+file);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const capabilityNames=['project-creation','source-observation','context-return','conversation','attention','execution','cycles','adoption'];
const canonical={Scope:'apps/desktop/src/shared/scope.ts',EntityRef:'apps/desktop/src/shared/entityRef.ts'};

/** Source evidence only. readBlob(commit, path) returns committed text or null for absent paths.
 * Never reads a working tree as proof; never produces a packet or runtime admission receipt. */
export function validateBindings(doc,{readBlob}){
 need(typeof readBlob==='function','committed source reader required');
 exact(doc,['schemaVersion','status','sourceCommit','sourceStatus','date','proofTier','receiptProduced','upstream','sharedExistingBindings','proposedScopedReference','capabilities','proposedDecisions','irreducibleAmbiguities','validation'],'bindings');
 const candidate=doc.schemaVersion==='fabric.adoption.producer-bindings.candidate@1';
 need(candidate||doc.schemaVersion==='fabric.adoption.producer-bindings@1','unsupported schema');
 need(doc.status===(candidate?'candidate-preparation-only':'source-bound'),'schema/status mismatch');
 need(/^[a-f0-9]{40}$/.test(doc.sourceCommit),'sourceCommit must be full immutable SHA');
 text(doc.sourceStatus,'sourceStatus');text(doc.upstream,'upstream');
 need(/^\d{4}-\d{2}-\d{2}$/.test(doc.date)&&!Number.isNaN(Date.parse(doc.date)),'invalid date');
 need(doc.proofTier==='source','source evidence cannot claim native or runtime proof');
 need(doc.receiptProduced===false,'binding validation cannot produce acceptance receipt');
 const cache=new Map(),anchors=new Set();
 const blob=file=>{safeFile(file);if(!cache.has(file))cache.set(file,readBlob(doc.sourceCommit,file));const got=cache.get(file);need(got===null||typeof got==='string','reader must return committed text or null');return got;};
 function binding(b,label){
  exact(b,['file','symbol','kind','line','sha256'],label);text(b.symbol,label+' symbol');
  need(['export','handler','closure','comment'].includes(b.kind),label+' unsupported binding kind');
  need(Number.isInteger(b.line)&&b.line>0,label+' invalid line');need(/^[a-f0-9]{64}$/.test(b.sha256),label+' invalid sha256');
  const bytes=blob(b.file);need(bytes!==null,label+' missing committed producer '+b.file);need(hash(bytes)===b.sha256,label+' source hash drift '+b.file);
  const line=bytes.split('\n')[b.line-1];need(typeof line==='string',label+' moved/missing symbol line '+b.file);
  if(b.kind==='export')need(new RegExp('^\\s*export\\s+(?:(?:declare|async)\\s+)*(?:type|interface|class|function|const|let|var|enum)\\s+'+escapeRegex(b.symbol)+'(?=\\W|$)').test(line),label+' moved/missing export '+b.symbol);
  else {need(line.includes(b.symbol),label+' moved/missing anchor '+b.symbol);if(b.kind==='handler'){const context=bytes.split('\n').slice(Math.max(0,b.line-2),b.line).join('\n');need(!/^\s*(?:\/\/|\/\*|\*)/.test(line)&&/\bhandle\s*\(/.test(context),label+' not a handler');}if(b.kind==='closure')need(/\b(?:const|let|function)\b/.test(line),label+' not a closure');if(b.kind==='comment')need(/^\s*(?:\/\/|\/\*|\*)/.test(line),label+' not a comment');}
  if(Object.hasOwn(canonical,b.symbol))need(b.file===canonical[b.symbol]&&b.kind==='export','duplicate authority '+b.symbol);
  anchors.add(b.file+':'+b.line+':'+b.symbol);
 }
 need(Array.isArray(doc.sharedExistingBindings)&&doc.sharedExistingBindings.length>0,'shared bindings required');
 doc.sharedExistingBindings.forEach((b,i)=>binding(b,'shared['+i+']'));
 for(const [symbol,file]of Object.entries(canonical))need(doc.sharedExistingBindings.some(b=>b.file===file&&b.symbol===symbol&&b.kind==='export'),'missing canonical '+symbol);
 const scoped=doc.proposedScopedReference;
 exact(scoped,['name','ownerCandidate','definition','imports','constraints'],'scoped reference');
 need(scoped.name==='ScopedRevisionRef'&&scoped.ownerCandidate===canonical.EntityRef,'scoped reference must extend canonical owner');
 need(scoped.definition==='Readonly<{ scope: Scope; ref: EntityRef; revision: R | null }>','scoped reference must reuse canonical authority types');
 exact(scoped.imports,['Scope','EntityRef'],'scoped imports');for(const [key,file]of Object.entries(canonical))need(scoped.imports[key]===file,'canonical import changed '+key);strings(scoped.constraints,'scoped constraints');
 need(Array.isArray(doc.capabilities),'capabilities must be an array');
 need(JSON.stringify(doc.capabilities.map(c=>c.capability).sort())===JSON.stringify([...capabilityNames].sort()),'capability coverage/duplicate mismatch');
 const ports=new Set(),outputs=new Set(),readiness={partial:0,missing:0,ready:0};
 for(const c of doc.capabilities){
  const label=c.capability;
  exact(c,['capability','semanticPort','semanticOutputs','currentReadiness','proofTier','existingBindings','futureOwnerCandidates','currentMapping','missingMechanisms','downstreamPackets'],label);
  text(c.semanticPort,label+' port');need(!ports.has(c.semanticPort),'duplicate semantic port');ports.add(c.semanticPort);
  strings(c.semanticOutputs,label+' outputs');for(const output of c.semanticOutputs){need(!outputs.has(output),'duplicate semantic output');outputs.add(output);}
  need(['partial','missing','ready'].includes(c.currentReadiness),label+' invalid readiness');
  need(c.proofTier==='source-inspection-only',label+' source inspection cannot prove native readiness');
  strings(c.missingMechanisms,label+' gaps',true);
  // This source-only schema has no runtime receipts. Accepting "ready" here
  // would turn static provider declarations into admission or missing ports into producers.
  need(c.currentReadiness!=='ready',label+' ready requires independent runtime/admission evidence, unavailable in source-only schema');
  need(c.missingMechanisms.length>0,label+' partial/missing requires explicit gaps');
  need(Array.isArray(c.existingBindings),label+' bindings required');
  if(c.currentReadiness==='partial')need(c.existingBindings.some(b=>b.kind!=='comment'),label+' partial requires an existing producer anchor; otherwise missing');
  c.existingBindings.forEach((b,i)=>binding(b,label+'['+i+']'));readiness[c.currentReadiness]++;
  exact(c.currentMapping,['scope','identity','revision','error','effectReceipt','authority'],label+' mapping');Object.values(c.currentMapping).forEach(v=>text(v,label+' mapping'));
  exact(c.futureOwnerCandidates,['shared','main','renderer','tests','ipc'],label+' future owners');
  for(const [layer,owners]of Object.entries(c.futureOwnerCandidates)){
   need(Array.isArray(owners)&&owners.length>0,label+' '+layer+' owners missing');const seen=new Set();
   for(const owner of owners){exact(owner,['file','status','authority'],label+' owner');need(!seen.has(owner.file),label+' duplicate owner');seen.add(owner.file);text(owner.authority,label+' owner authority');
    need(['existing-extension','proposed-new-module'].includes(owner.status),label+' owner must be explicitly existing/new');
    need((blob(owner.file)!==null)===(owner.status==='existing-extension'),label+' future owner existence mismatch '+owner.file);
   }
  }
  strings(c.downstreamPackets,label+' packets');for(const id of c.downstreamPackets)need(/^AD(?:0\d|1\d|2[0-4])$/.test(id),label+' unknown packet '+id);
 }
 need(Array.isArray(doc.proposedDecisions)&&doc.proposedDecisions.length>0,'decisions required');const decisionIds=new Set();
 for(const d of doc.proposedDecisions){exact(d,['id','choice'],'decision',['status','sources','caveat']);text(d.id,'decision id');need(!decisionIds.has(d.id),'duplicate decision');decisionIds.add(d.id);text(d.choice,'choice');for(const k of ['status','caveat'])if(Object.hasOwn(d,k))text(d[k],k);if(Object.hasOwn(d,'sources'))strings(d.sources,'decision sources');}
 need(Array.isArray(doc.irreducibleAmbiguities),'ambiguities must be an array');const ambiguityIds=new Set();
 for(const a of doc.irreducibleAmbiguities){exact(a,['id','subject','requiredOwner','detail'],'ambiguity');Object.values(a).forEach(v=>text(v,'ambiguity'));need(!ambiguityIds.has(a.id),'duplicate ambiguity');ambiguityIds.add(a.id);}
 exact(doc.validation,['commands','notRun'],'validation');strings(doc.validation.commands,'commands');strings(doc.validation.notRun,'notRun');
 return {proofTier:'source',acceptance:false,capabilities:doc.capabilities.length,anchors:anchors.size,committedFiles:[...cache.values()].filter(v=>v!==null).length,readiness};
}

export function committedReader(root,commit){
 need(/^[a-f0-9]{40}$/.test(commit),'invalid sourceCommit');
 const resolved=execFileSync('git',['rev-parse','--verify',commit+'^{commit}'],{cwd:root,encoding:'utf8'}).trim();need(resolved===commit,'sourceCommit is not a commit');
 const paths=new Set(execFileSync('git',['ls-tree','-r','--name-only',commit],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).trimEnd().split('\n'));
 return (requestedCommit,file)=>{need(requestedCommit===commit,'reader commit mismatch');safeFile(file);return paths.has(file)?execFileSync('git',['show',commit+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}):null;};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const file=process.argv[2]??'docs/launch/adoption/contract-bindings.json';
 const doc=JSON.parse(readFileSync(path.resolve(root,file),'utf8'));
 console.log('PASS committed source bindings '+JSON.stringify(validateBindings(doc,{readBlob:committedReader(root,doc.sourceCommit)}))+'. Not native/provider admission or AD01 acceptance.');
}
