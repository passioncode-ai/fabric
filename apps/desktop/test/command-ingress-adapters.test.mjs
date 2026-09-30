// Actual adapter -> journal/RPC capture, no database/provider/network access.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createJournal } from '../../../packages/journal/src/index.ts'
import { createPreparedJournal, commitPreparedAnswer, commitPreparedImport, commitBoardCommand, commitReleaseCommand } from '../src/main/commandIngressAdapters.ts'
import { prepareOriginalInstruction } from '../src/shared/commandIngress.ts'
import { readIdea } from '../src/shared/idea.ts'

const estate = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const project = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const task = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const command = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const question = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const decision = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const actor = {kind:'person',id:'11111111-1111-1111-1111-111111111111'}
const canary = 'synthetic-opaque-adapter-canary'
const secret = `SERVICE_TOKEN=${canary}`
const input = () => ({estateId:estate,type:'task.created@1',projectId:project,actor,
  payload:{id:task,title:secret,instruction:secret,option_id:'claude-code'}})
let passed = 0
async function test(name, fn) { await fn(); passed++; console.log('ok   '+name) }
const answerInput = () => ({commandId:command,questionId:question,projectId:project,expectedRevision:4,
  answer:secret,chosenOption:undefined,options:[]})
const receipt = () => ({resolution_id:command,decision_id:decision,repeated:false,answered_seq:42,
  unblocked:[task],still_blocked:[]})
const sourceDigest = 'ABCDEF12'.repeat(8)
const importInput = () => ({commandId:command,inputDigest:sourceDigest,events:[
  {type:'project.created@1',project_id:project,payload:{id:project,name:'project',purpose:secret}},
  {type:'agent.registered@1',project_id:project,payload:{id:task,project_id:project,name:'agent',instructions:secret,runner_id:'codex'}}
]})
const importReceipt = () => ({estate_id:estate,seq:23,type:'estate.imported@1',schema_rev:'1',actor,
  project_id:null,run_id:null,node_id:null,occurred_at:'2026-09-27T00:00:00Z',payload:{command_id:command,input_digest:sourceDigest,events:2,
    coverage_note:'declared projects and agent bindings'}})

