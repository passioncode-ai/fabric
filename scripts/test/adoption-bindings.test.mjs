import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateBindings} from '../check-adoption-bindings.mjs';

const commit='a'.repeat(40),scope='apps/desktop/src/shared/scope.ts',entity='apps/desktop/src/shared/entityRef.ts';
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const files=new Map([[scope,'export type Scope = { kind: string };\n'],[entity,'export interface EntityRef { id: string }\n'],['src/producer.ts','export function producer() {}\n']]);
 const anchor=(file,symbol)=>({file,symbol,kind:'export',line:1,sha256:sha(files.get(file))});
 const owner={file:'src/producer.ts',status:'existing-extension',authority:'candidate only'};
 const doc={schemaVersion:'fabric.adoption.producer-bindings@1',status:'source-bound',sourceCommit:commit,sourceStatus:'Immutable source inspection',date:'2026-09-17',proofTier:'source',receiptProduced:false,upstream:'AD00 separately checked',
  sharedExistingBindings:[anchor(scope,'Scope'),anchor(entity,'EntityRef')],
  proposedScopedReference:{name:'ScopedRevisionRef',ownerCandidate:entity,definition:'Readonly<{ scope: Scope; ref: EntityRef; revision: R | null }>',imports:{Scope:scope,EntityRef:entity},constraints:['Canonical imports only']},
  capabilities:['project-creation','source-observation','context-return','conversation','attention','execution','cycles','adoption'].map((name,i)=>({capability:name,semanticPort:name+'Port',semanticOutputs:[name+'Receipt'],currentReadiness:i===3?'missing':'partial',proofTier:'source-inspection-only',existingBindings:i===3?[]:[anchor('src/producer.ts','producer')],futureOwnerCandidates:Object.fromEntries(['shared','main','renderer','tests','ipc'].map(layer=>[layer,[{...owner}]])),currentMapping:{scope:'canonical scope',identity:'identity',revision:'revision',error:'explicit error',effectReceipt:'partial result',authority:'canonical authority'},missingMechanisms:['Runtime target port is incomplete'],downstreamPackets:['AD03']})),
  proposedDecisions:[{id:'proposal',choice:'Reuse journal'}],irreducibleAmbiguities:[{id:'A1',subject:'Runtime admission',requiredOwner:'AD15',detail:'Provider needs separate evidence'}],validation:{commands:['source inspection'],notRun:['Native admission']}};
 const readBlob=(source,file)=>{assert.equal(source,commit);return files.get(file)??null;};
 return {doc,files,readBlob};
}
function rejects(name,change,pattern){test(name,()=>{const f=fixture();change(f);assert.throws(()=>validateBindings(f.doc,{readBlob:f.readBlob}),pattern);});}
test('complete source bindings pass without claiming acceptance or runtime readiness',()=>{const f=fixture();const r=validateBindings(f.doc,{readBlob:f.readBlob});assert.equal(r.proofTier,'source');assert.equal(r.acceptance,false);assert.deepEqual(r.readiness,{partial:7,missing:1,ready:0});});
test('candidate preparation remains explicitly separate from source-bound schema',()=>{const f=fixture();f.doc.schemaVersion='fabric.adoption.producer-bindings.candidate@1';f.doc.status='candidate-preparation-only';assert.equal(validateBindings(f.doc,{readBlob:f.readBlob}).acceptance,false);});
test('future absent module can be proposed only as new',()=>{const f=fixture();f.doc.capabilities[0].futureOwnerCandidates.main=[{file:'src/new.ts',status:'proposed-new-module',authority:'candidate only'}];validateBindings(f.doc,{readBlob:f.readBlob});});
rejects('missing committed producer cannot be invented',f=>f.files.delete('src/producer.ts'),/missing committed producer/);
rejects('partial port requires a producer anchor',f=>f.doc.capabilities[0].existingBindings=[],/partial requires an existing producer/);
rejects('missing port cannot be relabelled ready',f=>f.doc.capabilities[3].currentReadiness='ready',/ready requires independent runtime/);
rejects('unsupported provider cannot become admitted from source declarations',f=>{const c=f.doc.capabilities.find(c=>c.capability==='execution');c.currentReadiness='ready';c.missingMechanisms=[];},/ready requires independent runtime\/admission/);
rejects('source inspection cannot claim native proof',f=>f.doc.proofTier='native',/source evidence cannot claim native/);
rejects('capability source inspection cannot claim native proof',f=>f.doc.capabilities[0].proofTier='native',/source inspection cannot prove native/);
rejects('validator cannot emit acceptance receipt',f=>f.doc.receiptProduced=true,/cannot produce acceptance/);
rejects('unknown top-level field fails closed',f=>f.doc.assumeReady=true,/unknown field assumeReady/);
rejects('unknown nested capability field fails closed',f=>f.doc.capabilities[0].providerSupported=true,/unknown field providerSupported/);
rejects('unknown owner field fails closed',f=>f.doc.capabilities[0].futureOwnerCandidates.main[0].grant=true,/unknown field grant/);
rejects('unknown binding field fails closed',f=>f.doc.sharedExistingBindings[0].wildcard=true,/unknown field wildcard/);
rejects('source hash drift fails',f=>f.files.set('src/producer.ts','export function producer() { return 1; }\n'),/source hash drift/);
rejects('moved declaration fails even with updated whole-file hash',f=>{const bytes='// heading\nexport function producer() {}\n';f.files.set('src/producer.ts',bytes);for(const c of f.doc.capabilities)for(const b of c.existingBindings)b.sha256=sha(bytes);},/moved\/missing export/);
rejects('nonexistent symbol cannot pass using a valid file hash',f=>f.doc.capabilities[0].existingBindings[0].symbol='invented',/moved\/missing export/);
rejects('declaration mentioned only in comment is not an export',f=>{const bytes='// export function producer() {}\n';f.files.set('src/producer.ts',bytes);for(const c of f.doc.capabilities)for(const b of c.existingBindings)b.sha256=sha(bytes);},/moved\/missing export/);
rejects('future existing owner must exist at source commit',f=>f.doc.capabilities[0].futureOwnerCandidates.main[0].file='src/missing.ts',/future owner existence mismatch/);
rejects('future new owner must not already exist',f=>f.doc.capabilities[0].futureOwnerCandidates.main[0].status='proposed-new-module',/future owner existence mismatch/);
rejects('future owner must declare existing or new',f=>f.doc.capabilities[0].futureOwnerCandidates.main[0].status='maybe',/explicitly existing\/new/);
rejects('partial state cannot hide missing mechanisms',f=>f.doc.capabilities[0].missingMechanisms=[],/partial\/missing requires explicit gaps/);
rejects('unknown readiness is not normalized',f=>f.doc.capabilities[0].currentReadiness='supported',/invalid readiness/);
rejects('capability omission fails independent coverage',f=>f.doc.capabilities.pop(),/capability coverage/);
rejects('mutable source ref is rejected',f=>f.doc.sourceCommit='HEAD',/full immutable SHA/);
rejects('duplicate Scope authority is rejected',f=>{f.files.set('src/other.ts',f.files.get(scope));f.doc.sharedExistingBindings[0].file='src/other.ts';},/duplicate authority Scope/);
rejects('proposed reference must import canonical EntityRef',f=>f.doc.proposedScopedReference.imports.EntityRef='src/second.ts',/canonical import changed/);
rejects('unsafe binding path is rejected',f=>f.doc.capabilities[0].existingBindings[0].file='../secrets',/unsafe file/);
test('multiline handler anchor binds the call argument',()=>{const f=fixture();const bytes='handle(\n  IPC.questionAnswer,\n  async () => {}\n)\n';f.files.set('src/handler.ts',bytes);f.doc.capabilities[0].existingBindings=[{file:'src/handler.ts',symbol:'IPC.questionAnswer',kind:'handler',line:2,sha256:sha(bytes)}];validateBindings(f.doc,{readBlob:f.readBlob});});
rejects('historical commented handler cannot serve as live producer',f=>{const bytes='  * Previously handle(IPC.attentionList, readAttention)\n';f.files.set('src/handler.ts',bytes);f.doc.capabilities[0].existingBindings=[{file:'src/handler.ts',symbol:'IPC.attentionList',kind:'handler',line:1,sha256:sha(bytes)}];},/not a handler/);

