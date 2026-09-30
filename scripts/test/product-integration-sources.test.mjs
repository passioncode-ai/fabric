import test from 'node:test'
import assert from 'node:assert/strict'
import {integrationState,transitionIntegration,renderIntegrations,checkerCoverage,seedAgentConfiguration,getIntegrationBindings} from '../product/integrations.mjs'
const initial=()=>integrationState({})
const context={project:'atlas',estate:'team-estate',provider:'codex',revision:'demo-2',roleSlot:'reviewer',memberRole:'owner',read:'ready'}
const step=(d,type,data={},ctx={})=>transitionIntegration(d,{type,data},{...context,...ctx})
const admitted=(d=initial(),revision='demo-2')=>['local-check','independent-check','admit'].reduce((v,type)=>step(v,type,{outcome:'pass'},{revision}),d)
const bind=(d,revision='demo-2')=>step(admitted(d,revision),'bind',{modes:['read'],budget:8,checker:'checker-output-v1'},{revision})
const source=()=>step(initial(),'quality-select',{value:'mixed'})
const config={name:'Invite reviewer',consumer:'Atlas / invite-check routine',prompt:'Check invitation return and cite observations.',provider:'codex',providerRevision:'demo-2',reason:'Initial revision'}
const delegation={point:'respond-review',personalEstate:'personal-estate',provider:'personal-reviewer@1',checker:'org-checker@1',budget:5}