await test('covered journal events reach the real append_event client already prepared', async () => {
  const calls=[]
  const raw = createJournal({rpc: async(name,args)=>{calls.push({name,args});return {data:{seq:7}}}}, {maxAttempts:1})
  const journal = createPreparedJournal(raw)
  const original=input(); const before=structuredClone(original)
  original.payload.redactions = '999 secret removals claimed by caller'
  await journal.append(original)
  assert.equal(calls.length,1); assert.equal(calls[0].name,'append_event')
  const args=calls[0].args
  assert.equal(args.p_payload.instruction,'SERVICE_TOKEN=[redacted: assignment]')
  assert.equal(args.p_payload.redactions,'2 redacted (assignment×2)')
  assert.equal(args.p_actor.id,actor.id); assert.equal(args.p_project_id,project)
  assert.equal(args.p_payload.id,task); assert.equal(args.p_payload.option_id,'claude-code')
  assert.ok(!JSON.stringify(args).includes(canary))
  assert.equal(original.payload.instruction,before.payload.instruction)
  assert.equal(original.payload.redactions,'999 secret removals claimed by caller')
})
await test('caller metadata is removed when no new removal was observed', async () => {
  let payload
  const journal=createPreparedJournal({append:async e=>{payload=e.payload;return {seq:1}},replay:async()=>[]})
  const e=input();e.payload={id:task,title:'clean',redactions:'999 redacted'}
  await journal.append(e); assert.ok(!Object.hasOwn(payload,'redactions'))
})
await test('uncovered versions refuse by default and require explicit exact-type classification', async () => {
  let calls=0
  const base={append:async()=>{calls++;return {seq:1}},replay:async()=>[]}
  for(const type of ['terminal.closed@1','task.created@2'])
    await assert.rejects(createPreparedJournal(base).append({...input(),type}), e=>e.code==='not_covered')
  assert.equal(calls,0)
  const classified=createPreparedJournal(base,{classifyUncovered:type=>type==='terminal.closed@1'?'external_policy':'reject'})
  await classified.append({...input(),type:'terminal.closed@1'})
  await assert.rejects(classified.append({...input(),type:'terminal.closed@2'}), e=>e.code==='not_covered')
  assert.equal(calls,1)
})
await test('identity gating remains independent; replay delegates with original arguments', async () => {
  let writes=0,reads
  const base={append:async()=>{writes++;return {seq:1}},replay:async(...args)=>{reads=args;return []}}
  const prepared=createPreparedJournal(base)
  // Same placement as identity.guarded: membership check outside privacy adapter.
  const guarded={...prepared,append:async e=>{if(e.actor.kind==='person')throw Error('membership revoked');return prepared.append(e)}}
  await assert.rejects(guarded.append(input()),/membership revoked/)
  assert.equal(writes,0)
  await guarded.replay(estate,12,30);assert.deepEqual(reads,[estate,12,30])
})
await test('refused/malformed journal input never reaches RPC or invokes getters', async () => {
  let writes=0,getters=0
  const journal=createPreparedJournal({append:async()=>{writes++;return {seq:1}},replay:async()=>[]})
  const e=input();Object.defineProperty(e,'payload',{get(){getters++;return {}}})
  await assert.rejects(journal.append(e),e=>e.code==='invalid_envelope')
  await assert.rejects(journal.append({...input(),payload:{id:task,title:'x',password:canary}}),e=>e.code==='unknown_field')
  await assert.rejects(journal.append({...input(),payload:{id:task,title:'x',option_id:secret}}),e=>e.code==='secret_in_reference')
  assert.equal(writes,0);assert.equal(getters,0)
})
await test('journal backend errors are generic and adapter adds no retry', async () => {
  let writes=0
  const journal=createPreparedJournal({append:async()=>{writes++;throw Error(canary)},replay:async()=>[]})
  await assert.rejects(journal.append(input()),e=>e.code==='persistence_unconfirmed'&&!e.message.includes(canary))
  assert.equal(writes,1)
})
await test('answer RPC and continuation consume identical canonical answer bytes', async () => {
  const calls=[],continuations=[]
  const original=answerInput();const before=structuredClone(original)
  const result=await commitPreparedAnswer({estateId:estate,actor,rpc:async(name,args)=>{calls.push({name,args});return {data:receipt()}},
    continueAnswer:async(taskId,decisionId,answer)=>{continuations.push({taskId,decisionId,answer,digest:createHash('sha256').update(answer).digest('hex')});return {state:'written'}}},original)
  assert.equal(result.state,'committed');assert.equal(calls.length,1);assert.equal(calls[0].name,'answer_question')
  const args=calls[0].args
  assert.equal(args.p_answer,'SERVICE_TOKEN=[redacted: assignment]');assert.equal(args.p_chosen_option,null)
  assert.equal(args.p_expected_revision,4);assert.equal(args.p_command_id,command);assert.equal(args.p_actor.id,actor.id)
  assert.equal(continuations[0].answer,args.p_answer)
  assert.equal(continuations[0].digest,createHash('sha256').update(args.p_answer).digest('hex'))
  assert.equal(result.continuations[0].state,'returned')
  assert.deepEqual(original,before);assert.ok(!JSON.stringify({calls,continuations,result}).includes(canary))
})
await test('selected-option label participates in canonical answer composition', async()=>{
  let sent
  const result=await commitPreparedAnswer({estateId:estate,actor,rpc:async(_,args)=>{sent=args;return {data:receipt()}}},
    {...answerInput(),chosenOption:'a',options:[{id:'a',label:`Authorization: Bearer ${canary}`}],answer:'Proceed'})
  assert.equal(result.state,'committed')
  assert.equal(sent.p_chosen_option,'a');assert.equal(sent.p_answer,'Authorization: Bearer [redacted: authorization] — Proceed')
})
await test('domain refusals retain safe reason and have no RPC/continuation effects', async()=>{
  let effects=0
  const deps={estateId:estate,actor,rpc:async()=>{effects++;return {data:receipt()}},continueAnswer:async()=>{effects++}}
  for(const changes of [{answer:'',options:[]},{chosenOption:'gone',options:[]},{answer:'x'.repeat(4001)}]){
    const result=await commitPreparedAnswer(deps,{...answerInput(),...changes})
    assert.equal(result.state,'refused');assert.equal(result.code,'invalid_answer')
    assert.ok(/nothing|current ones|too long/.test(result.reason));assert.ok(!result.reason.includes(canary))
  }
  assert.equal(effects,0)
})
await test('outer answer IDs/revisions and unknown fields refuse without effects', async()=>{
  let calls=0,getters=0
  const deps={estateId:estate,actor,rpc:async()=>{calls++;return {data:receipt()}}}
  for(const changes of [{commandId:'not-uuid'},{projectId:secret},{expectedRevision:-1},{expectedRevision:1.5},{extra:canary}]){
    const result=await commitPreparedAnswer(deps,{...answerInput(),...changes})
    assert.equal(result.state,'refused');assert.ok(!JSON.stringify(result).includes(canary))
  }
  const i=answerInput();Object.defineProperty(i,'answer',{get(){getters++;return secret}})
  assert.equal((await commitPreparedAnswer(deps,i)).state,'refused');assert.equal(getters,0);assert.equal(calls,0)
})
await test('RPC uncertainty/malformed receipts never trigger continuation or retries', async()=>{
  for(const outcome of ['throw','error','malformed']){
    let calls=0,continued=0
    const result=await commitPreparedAnswer({estateId:estate,actor,rpc:async()=>{calls++;if(outcome==='throw')throw Error(canary);
      return outcome==='error'?{data:null,error:{message:canary}}:{data:{...receipt(),decision_id:canary}}},continueAnswer:async()=>{continued++}},answerInput())
    assert.equal(result.state,'unconfirmed');assert.equal(calls,1);assert.equal(continued,0);assert.ok(!JSON.stringify(result).includes(canary))
  }
})
await test('repeated SQL receipt and failed continuation never recommit the answer', async()=>{
  let calls=0,continued=0
  const deps={estateId:estate,actor,rpc:async()=>{calls++;return {data:{resolution_id:command,decision_id:decision,repeated:true}}},
    continueAnswer:async()=>{continued++;throw Error(canary)}}
  const repeated=await commitPreparedAnswer(deps,answerInput());assert.equal(repeated.state,'committed');assert.equal(continued,0)
  deps.rpc=async()=>{calls++;return {data:receipt()}}
  const failed=await commitPreparedAnswer(deps,answerInput());assert.equal(failed.state,'committed')
  assert.deepEqual(failed.continuations,[{state:'unconfirmed',taskId:task}]);assert.equal(calls,2);assert.equal(continued,1)
  assert.ok(!JSON.stringify(failed).includes(canary))
})
await test('a repeat with changed submitted text never claims that text is the durable answer',async()=>{
  let saved,callbacks=0,calls=0
  const deps={estateId:estate,actor,rpc:async(_,args)=>{
    calls++
    if(saved!==undefined)return {data:{resolution_id:command,decision_id:decision,repeated:true}}
    saved=args.p_answer;return {data:receipt()}
  },continueAnswer:async()=>{callbacks++;return {state:'written'}}}
  const first=await commitPreparedAnswer(deps,{...answerInput(),answer:'original decision'})
  const again=await commitPreparedAnswer(deps,{...answerInput(),answer:'different retry text'})
  assert.equal(first.state,'committed');assert.equal(first.canonicalAnswer,'original decision')
  assert.equal(again.state,'committed');assert.equal(again.receipt.decision_id,decision)
  assert.equal(again.canonicalAnswer,null);assert.equal(saved,'original decision')
  assert.equal(callbacks,1);assert.equal(calls,2);assert.deepEqual(again.continuations,[])
})
await test('declared import issues one atomic RPC with prepared events and original source digest',async()=>{
  const calls=[];const original=importInput();const before=structuredClone(original)
  const result=await commitPreparedImport({estateId:estate,actor,rpc:async(name,args)=>{calls.push({name,args});return {data:importReceipt()}}},original)
  assert.equal(result.state,'committed');assert.equal(calls.length,1);assert.equal(calls[0].name,'import_declared_snapshot')
  assert.equal(calls[0].args.p_input_digest,sourceDigest);assert.equal(calls[0].args.p_command_id,command)
  assert.equal(calls[0].args.p_events[1].payload.instructions,'SERVICE_TOKEN=[redacted: assignment]')
  assert.ok(!JSON.stringify(calls).includes(canary));assert.deepEqual(original,before)
  assert.equal(result.receipt.inputDigest,sourceDigest)
})
await test('one invalid import event or unnormalized undefined refuses the whole batch',async()=>{
  let calls=0;const deps={estateId:estate,actor,rpc:async()=>{calls++;return {data:importReceipt()}}}
  for(const payload of [{id:task,name:'bad',repo_path:secret},{id:task,name:'legacy',purpose:undefined}]){
    const i=importInput();i.events.push({type:'project.created@1',project_id:task,payload})
    const result=await commitPreparedImport(deps,i);assert.equal(result.state,'refused');assert.ok(!JSON.stringify(result).includes(canary))
  }
  assert.equal(calls,0)
})
await test('import failure/forged receipt is unconfirmed without raw errors or retries',async()=>{
  for(const outcome of ['throw','error','mismatch']){
    let calls=0
    const result=await commitPreparedImport({estateId:estate,actor,rpc:async()=>{calls++;if(outcome==='throw')throw Error(canary);
      return outcome==='error'?{data:null,error:{message:canary}}:{data:{...importReceipt(),payload:{...importReceipt().payload,input_digest:'f'.repeat(64)}}}}},importInput())
    assert.equal(result.state,'unconfirmed');assert.equal(calls,1);assert.ok(!JSON.stringify(result).includes(canary))
  }
})
await test('caller prerequisite: prepare original before title/idea split, then journal canonical text',async()=>{
  const token='sk-'+'syntheticCanary'.repeat(6)
  const original='x'.repeat(145)+' '+token+'\nnext'
  const prepared=prepareOriginalInstruction(original);assert.equal(prepared.state,'prepared')
  const idea=readIdea({text:prepared.value});assert.equal(idea.ok,true)
  let args
  const journal=createPreparedJournal(createJournal({rpc:async(_,value)=>{args=value;return {data:{seq:1}}}},{maxAttempts:1}))
  await journal.append({...input(),payload:{id:task,title:prepared.value.slice(0,160),instruction:prepared.value}})
  assert.ok(!JSON.stringify({args,idea}).includes('syntheticCanary'))
  assert.equal(args.p_payload.instruction,prepared.value)
})