// The public re-creation of the history (scripts/lib/public-history.mjs). A document whose commit is
// not in this history is STALE: its structure is still checked, its sources verify nothing, and the
// reader-less mode is refused to anything that does not say so.
const staleHistory={state:'stale-pre-publication',since:'b'.repeat(40),reason:'shared[0] source hash drift apps/desktop/src/shared/scope.ts'};
test('stale bindings keep their structure checked and verify no source',()=>{const f=fixture();f.doc.sourceHistory={...staleHistory};const r=validateBindings(f.doc,{sources:'unavailable'});assert.equal(r.sources,'stale; not verified');assert.equal(r.committedFiles,0);assert.equal(r.acceptance,false);});
test('stale bindings are still refused a ready capability',()=>{const f=fixture();f.doc.sourceHistory={...staleHistory};f.doc.capabilities[3].currentReadiness='ready';assert.throws(()=>validateBindings(f.doc,{sources:'unavailable'}),/ready requires independent runtime/);});
rejects('bindings cannot skip their sources without saying they are stale',f=>{f.readBlob=undefined;},/committed source reader required/);
test('reader-less validation is refused to bindings that are not stale',()=>{const f=fixture();assert.throws(()=>validateBindings(f.doc,{sources:'unavailable'}),/only stale bindings/);});
rejects('stale history must name the commit it was re-validated at',f=>{f.doc.sourceHistory={...staleHistory,since:f.doc.sourceCommit};},/needs the commit it was re-validated at/);
rejects('stale history must carry its reason',f=>{f.doc.sourceHistory={...staleHistory,reason:' '};},/stale reason must be nonempty/);
rejects('unknown source history field fails closed',f=>{f.doc.sourceHistory={...staleHistory,verified:true};},/unknown field verified/);
rejects('a repin must name where it came from',f=>{f.doc.sourceHistory={state:'repinned',from:f.doc.sourceCommit,rule:'bindings-revalidated'};},/unsupported sourceHistory/);
