import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {integrationState,transitionIntegration,renderIntegrations,fixtureSha256} from '../product/integrations.mjs'
const initial=()=>integrationState({}),ctx={project:'atlas',provider:'codex',revision:'demo-2',roleSlot:'reviewer',memberRole:'owner',interaction:'review-AT47',read:'ready'},step=(d,type,data={},extra={})=>transitionIntegration(d,{type,data},{...ctx,...extra}),recipe={intent:'adapt',consumer:'Atlas-review',source:'fixture/provider',transport:'mcp',capabilities:['review'],integrity:'pass'},con={subject:'demo-secondary',resources:['orbit-api'],agents:['reviewer'],ceiling:'read'}
test('fixture SHA256 matches node crypto across unicode and block boundaries',()=>{for(const value of ['', 'abc','Проверяемый artifact','x'.repeat(63),'z'.repeat(1000)])assert.equal(fixtureSha256(value),createHash('sha256').update(value).digest('hex'))})
test('each independent gate has exact artifact digest and a failed gate prevents admission',()=>{
 let d=step(initial(),'local-check',{outcome:'pass'});for(const gate of ['shape','protocol','semantic'])d=step(d,'gate-check',{gate,outcome:'pass'})
 assert.equal(d.admissions['codex@demo-2'].independent,'partial');d=step(d,'admit');assert.equal(d.admissions['codex@demo-2'].admitted,false)
 d=step(d,'gate-check',{gate:'effects',outcome:'fail'});assert.equal(d.admissions['codex@demo-2'].independent,'failed');d=step(d,'gate-check',{gate:'effects',outcome:'pass'});d=step(d,'admit');assert.equal(d.admissions['codex@demo-2'].admitted,true)
 const g=d.admissions['codex@demo-2'];assert.equal(g.artifact.sha256,createHash('sha256').update(g.artifact.content).digest('hex'));assert.ok(Object.values(g.gates).every(v=>v.artifactSha256===g.artifact.sha256&&v.actor==='fixture-independent-checker'))
 d=step(d,'local-check',{outcome:'pass'});assert.deepEqual(d.admissions['codex@demo-2'].gates,{})
})
test('recipe skill content pins are distinct and explicit expiry/reissue does not accept old report',()=>{
 let d=step(initial(),'recipe',recipe);const r=structuredClone(d.recipe);assert.equal(r.skillPin.sha256,'2deb71e8168ab0f9de652c3fc36a4caf735ad5bc479fa66fb089e952babd5914')
 d=step(d,'recipe-expire');d=step(d,'local-report',{recipe:r.id,consumer:r.consumer,contract:r.pins.contract.commit,result:'passed',artifactDigest:r.artifact.sha256});assert.equal(d.localReport,undefined)
 d=step(d,'recipe-reissue');assert.notEqual(d.recipe.id,r.id);assert.equal(d.recipe.reissuedFrom,r.id);assert.ok(Date.parse(d.recipe.expires)>Date.parse(r.expires));assert.equal(d.recipeHistory[0].id,r.id)
 d=step(d,'recipe',{...recipe,intent:'create'});assert.equal(d.recipe.skillPin.sha256,'c6b93dfa8e60446e2e8aee2aec23bc9f077c9668b5be784a09991fe32d69b638')
})
test('cleanup only removes unchanged generated fixture content; user modification survives',()=>{
 let d=step(initial(),'recipe',recipe);d=step(d,'recipe-cleanup-preview',{modified:'yes'});const diff=structuredClone(d.cleanupDiff),modified=diff.find(v=>v.action.startsWith('preserve'))
 assert.ok(modified);d=step(d,'recipe-cleanup-apply');assert.equal(Object.keys(d.recipeFiles).length,1);assert.equal(d.recipeFiles[modified.path].content,modified.before);assert.equal(d.cleanupReceipt.removed.length,2)
})
test('local report gates require exact recipe provider revision and digest, never grant independent pass',()=>{
 let d=step(initial(),'recipe',recipe),r=d.recipe
 d=step(d,'local-report',{recipe:r.id,consumer:r.consumer,contract:r.pins.contract.commit,result:'passed',artifactDigest:'wrong'})
 assert.deepEqual(step(d,'report-to-gate').admissions,{})
 d=step(d,'local-report',{recipe:r.id,consumer:r.consumer,contract:r.pins.contract.commit,result:'passed',artifactDigest:r.artifact.sha256});assert.deepEqual(step(d,'report-to-gate',{}, {revision:'demo-3'}).admissions,{})
 d=step(d,'report-to-gate');const g=d.admissions['codex@demo-2'];assert.equal(g.local,'passed');assert.equal(g.independent,'not-run');assert.equal(g.admitted,false);assert.equal(g.localSource.recipe,r.id)
})
test('unknown callback reconciles one stable operation and repeated save returns same revision/receipt',()=>{
 let d=step(initial(),'connection-review',con),op=d.connectionReview.operationId;d=step(d,'connection-callback',{outcome:'unknown'});d=step(d,'connection-reconcile',{outcome:'success'});assert.equal(d.connectionReview.operationId,op)
 d=step(d,'connection-save');const stored=structuredClone(d.connections.atlas);d=step(d,'connection-callback',{outcome:'success'});d=step(d,'connection-save');assert.deepEqual(d.connections.atlas,stored);assert.equal(d.receipt,stored.receipt)
})
test('stale callback review does not overwrite a newer resource binding',()=>{let d=step(initial(),'connection-review',con);d=step(d,'connection-callback',{outcome:'success'});d.connections.atlas.revision++;const current=structuredClone(d.connections.atlas);d=step(d,'connection-save');assert.ok(d.error);assert.deepEqual(d.connections.atlas,current);assert.equal(d.connectionReview.resources[0],'orbit-api')})
test('access filters preserve exact rows and empty scope has an explicit result',()=>{
 let d=step(initial(),'access-filter',{status:'revoked',scope:'atlas'});let html=renderIntegrations('access',{integrations:d});assert.match(html,/Review agent/);assert.doesNotMatch(html,/External coordinator/)
 d=step(d,'access-filter',{status:'active',scope:'orbit'});html=renderIntegrations('access',{integrations:d});assert.match(html,/нет доступов/);assert.doesNotMatch(html,/External coordinator|Review agent/)
})
test('concurrent response preserves current receipt and unsent text and attributes actor',()=>{
 const draft={response:'My unsent evidence',verdict:'needs-work',effect:'none',expectedRevision:0,command:'my-response-1'}
 let d=step(initial(),'interaction-concurrent',{draft});const current=structuredClone(d.interactionResults['review-AT47']);assert.equal(current.actor,'demo-coowner')
 d=step(d,'interaction',draft);assert.ok(d.error);assert.deepEqual(d.interactionResults['review-AT47'],current);assert.equal(d.interactionConflicts['review-AT47'].draft.response,draft.response)
 d=step(d,'interaction-followup');assert.equal(d.followupDraft.body,draft.response);assert.equal(d.followupDraft.submitted,false)
})
test('same response command is idempotent only with identical payload; changed content stays unsent',()=>{
 const a={response:'Proof',verdict:'verified',effect:'none',command:'response-1',expectedRevision:0};let d=step(initial(),'interaction',a),r=structuredClone(d.interactionResults['review-AT47'])
 d=step(d,'interaction',a);assert.equal(d.receipt,r.receipt);d=step(d,'interaction',{...a,response:'Changed payload'});assert.ok(d.error);assert.deepEqual(d.interactionResults['review-AT47'],r);assert.equal(d.interactionConflicts['review-AT47'].draft.response,'Changed payload')
})