// SCR-41 L3b: the Board's three commands.
await test('a deferral crosses scrubbed, as the established person, to its one command', async () => {
  const calls=[]
  const result=await commitBoardCommand({estateId:estate,actor,rpc:async(name,args)=>{calls.push({name,args});return {data:{deferred_seq:7,repeated:false}}}},
    'defer',{commandId:command,questionId:question,projectId:project,reason:`after the pilot ${secret}`})
  assert.deepEqual(result,{state:'committed',repeated:false,seq:7,questionId:question})
  assert.equal(calls.length,1); assert.equal(calls[0].name,'defer_question')
  assert.deepEqual(calls[0].args.p_actor,actor)
  assert.ok(!JSON.stringify(calls).includes(canary),'the secret reached the command')
  assert.match(calls[0].args.p_reason,/\[redacted: assignment\]/)
})
await test('a blank reason, an unknown field or a bad id is refused before anything crosses', async () => {
  let called=false; const deps={estateId:estate,actor,rpc:async()=>{called=true;return {data:{}}}}
  for (const input of [{commandId:command,questionId:question,projectId:project,reason:'  '},
    {commandId:command,questionId:question,projectId:project,reason:'x',extra:1},
    {commandId:'nope',questionId:question,projectId:project,reason:'x'}])
    assert.deepEqual(await commitBoardCommand(deps,'defer',input),{state:'refused',refusal:'invalid_input'})
  assert.equal(called,false)
})
await test('the command\'s own no is named; a lost or unreadable answer is uncertainty', async () => {
  const say=(error)=>({estateId:estate,actor,rpc:async()=>({data:null,error})})
  const input={commandId:command,questionId:question,projectId:project}
  assert.deepEqual(await commitBoardCommand(say({code:'22023',message:'that question is not set aside'}),'reopen',input),{state:'refused',refusal:'not_deferred'})
  assert.deepEqual(await commitBoardCommand(say({code:'22023',message:'that question is already set aside'}),'defer',{...input,reason:'x'}),{state:'refused',refusal:'already_deferred'})
  assert.deepEqual(await commitBoardCommand(say({code:'02000',message:'no such project'}),'topic',{...input,text:'x'}),{state:'refused',refusal:'no_such'})
  assert.deepEqual(await commitBoardCommand(say({code:'08006',message:'connection lost'}),'reopen',input),{state:'unconfirmed'},'a transport failure read as a refusal')
  assert.deepEqual(await commitBoardCommand({estateId:estate,actor,rpc:async()=>{throw new Error('socket')}},'reopen',input),{state:'unconfirmed'})
  assert.deepEqual(await commitBoardCommand({estateId:estate,actor,rpc:async()=>({data:{}})},'reopen',input),{state:'unconfirmed'},'a receipt without its shape read as a commit')
})
await test('a topic sends its text and note scrubbed; a repeat names the first question', async () => {
  const calls=[]; const first='99999999-9999-4999-8999-999999999999'
  const result=await commitBoardCommand({estateId:estate,actor,rpc:async(name,args)=>{calls.push({name,args});return {data:{question_id:first,asked_seq:3,repeated:true}}}},
    'topic',{commandId:command,questionId:question,projectId:project,text:'Agree the scope',note:secret})
  assert.deepEqual(result,{state:'committed',repeated:true,seq:3,questionId:first})
  assert.equal(calls[0].name,'ask_topic'); assert.equal(calls[0].args.p_text,'Agree the scope')
  assert.ok(!JSON.stringify(calls).includes(canary))
})
const release = '77777777-7777-4777-8777-777777777777'
await test('a release crosses with its words scrubbed, its references deduplicated and the actor established', async () => {
  const calls=[]
  const result=await commitReleaseCommand({estateId:estate,actor,rpc:async(name,args)=>{calls.push({name,args});return {data:{release_id:release,recorded_seq:9,repeated:false}}}},
    'record',{commandId:command,releaseId:release,projectId:project,name:'Atlas 0.4.2',environment:'Demo / local',summary:secret,taskIds:[task,task],decisionIds:[decision]})
  assert.deepEqual(result,{state:'committed',repeated:false,seq:9,releaseId:release})
  assert.equal(calls[0].name,'record_release'); assert.deepEqual(calls[0].args.p_actor,actor)
  assert.deepEqual(calls[0].args.p_task_ids,[task],'a repeated task reached the command twice')
  assert.equal(calls[0].args.p_rolls_back,null)
  assert.ok(!JSON.stringify(calls).includes(canary),'the secret reached the command')
})
await test('a verification needs accepted or failed and a receipt; bad shapes never cross', async () => {
  let called=false; const deps={estateId:estate,actor,rpc:async()=>{called=true;return {data:{}}}}
  const base={commandId:command,releaseId:release,projectId:project}
  for (const [action,input] of [['verify',{...base,outcome:'maybe',receipt:'x'}],['verify',{...base,outcome:'accepted',receipt:'  '}],
    ['record',{...base,name:'x',environment:'y',taskIds:['not-a-uuid']}],['record',{...base,name:'x',environment:'y',rollsBack:'nope'}],
    ['record',{...base,name:'x',environment:'y',extra:1}]])
    assert.deepEqual(await commitReleaseCommand(deps,action,input),{state:'refused',refusal:'invalid_input'})
  assert.equal(called,false)
  const calls=[]
  const v=await commitReleaseCommand({estateId:estate,actor,rpc:async(name,args)=>{calls.push({name,args});return {data:{verified_seq:11,repeated:true}}}},'verify',{...base,outcome:'failed',receipt:`wrong pack ${secret}`})
  assert.deepEqual(v,{state:'committed',repeated:true,seq:11,releaseId:release})
  assert.equal(calls[0].args.p_outcome,'failed'); assert.ok(!JSON.stringify(calls).includes(canary))
})
await test('the release commands name their own no; a transport failure is uncertainty', async () => {
  const say=(error)=>({estateId:estate,actor,rpc:async()=>({data:null,error})})
  const input={commandId:command,releaseId:release,projectId:project,name:'x',environment:'y'}
  assert.deepEqual(await commitReleaseCommand(say({code:'22023',message:'a task named by the release is not a task of this project'}),'record',input),{state:'refused',refusal:'not_in_project'})
  assert.deepEqual(await commitReleaseCommand(say({code:'22023',message:'a rollback names a release of this project that it rolls back'}),'record',input),{state:'refused',refusal:'not_in_project'})
  assert.deepEqual(await commitReleaseCommand(say({code:'22023',message:'that command id already recorded a different release'}),'record',input),{state:'refused',refusal:'command_reused'})
  assert.deepEqual(await commitReleaseCommand(say({code:'02000',message:'no such release'}),'verify',{commandId:command,releaseId:release,projectId:project,outcome:'accepted',receipt:'x'}),{state:'refused',refusal:'no_such'})
  assert.deepEqual(await commitReleaseCommand(say({code:'08006',message:'connection lost'}),'record',input),{state:'unconfirmed'})
  assert.deepEqual(await commitReleaseCommand({estateId:estate,actor,rpc:async()=>({data:{}})},'record',input),{state:'unconfirmed'},'a receipt without its shape read as a commit')
})
console.log(`command ingress adapters: ${passed} captured-boundary scenarios passed (no live DB)`)