test('estate switch validates current membership, clears work scope and does not import organization fixtures',()=>{
 const before=initial(),refused=step(before,'estate-switch',{estate:'stranger-estate'})
 assert.ok(refused.error);assert.equal(refused.navigation,null)
 const d=step(before,'estate-switch',{estate:'personal-estate'})
 assert.equal(d.sourceDemos.estate,'personal-estate');assert.equal(d.navigation.patch.task,'');assert.equal(d.navigation.patch.project,'');assert.equal(d.navigation.patch.graphTaskRun,'')
 const html=renderIntegrations('membership',{integrations:d,estate:'personal-estate',project:''})
 assert.match(html,/пустое личное пространство/);assert.doesNotMatch(html,/name="email"|invite-demo|AT-42/)
 for(const view of ['providers','connections','access','harness'])assert.doesNotMatch(renderIntegrations(view,{estate:'personal-estate',integrations:d}),/external-coordinator|snapshot-atlas-01|fabric_task_create|demo-artifact/)
 assert.deepEqual(step(d,'access-save',{},{estate:'personal-estate'}).accesses,d.accesses)
})
test('coequal owner retains administrative authority while member cannot change canary admission',()=>{
 let d=step(initial(),'estate-actor',{person:'demo-coowner'});assert.equal(d.navigation.patch.memberRole,'owner')
 d=step(d,'collector-config',{cadence:20});assert.equal(d.sourceDemos.collectors.atlas.cadence,20)
 d=step(d,'estate-actor',{person:'demo-member'});const prior=d.sourceDemos.collectors.atlas
 d=step(d,'collector-config',{cadence:5},{memberRole:'member'});assert.deepEqual(d.sourceDemos.collectors.atlas,prior);assert.ok(d.error)
})
test('floor cannot be delegated even if forged form asks for permissive canary',()=>{
 for(const point of ['approve-publication','unknown']){const d=step(initial(),'delegation-prepare',{...delegation,point});assert.deepEqual(d.sourceDemos.delegations,{});assert.ok(d.error)}
 for(const ctx of [{project:'orbit'},{created:true},{estate:'personal-estate'}])assert.deepEqual(step(initial(),'delegation-prepare',delegation,ctx).sourceDemos.delegations,{})
})
test('delegation needs organization admission then watched canary and consuming checker',()=>{
 let d=step(initial(),'delegation-prepare',delegation)
 assert.equal(d.sourceDemos.delegations['respond-review'].privateContext,'not shared')
 d=step(d,'delegation-canary',{point:delegation.point,outcome:'pass'});assert.equal(d.sourceDemos.delegations[delegation.point].canary,'not-run')
 d=step(d,'delegation-admission',{point:delegation.point,outcome:'pass'});d=step(d,'delegation-canary',{point:delegation.point,outcome:'pass'})
 d=step(d,'delegation-resolve',{point:delegation.point,artifact:'Exact artifact',checker:'failed'});assert.deepEqual(d.sourceDemos.pointResults,{})
 d=step(d,'delegation-resolve',{point:delegation.point,artifact:'Exact artifact',checker:'passed'});const result=d.sourceDemos.pointResults[delegation.point]
 assert.equal(result.actor,'demo-owner');assert.equal(result.viaProvider,'personal-reviewer@1');assert.equal(result.artifact,'Exact artifact');assert.equal(result.policyRevision,'demo-federation-policy-1')
 d=step(d,'delegation-resolve',{point:delegation.point,artifact:'Other answer',checker:'passed'});assert.deepEqual(d.sourceDemos.pointResults[delegation.point],result)
 d.roleRevoked=true;assert.ok(step(d,'delegation-canary',{point:delegation.point,outcome:'pass'}).error)
 assert.doesNotMatch(renderIntegrations('role-workspace',{integrations:d,interaction:'review-AT47'}),/personal-reviewer@1|Exact artifact/)
})
test('config seed keeps explicit assistant artifact as untrusted draft without producing or admitting a provider',()=>{
 const state={project:'atlas',provider:'codex'},id=seedAgentConfiguration(state,{kind:'agent-config',id:'ceo-artifact-1',title:'Reviewer',prompt:'<img src=x>Check return',project:'atlas',source:'CEO thread fixture'})
 assert.ok(id);const cfg=state.integrations.sourceDemos.configs[id]
 assert.equal(cfg.revision,0);assert.equal(cfg.canary,'not-run');assert.equal(cfg.source.trusted,false);assert.equal(cfg.source.artifact,'ceo-artifact-1');assert.deepEqual(state.integrations.admissions,{})
 assert.equal(seedAgentConfiguration(state,{kind:'agent-config',title:'Foreign',prompt:'x',project:'orbit'}),null)
 const html=renderIntegrations('providers',{...state,agentConfig:id});assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/)
 const denied=step(state.integrations,'config-canary',{checker:'checker',budget:5,outcome:'pass'},{agentConfig:id});assert.ok(denied.error)
})
test('named config consumes all fields, new revision invalidates checks, and another project cannot edit it',()=>{
 let d=step(initial(),'config-save',config),id=d.navigation.patch.agentConfig
 assert.equal(d.sourceDemos.configs[id].consumer,config.consumer);assert.equal(d.recipe,undefined)
 const foreign=step(d,'config-save',{...config,name:'Foreign'},{project:'orbit',agentConfig:id});assert.equal(foreign.sourceDemos.configs[id].name,config.name)
 d=admitted(d);d=step(d,'config-canary',{checker:'checker',budget:5,outcome:'pass'},{agentConfig:id});assert.equal(d.sourceDemos.configs[id].state,'watched')
 d=step(d,'config-save',{...config,prompt:'Changed',reason:'Changed instruction'},{agentConfig:id});assert.equal(d.sourceDemos.configs[id].revision,2);assert.equal(d.sourceDemos.configs[id].canary,'not-run');assert.equal(d.sourceDemos.configs[id].versions[0].canary,'passed')
 const fresh=step(d,'config-save',{...config,name:'Another'},{agentConfig:'new'});assert.notEqual(fresh.navigation.patch.agentConfig,id)
})
test('checker denominator counts distinct expected runs with stored verdicts and missing coverage stays unknown',()=>{
 const records=[{run:'r1',verdict:'accepted'},{run:'r1',verdict:'rejected'},{run:'r1',verdict:'rejected'},{run:'r2',verdict:'accepted'},{run:'foreign',verdict:'rejected'}]
 const c=checkerCoverage(records,['r1','r1','r2','r3']);assert.equal(c.denominator,2);assert.equal(c.rejected,1);assert.equal(c.rate,.5);assert.deepEqual(c.uncovered,['r3'])
 const unknown=checkerCoverage([],['r1']);assert.equal(unknown.rate,null)
 assert.match(checkerCoverage([{run:'r1',verdict:'accepted'}],['r1','r2']).warning,/Ноль отказов/)
})
test('promotion refuses zero, partial or unavailable evidence and keeps checker/cap after review',()=>{
 let d=step(bind(initial()),'canary',{outcome:'pass'})
 for(const evalSet of ['zero','partial','unavailable']){const failed=step(d,'provider-promote',{evalSet,reason:'Promote'});assert.equal(failed.sourceDemos.promotions.length,0);assert.ok(failed.error)}
 d=step(d,'provider-promote',{evalSet:'mixed',reason:'Golden and planted cases inspected'});const p=d.sourceDemos.promotions[0]
 assert.equal(p.provider,'codex');assert.equal(p.revision,'demo-2');assert.equal(p.author,'demo-owner');assert.ok(p.runs[0].startsWith('demo-canary-run-'));assert.equal(p.after.checker,'still required');assert.equal(p.after.budget,p.before.budget);assert.match(p.producingRun,/unknown/)
 const twice=step(d,'provider-promote',{evalSet:'mixed',reason:'repeat'});assert.equal(twice.sourceDemos.promotions.length,1)
 const foreignRevision=step(d,'provider-promote',{evalSet:'mixed',reason:'wrong revision'},{revision:'demo-3'});assert.equal(foreignRevision.sourceDemos.promotions.length,1)
})
test('rollback creates successor binding and new canary while original revision records remain unchanged',()=>{
 let d=step(bind(initial()),'canary',{outcome:'pass'}),original=structuredClone(d.bindings['atlas:reviewer'])
 d=bind(d,'demo-3');const successor=d.bindings['atlas:reviewer'].receipt
 d=step(d,'binding-rollback',{receipt:original.receipt,reason:'Canary regression'},{revision:'demo-3'})
 const current=d.bindings['atlas:reviewer'];assert.equal(current.revision,'demo-2');assert.notEqual(current.receipt,original.receipt);assert.notEqual(current.receipt,successor);assert.equal(current.canary,'not-run');assert.equal(d.navigation.patch.providerRevision,'demo-2')
 assert.deepEqual(d.sourceDemos.bindingHistory['atlas:reviewer'][0],original)
})
test('collector cadence updates future configuration without changing observed snapshots or report pins',()=>{
 const before=source(),snap=structuredClone(before.sourceDemos.collectors.atlas.snapshots),pins=structuredClone(before.sourceDemos.collectors.atlas.pins)
 const d=step(before,'collector-config',{cadence:5});assert.equal(d.sourceDemos.collectors.atlas.revision,2);assert.deepEqual(d.sourceDemos.collectors.atlas.snapshots,snap);assert.deepEqual(d.sourceDemos.collectors.atlas.pins,pins)
 assert.match(renderIntegrations('connections',{integrations:d}),/Stale по текущей cadence/)
})
test('failed refresh records failure and preserves previous observations; successful empty snapshot differs',()=>{
 let d=source(),original=structuredClone(d.sourceDemos.collectors.atlas.snapshots)
 d=step(d,'collector-start');d=step(d,'collector-complete',{outcome:'failed'});assert.equal(d.sourceDemos.collectors.atlas.status,'failed');assert.deepEqual(d.sourceDemos.collectors.atlas.snapshots,original)
 d=step(d,'collector-start');d=step(d,'collector-complete',{outcome:'empty'});assert.equal(d.sourceDemos.collectors.atlas.snapshots.length,2);assert.deepEqual(d.sourceDemos.collectors.atlas.snapshots[1].observations,[]);assert.equal(d.sourceDemos.collectors.atlas.snapshots[0].observations.length,2)
})
test('inflight collection pins connection resources and revision even when future binding changes',()=>{
 let d=step(source(),'collector-start');const pin=d.sourceDemos.collectors.atlas.inflight
 d.connections.atlas={...d.connections.atlas,revision:4,resources:['orbit-api']};d=step(d,'collector-config',{cadence:30});d=step(d,'collector-complete',{outcome:'success'})
 const snap=d.sourceDemos.collectors.atlas.snapshots.at(-1);assert.equal(snap.bindingRevision,pin.bindingRevision);assert.equal(snap.collectorRevision,pin.collectorRevision);assert.equal(snap.observations[0].resource,'atlas-app')
})
test('expired auth and retry-after prevent fresh collection without losing dated snapshot',()=>{
 let d=source();d.connections.atlas.auth='expired';assert.ok(step(d,'collector-start').error)
 d.connections.atlas.auth='valid';d=step(d,'collector-start');d=step(d,'collector-complete',{outcome:'rate-limit'});const attempts=d.sourceDemos.collectors.atlas.attempts.length
 d=step(d,'collector-start');assert.ok(d.error);assert.equal(d.sourceDemos.collectors.atlas.attempts.length,attempts)
 d=step(d,'collector-clock');d=step(d,'collector-start');assert.equal(d.sourceDemos.collectors.atlas.status,'processing')
})
test('snapshot selection is project exact and pin cannot create an agent interpretation',()=>{
 let d=source();d=step(d,'collector-select',{snapshot:'snapshot-atlas-01'},{project:'orbit'});assert.ok(d.error)
 d=step(d,'collector-pin',{consumer:'Next analyst'});const pin=d.sourceDemos.collectors.atlas.pins.at(-1);assert.equal(pin.snapshot,'snapshot-atlas-01');assert.equal(pin.interpretation,null);assert.equal(pin.author,null)
})
test('source-driven mutators refuse blocked read state and new admission without checker',()=>{
 for(const read of ['partial','read-only','denied','loading','conflict']){const d=step(initial(),'config-save',config,{read});assert.equal(d.sourceDemos,undefined);assert.ok(d.error)}
 const d=step(admitted(),'bind',{modes:['read'],budget:5,checker:''});assert.deepEqual(d.bindings,{});assert.ok(d.error)
})

