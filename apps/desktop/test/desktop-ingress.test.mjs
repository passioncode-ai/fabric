import assert from 'node:assert/strict'
import { createJournal } from '../../../packages/journal/src/index.ts'
import { createDesktopJournal, prepareTaskText, prepareIdeaText, prepareRetrievalText,
  prepareAgentPayload, EXTERNAL_INGRESS_OWNERS } from '../src/main/desktopIngress.ts'
import { createChainAdvance } from '../src/main/chainAdvance.ts'

const id = '12345678-1234-5678-9abc-123456789abc'
const other = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const actor = {kind:'person',id:'operator'}
const secret = 'sk-' + 'A'.repeat(48)
const calls = []
const journal = createDesktopJournal(createJournal({rpc:async(name,args)=>{
  calls.push({name,args}); return {data:{seq:calls.length},error:null}
}}))
const append = (type,payload) => journal.append({estateId:id,projectId:other,actor,type,payload})

for (const offset of [110, 148, 288]) {
  const original = 'word '.repeat(Math.floor(offset / 5)) + secret
  const task = prepareTaskText(original)
  const idea = prepareIdeaText(original)
  assert.equal(idea.ok,true)
  const retrieval = prepareRetrievalText(original)
  for (const value of [task.title,task.instruction,idea.idea.title,idea.idea.note,retrieval])
    assert.ok(!String(value).includes('AAAA'), 'no token fragment survives title/note/query splitting')
  await append('task.created@1',{id,...task})
}
assert.ok(!JSON.stringify(calls).includes('AAAA'))
await append('task.closed@1',{task_id:id,outcome:'cancelled',reason:`SERVICE_TOKEN=${secret}`})
assert.ok(!JSON.stringify(calls.at(-1)).includes(secret))
const count = calls.length
await assert.rejects(append('project.repo.attached@1',{id,path:`postgresql://user:${secret}@host/db`,label:'repo'}))
await assert.rejects(append('task.created@2',{id,instruction:'work'}))
await assert.rejects(append('new.event@1',{secret}))
assert.equal(calls.length,count,'refusal is before the real append_event RPC')

const digest = 'a'.repeat(64)
const receipt = {session_id:id,sha256:digest,redactions:'trusted producer receipt',chars:12}
await append('transcript.captured@1',receipt)
assert.deepEqual(calls.at(-1).args.p_payload,receipt,'finalized receipt bytes are not rewritten')
assert.ok(Object.values(EXTERNAL_INGRESS_OWNERS).every(owner=>typeof owner==='string'&&owner.length>10))
assert.throws(()=>prepareAgentPayload('memory.project.recorded@1',{id,claim:'safe',source_ref:`https://user:${secret}@host/`}))
assert.throws(()=>prepareAgentPayload('new.agent.event@1',{secret}))
assert.ok(!JSON.stringify(prepareAgentPayload('question.asked@1',{body_md:secret})).includes(secret))
await append('memory.project.recorded@1',prepareAgentPayload('memory.project.recorded@1',{id,claim:secret}))
assert.ok(!JSON.stringify(calls.at(-1)).includes(secret))
assert.equal(calls.at(-1).args.p_payload.redactions,'1 redacted (openai-key×1)','single covered pass retains removal evidence')

// The real chain controller writes an outbox BEFORE invoking startTask. Test
// that earlier effect rather than assuming downstream task preparation covers it.
const chainEvents = [], launches = []
const store = {
  select(table) {
    let rel
    const q={eq(k,v){if(k==='rel')rel=v;return q},then(resolve){
      return Promise.resolve({data:table==='task_links'&&rel==='follows'?[{task_id:id,target_id:other,needs:[]}]:[],error:null}).then(resolve)
    }};return q
  },
  async selectIn(_table,_columns,_field,ids){return {rows:ids.includes(id)?[{id,project_id:other,status:'backlog',instruction:`Read ${secret}`,option_id:'shell'}]:[{id:other,status:'done'}]}}
}
await createChainAdvance({store,estateId:id,quota:async()=>null,admission:{claim:()=>({ok:true})},
  journal:{append:async e=>{chainEvents.push(e);return {seq:chainEvents.length}}},
  admitExisting:async()=>({admitted:true,receipt:{task_run_id:other,project_id:other,instruction:'work'}}),
  startTask:async input=>{launches.push(input);return {task:{id},session:{sessionId:other}}}
})()
assert.equal(launches.length,1)
const intent=chainEvents.find(e=>e.type==='chain.dispatch@1'&&e.payload.phase==='intent')
assert.ok(intent)
assert.equal(intent.payload.instruction,launches[0].instruction)
assert.ok(!JSON.stringify([chainEvents,launches]).includes(secret))
console.log('PASS desktop ingress: original-before-split, actual append RPC, authority refusal, exact external policy, chain outbox/launch identity')
