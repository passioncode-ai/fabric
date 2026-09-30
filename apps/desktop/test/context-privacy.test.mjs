// Offline legacy-source → compiler → session bundle → verified packet regressions.
// Only synthetic in-memory rows and a temporary directory; no database or provider.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { compileContextPack, COMPILER_REVISION, packPart } from '../src/main/contextPack.ts'
import { createBundleCompiler } from '../src/main/sessionBundle.ts'
import { readPart, verify } from '../src/main/executionPacket.ts'
import { PREAMBLE } from '../src/shared/preamble.ts'
import { redact } from '../src/shared/redact.ts'

const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const sessionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const factId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const canary = 'synthetic-opaque-legacy-canary'
const secret = `SERVICE_TOKEN=${canary}`
const token = 'sk-' + 'syntheticLegacyCanary'.repeat(3)
const boundary = 'a'.repeat(286) + ' ' + token
const pem = '-----BEGIN PRIVATE KEY-----\nsyntheticPEMbody7391\n-----END PRIVATE KEY-----'
const digest = value => createHash('sha256').update(value).digest('hex')
const rows = () => ({
  projects: { name: 'Ordinary project', purpose: 'A useful purpose.' },
  project_repos: [{ path: '/synthetic/project', is_primary: true }],
  memory_facts: [{ id: factId, claim: 'A measured finding.', source_ref: 'docs/spec.md:42',
    kind: 'finding', actor_kind: 'person', seq: 17 }],
  session_transcripts: [{ session_id: sessionId, annotation: 'Completed one task.' }]
})
function storeFor(data, errors = {}) {
  return { select(table) {
    const result = { data: data[table] ?? [], error: errors[table] ?? null }
    const q = { eq(){return q}, is(){return q}, order(){return q}, limit(){return q},
      maybeSingle(){return Promise.resolve(result)}, then(a,b){return Promise.resolve(result).then(a,b)} }
    return q
  } }
}
const compile = (data, extra = {}, errors = {}) => compileContextPack({ store: storeFor(data, errors), projectId, ...extra })
const stableMarkdown = text => text.replace(/Compiled by Fabric at [^ ]+ —/, 'Compiled by Fabric at <clock> —')
let passed = 0
async function test(name, fn) { await fn(); passed++; console.log('ok   ' + name) }

await test('complete fact and source references are scrubbed before the 300-character cap', async () => {
  assert.ok(!redact(boundary).text.includes(token))
  for (const field of ['claim', 'source_ref']) {
    const data = rows(); data.memory_facts[0][field] = boundary
    const before = structuredClone(data)
    const pack = await compile(data)
    assert.ok(!pack.markdown.includes(token.slice(0, 13)), field)
    assert.ok(pack.markdown.includes('…[truncated]'))
    assert.deepEqual(data, before)
    assert.equal(pack.sha256, digest(pack.markdown))
    assert.equal(pack.chars, pack.markdown.length)
    assert.equal(pack.compilerRevision, 3)
  }
  assert.equal(COMPILER_REVISION, 3)
})

await test('multiline PEM is scrubbed before flattening in both fact fields', async () => {
  for (const field of ['claim', 'source_ref']) {
    const data = rows(); data.memory_facts[0][field] = `before\n${pem}\nafter`
    const pack = await compile(data)
    assert.ok(!pack.markdown.includes('syntheticPEMbody7391'), field)
    assert.ok(pack.markdown.includes('before [redacted: private-key] after'))
  }
})

await test('each legacy rendered head, fact metadata and annotation text is scrubbed', async () => {
  const cases = [
    data => { data.projects.name = secret },
    data => { data.projects.purpose = secret },
    data => { data.project_repos[0].path = `https://synthetic-user:${canary}@example.invalid/project` },
    data => { data.memory_facts[0].kind = secret },
    data => { data.memory_facts[0].actor_kind = secret },
    data => { data.session_transcripts[0].annotation = `Authorization: Bearer ${canary}` }
  ]
  for (const apply of cases) {
    const data = rows(); apply(data); const before = structuredClone(data)
    const pack = await compile(data)
    assert.ok(!pack.markdown.includes(canary))
    assert.deepEqual(data, before)
    assert.deepEqual(pack.factIds, [factId])
    assert.deepEqual(pack.factSeqs, [17])
    assert.deepEqual(pack.transcriptIds, [sessionId])
  }
  for (const extra of [ {taskInstruction: secret}, ...['what','why','expected'].map(field => ({taskBrief:{[field]:secret}})) ]) {
    const before = structuredClone(extra)
    assert.ok(!(await compile(rows(), extra)).markdown.includes(canary))
    assert.deepEqual(extra, before)
  }
})

await test('legacy raw backend prose becomes a fixed read error receipt', async () => {
  const error = { message: `database refused ${secret}` }
  const pack = await compile(rows(), {}, { memory_facts: error })
  assert.equal(pack.read.availability, 'partial')
  assert.equal(pack.read.sources.find(s => s.name === 'facts').errorCode, 'source_read_failed')
  assert.ok(!JSON.stringify(pack).includes(canary))
  assert.equal(error.message, `database refused ${secret}`)
})

