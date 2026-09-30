import test from 'node:test'
import assert from 'node:assert/strict'
import {integrationState,transitionIntegration as step,renderIntegrations} from '../product/integrations.mjs'
const initial=()=>integrationState({})
const ctx={project:'atlas',provider:'codex',revision:'demo-2',roleSlot:'reviewer',memberRole:'owner',access:'new',invite:'invite-demo',effect:'staging',read:'ready'}
const act=(d,type,data={},c={})=>step(d,{type,data},{...ctx,...c})
const ready=()=>act(act(act(initial(),'local-check',{outcome:'pass'}),'independent-check',{outcome:'pass'}),'admit')
const recipeInput={intent:'adapt',consumer:'Atlas-reviewer',source:'example/provider',transport:'mcp',capabilities:['review'],integrity:'pass'}
const newAccess={name:'Custom access',principal:'external-test',projects:['orbit'],operations:['read'],ceiling:'none',expiry:'2026-09-20T18:00'}

test('unsupported view delegates and all owned views render',()=>{
 assert.equal(renderIntegrations('task'),null)
 for(const view of ['providers','admission','bootstrap','connections','connect-account','access','access-detail','authority','membership','invite','role-workspace','harness','harness-tool'])assert.match(renderIntegrations(view),/data-integrations-view-root/)
})
test('local passing report cannot bypass independent gate failure or owner admission',()=>{
 let d=act(initial(),'local-check',{outcome:'pass'});d=act(d,'independent-check',{outcome:'fail'});d=act(d,'admit')
 assert.equal(d.admissions['codex@demo-2'].admitted,false);assert.ok(d.error)
 d=act(d,'independent-check',{outcome:'pass'});assert.equal(d.admissions['codex@demo-2'].admitted,false)
})
test('new revision and new local evidence do not inherit prior gates',()=>{
 let d=ready();assert.equal(d.admissions['codex@demo-2'].admitted,true)
 d=act(d,'admit',{}, {revision:'demo-3'});assert.equal(d.admissions['codex@demo-3'],undefined)
 d=act(d,'local-check',{outcome:'pass'});assert.equal(d.admissions['codex@demo-2'].independent,'not-run');assert.equal(d.admissions['codex@demo-2'].admitted,false)
})
test('role binding does not replace manager and canary failure prevents ready state',()=>{
 let d=act(ready(),'bind',{modes:['read'],budget:6})
 assert.equal(d.bindings['atlas:reviewer'].status,'staged');assert.equal(d.bindings['atlas:product-manager'],undefined)
 d=act(d,'canary',{outcome:'fail'});assert.equal(d.bindings['atlas:reviewer'].status,'blocked')
 d=act(d,'canary',{outcome:'pass'});assert.equal(d.bindings['atlas:reviewer'].status,'ready');assert.equal(d.taskRun,undefined)
})
test('invalid binding modes/budget and member authority preserve prior state',()=>{
 for(const input of [{modes:[],budget:5},{modes:['production'],budget:5},{modes:['read'],budget:-2}])assert.deepEqual(act(ready(),'bind',input).bindings,{})
 assert.deepEqual(act(ready(),'bind',{modes:['read'],budget:5},{memberRole:'member'}).bindings,{})
})
test('recipe consumes inputs, exposes pinned versions, and checksum failure emits no partial recipe',()=>{
 const d=act(initial(),'recipe',recipeInput)
 assert.equal(d.recipe.consumer,'Atlas-reviewer');assert.equal(d.recipe.transport,'mcp');assert.ok(d.recipe.paths.every(p=>p.startsWith('fabric-provider/')||p.startsWith('test/')))
 const created=act(d,'recipe',{...recipeInput,intent:'create',transport:'a2a',consumer:'Other'})
 assert.equal(created.recipe.transport,'a2a');assert.equal(created.recipe.consumer,'Other');assert.notDeepEqual(created.recipe.paths,d.recipe.paths)
 const failed=act(created,'recipe',{...recipeInput,integrity:'fail'});assert.equal(failed.recipe,null);assert.equal(failed.drafts.recipe.consumer,recipeInput.consumer)
})
test('local report validates recipe identity and cannot imply independent pass',()=>{
 const d=act(initial(),'recipe',recipeInput),data={recipe:d.recipe.id,consumer:d.recipe.consumer,contract:d.recipe.pins.contract.commit,result:'passed'}
 assert.equal(act(d,'local-report',{...data,consumer:'Wrong'}).localReport,undefined)
 const next=act(d,'local-report',data);assert.equal(next.localReport.result,'passed');assert.deepEqual(next.admissions,{})
})
test('resource/agent allowlists survive review while wrong callback preserves old connection',()=>{
 const original=initial(),review={subject:'demo-secondary',resources:['orbit-api'],agents:['reviewer'],ceiling:'read'}
 let d=act(original,'connection-review',review);d=act(d,'connection-callback',{outcome:'wrong-identity'});d=act(d,'connection-save')
 assert.deepEqual(d.connections,original.connections)
 d=act(d,'connection-callback',{outcome:'success'});d=act(d,'connection-save')
 assert.deepEqual(d.connections.atlas.resources,['orbit-api']);assert.deepEqual(d.connections.atlas.agents,['reviewer']);assert.equal(d.connections.atlas.collector,'pending')
})
test('empty scopes and unknown callback cannot create a binding',()=>{
 let d=act(initial(),'connection-review',{subject:'demo-owner',resources:[],agents:['builder']});assert.equal(d.connectionReview,undefined)
 d=act(d,'connection-review',{subject:'demo-owner',resources:['atlas-app'],agents:['builder']});d=act(d,'connection-callback',{outcome:'unknown'});const prior=d.connections.atlas;d=act(d,'connection-save');assert.deepEqual(d.connections.atlas,prior)
})
test('collector timeout does not invalidate OAuth and reconnect does not repair collector',()=>{
 let d=act(initial(),'collector',{outcome:'timeout'});assert.equal(d.connections.atlas.auth,'valid')
 d=act(d,'auth-expire');d=act(d,'reconnect');assert.equal(d.connections.atlas.auth,'valid');assert.equal(d.connections.atlas.collector,'timeout')
})
test('new MCP access is independent, validates expiry, and reveals only synthetic value once',()=>{
 const original=initial();assert.deepEqual(act(original,'access-save',{...newAccess,expiry:'2020-01-01T00:00'}).accesses,original.accesses)
 let d=act(original,'access-save',newAccess),id=d.navigation.patch.access
 assert.notEqual(id,'external-coordinator');assert.deepEqual(d.accesses[id].projects,['orbit']);assert.equal(d.reveal.id,id)
 d=act(d,'dismiss-reveal');assert.equal(d.reveal,null);assert.equal(d.accesses[id].credential,undefined)
 d=act(d,'rotate-access',{}, {access:id});assert.equal(d.reveal.revision,2)
})
test('failed revoke preserves active permission; successful revoke keeps runs and prevents form resurrection',()=>{
 let d=act(initial(),'revoke-access',{outcome:'fail'},{access:'external-coordinator'});assert.equal(d.accesses['external-coordinator'].status,'active')
 d=act(d,'revoke-access',{}, {access:'external-coordinator'});assert.equal(d.accesses['external-coordinator'].status,'revoked');assert.deepEqual(d.accesses['external-coordinator'].runs,['run-02'])
 d=act(d,'access-save',newAccess,{access:'external-coordinator'});assert.equal(d.accesses['external-coordinator'].status,'revoked')
 d=act(d,'cancel-access-runs',{}, {access:'external-coordinator'});assert.equal(d.accesses['external-coordinator'].cancellation,'requested');assert.equal(d.accesses['external-coordinator'].runs.length,1)
})
test('grant requires exact affirmative basis; staging grant never permits content or release',()=>{
 assert.deepEqual(act(initial(),'grant').grants,{})
 assert.deepEqual(act(initial(),'grant',{}, {answer:'committed',answerChoice:'deny'}).grants,{})
 for(const effect of ['release','content'])assert.deepEqual(act(initial(),'grant',{}, {effect,answer:'committed',answerChoice:'allow'}).grants,{})
 const d=act(initial(),'grant',{}, {answer:'committed',answerChoice:'allow'});assert.equal(d.grants['effect-staging-01'].status,'active')
})
test('unknown effect holds one reservation; recheck same attempt closes without duplicate dispatch',()=>{
 let d=act(initial(),'grant',{}, {answer:'committed',answerChoice:'allow'});d=act(d,'reserve');d=act(d,'dispatch',{outcome:'unknown'});const reservation=d.grants['effect-staging-01'].reservation
 d=act(d,'reserve');assert.equal(d.grants['effect-staging-01'].reservation,reservation);assert.equal(d.grants['effect-staging-01'].status,'reserved')
 d=act(d,'dispatch',{outcome:'performed'});assert.equal(d.grants['effect-staging-01'].dispatch,'unknown')
 d=act(d,'reconcile-effect');assert.equal(d.grants['effect-staging-01'].status,'spent');assert.equal(d.grants['effect-staging-01'].reservation,reservation)
})
test('prepared invite retains intended identity and role, rejects wrong identity, accepts idempotently',()=>{
 let d=act(initial(),'invite-prepare',{email:'new@example.invalid',role:'member',expiry:'2026-09-20T18:00'}),id=d.navigation.patch.invite
 d=act(d,'invite-signin',{identity:'wrong@example.invalid'}, {invite:id});d=act(d,'invite-accept',{}, {invite:id});assert.equal(d.members.length,0)
 d=act(d,'invite-signin',{identity:'new@example.invalid'}, {invite:id});d=act(d,'invite-accept',{}, {invite:id});const receipt=d.invitations[id].acceptReceipt
 d=act(d,'invite-accept',{}, {invite:id});assert.equal(d.members.length,1);assert.equal(d.invitations[id].acceptReceipt,receipt);assert.equal(d.members[0].role,'member')
})
test('revoked or expired invitation cannot be accepted after a fresh login; unsupported v1 role rejected',()=>{
 for(const type of ['invite-revoke','invite-expire']){let d=act(initial(),type);d=act(d,'invite-signin',{identity:'member@example.invalid'});d=act(d,'invite-accept');assert.equal(d.members.length,0);assert.notEqual(d.invitations['invite-demo'].status,'accepted')}
 assert.equal(Object.keys(act(initial(),'invite-prepare',{email:'a@example.invalid',role:'viewer',expiry:'2026-09-20T18:00'}).invitations).length,1)
})
test('typed interaction preserves response; publish branch requires own grant and result belongs to AT-47',()=>{
 let d=act(initial(),'interaction',{response:'Regression reproduced',verdict:'needs-work',effect:'publish'},{interaction:'review-AT47'});assert.deepEqual(d.interactionResults,{})
 assert.equal(d.drafts['review-AT47'].response,'Regression reproduced')
 d=act(d,'interaction',{response:'Negative test passes',verdict:'verified',effect:'none'},{interaction:'review-AT47'});assert.equal(d.interactionResults['review-AT47'].task,'AT-47')
})
test('partial/conflict/read-only command paths cannot change permission even when invoked directly',()=>{
 for(const read of ['partial','conflict','read-only','denied','loading']){const before=initial(),after=act(before,'access-save',newAccess,{read});assert.deepEqual(after.accesses,before.accesses);assert.equal(after.reveal,null);assert.ok(after.error)}
})
test('silent tool usage and schema differ from task-writing tool; source text is inert',()=>{
 const silent=renderIntegrations('harness-tool',{tool:'fabric_tasks_list'}),write=renderIntegrations('harness-tool',{tool:'fabric_task_create'})
 assert.notEqual(silent,write);assert.match(silent,/Unknown/);assert.match(write,/origin/);assert.equal(write.includes('<script'),false)
})
test('user-controlled values are HTML escaped in receipts and drafts',()=>{
 const d=act(initial(),'access-save',{...newAccess,name:'<img src=x onerror=alert(1)>'}),access=d.navigation.patch.access
 const rendered=renderIntegrations('access-detail',{integrations:d,access})
 assert.equal(rendered.includes('<img'),false);assert.match(rendered,/&lt;img/)
})
test('affirmative answer from another question or Project cannot authorize Atlas staging',()=>{
 for(const scope of [{project:'orbit'},{question:'Q-13'},{created:true}])assert.deepEqual(act(initial(),'grant',{}, {...scope,answer:'committed',answerChoice:'allow'}).grants,{})
})