test('expired OAuth callback cannot reuse same review or replace current resource binding',()=>{
 const original=initial(),a={subject:'demo-secondary',resources:['orbit-api'],agents:['reviewer'],ceiling:'read'}
 let d=step(original,'connection-review',a);d=step(d,'connection-callback',{outcome:'expired'});d=step(d,'connection-callback',{outcome:'success'});assert.equal(d.connectionReview.callback,'expired')
 d=step(d,'connection-save');assert.deepEqual(d.connections,original.connections)
 d=step(d,'connection-review',a);d=step(d,'connection-callback',{outcome:'success'});d=step(d,'connection-save');assert.equal(d.connections.atlas.subject,'demo-secondary')
})


test('normalized bindings accessor exposes only explicit future eligibility and does not mutate pins',()=>{
 assert.deepEqual(getIntegrationBindings({}),[])
 let d=bind(initial());assert.equal(getIntegrationBindings({integrations:d})[0].futureEligible,false)
 d=step(d,'canary',{outcome:'pass'});const before=structuredClone(d),row=getIntegrationBindings({integrations:d})[0]
 assert.equal(row.project,'atlas');assert.equal(row.role,'reviewer');assert.equal(row.admission,'admitted');assert.equal(row.futureEligible,true);assert.equal(row.binding,d.bindings['atlas:reviewer'].receipt);assert.deepEqual(d,before)
 d=step(d,'local-check',{outcome:'pass'});assert.equal(getIntegrationBindings({integrations:d})[0].futureEligible,false)
})