await test('ordinary bytes, formatting controls and citation identities retain existing behavior', async () => {
  const data = rows()
  data.projects.purpose = 'First line\nSecond line\twith a tab.'
  data.memory_facts[0].claim = '  first\nsecond\t  third\u2028fourth  '
  data.memory_facts[0].source_ref = 'docs/spec.md:42\nread it'
  const pack = await compile(data, {taskInstruction:'Keep\nthis structure.',taskBrief:{what:'Do it.',why:'Useful.',expected:'Done.'}})
  for (const text of [
    '**Project:** Ordinary project', '**Purpose:** First line\nSecond line\twith a tab.',
    '**Repositories:** /synthetic/project (primary)', '**You were asked:** Keep\nthis structure.',
    '**What should happen:** Do it.', '**Why:** Useful.', '**True when done:** Done.',
    '- first second third fourth — source: docs/spec.md:42 read it _(finding, recorded by the operator, event 17)_',
    `- Completed one task. [ending unverified] — session \`${sessionId}\``
  ]) assert.ok(pack.markdown.includes(text), text)
  assert.deepEqual(packPart(pack), {name:'context',bytes:pack.markdown,sha256:pack.sha256})
  assert.equal(redact(pack.markdown).text, pack.markdown)
})

await test('budget selection uses cleaned lengths and repeated source sanitation is stable', async () => {
  const data = rows(); data.memory_facts[0].claim = 'SERVICE_TOKEN=' + 'x'.repeat(2000)
  const clean = structuredClone(data)
  clean.memory_facts[0].claim = redact(clean.memory_facts[0].claim).text
  const head = await compile({...rows(), memory_facts:[], session_transcripts:[]})
  const budget = head.markdown.length + 180
  const once = await compile(data, {budget})
  const twice = await compile(clean, {budget})
  assert.deepEqual(once.factIds, [factId])
  assert.equal(once.omittedFacts, 0)
  assert.equal(stableMarkdown(once.markdown), stableMarkdown(twice.markdown))
  assert.equal(redact(once.markdown).text, once.markdown)
})

await test('actual compiler → bundle → verified packet keeps one cleaned byte identity and scoped transport key', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-context-privacy-'))
  try {
    const data = rows(); data.memory_facts[0].claim = boundary
    data.memory_facts[0].source_ref = pem
    data.projects.purpose = secret
    data.session_transcripts[0].annotation = `Authorization: Bearer ${canary}`
    const before = structuredClone(data)
    const agent = {instructions:`Do the work.\n${secret}\n${pem}`,servers:[]}
    const originalAgent = structuredClone(agent)
    const transportToken = 'synthetic-ephemeral-connection-token'
    let lockedPack
    const compiler = createBundleCompiler({root, surface:{
      endpoint:'http://127.0.0.1:1/mcp',
      mint:()=>({token:transportToken}),revokeSession(){}
    }, context:async()=>{
      lockedPack = await compile(data, {taskInstruction:secret,taskBrief:{what:secret,why:'Useful.',expected:'Done.'}})
      return lockedPack.markdown
    }})
    const bundle = await compiler.compile(sessionId,projectId,null,'claude-code','mcp-config-flag',agent)
    assert.ok(bundle)
    const context = readFileSync(path.join(bundle.dir,'context.md'),'utf8')
    const packetRoot = path.join(root,'packets')
    const packet = JSON.parse(readFileSync(path.join(packetRoot,`packet-${sessionId}.json`),'utf8'))
    assert.deepEqual(verify(packetRoot,packet), {ok:true})
    assert.equal(readPart(packetRoot,packet,'context'),context)
    assert.equal(context,lockedPack.markdown)
    assert.equal(packet.refs[0].sha256,lockedPack.sha256)
    assert.equal(digest(context),lockedPack.sha256)
    assert.equal(packet.projectId,projectId); assert.equal(packet.sessionId,sessionId)
    for (const forbidden of [canary,token.slice(0,13),'syntheticPEMbody7391']) assert.ok(!context.includes(forbidden))
    const prompt = bundle.args[bundle.args.indexOf('--append-system-prompt')+1]
    assert.equal(prompt,`${redact(agent.instructions).text}\n\n${PREAMBLE}`)
    assert.ok(!prompt.includes(canary)); assert.ok(!prompt.includes('syntheticPEMbody7391'))
    assert.equal(redact(prompt).text,prompt)
    const config = JSON.parse(readFileSync(path.join(bundle.dir,'mcp.json'),'utf8'))
    assert.equal(config.mcpServers.fabric.headers.Authorization,`Bearer ${transportToken}`)
    assert.deepEqual(data,before); assert.deepEqual(agent,originalAgent)
  } finally { rmSync(root,{recursive:true,force:true}) }
})
console.log(`${passed} offline context privacy scenarios passed`)
