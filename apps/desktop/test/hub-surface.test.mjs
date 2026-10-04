// The hub's door under load and its port (verification iteration 1 for 0.3.1), with the real
// AgentSurface and hub tools over an in-memory access store — no database:
//   ER-7  the door token is shared by every agent on this Mac, so one agent polling cannot spend the
//         budget of another; an unknown bearer is budgeted BEFORE it costs a credential lookup.
//   ER-8  while Fabric holds the hub port on 127.0.0.1, it holds it on [::1] too, so `localhost` reaches
//         Fabric, not a squatter; and the agent-facing text says to use the published origin verbatim.
// #region hub-consent — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#1-one-door-a-second-way-in
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { createHash } from 'node:crypto'
import path from 'node:path'
import test from 'node:test'
import { memStore, fakeRegistry } from './helpers/access-memstore.mjs'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { AgentSurface, HubPortUnavailable } = await import(path.join(SRC, 'agentSurface.ts'))
const { hubServerFor } = await import(path.join(SRC, 'hubTools.ts'))
const { AccessService } = await import(path.join(SRC, 'accessService.ts'))

const DOOR = 'D'.repeat(43)
async function hub(limits = {}, store = memStore()) {
  const lookups = { n: 0 }
  const access = new AccessService({ store, registry: fakeRegistry(['example-agent', 'other-agent']), present: () => {}, connected: async () => true })
  const counted = Object.assign(Object.create(access), { authenticate: async (t) => { lookups.n++; return access.authenticate(t) } })
  const surface = new AgentSurface({
    db: null, journal: null, ptys: () => undefined, estateId: 'e', limits,
    hub: { doorToken: () => DOOR, access: counted, tools: (p) => hubServerFor(p, { access }) }
  })
  await surface.start()
  return { surface, access, lookups }
}
const rpc = async (surface, token, method, params) => {
  const r = await fetch(`${surface.origin}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const text = await r.text()
  let body = null
  try { body = JSON.parse(text) } catch { body = text }
  return { status: r.status, body }
}
const askArgs = (agentId) => ({ agentId, callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['news@example.com'], reason: 'digest' })

test('ER-7: one agent spending the door budget does not lock another agent out of asking', async () => {
  const { surface } = await hub({ budgetCalls: 5, budgetWindowMs: 60_000 })
  const first = await rpc(surface, DOOR, 'tools/call', { name: 'fabric.access.request', arguments: askArgs('example-agent') })
  const { requestId, pollSecret } = first.body.result.structuredContent
  // example-agent polls its own request in a tight loop until it is refused.
  const polls = []
  for (let i = 0; i < 8; i++) polls.push((await rpc(surface, DOOR, 'tools/call', { name: 'fabric.access.status', arguments: { requestId, pollSecret } })).status)
  assert.ok(polls.includes(429), `a tight poll was never budgeted: ${polls.join(',')}`)
  const other = await rpc(surface, DOOR, 'tools/call', { name: 'fabric.access.request', arguments: askArgs('other-agent') })
  assert.equal(other.status, 200, 'another agent was refused because the first one spent the shared door budget')
  await surface.stop()
})

test('ER-7: unknown bearers are budgeted before they cost a credential lookup', async () => {
  const { surface, lookups } = await hub({ budgetCalls: 5, budgetWindowMs: 60_000 })
  const codes = []
  for (let i = 0; i < 60; i++) codes.push((await rpc(surface, `${String(i).padStart(2, '0')}${'x'.repeat(41)}`, 'tools/list', {})).status)
  assert.ok(codes.includes(429), `unknown bearers were never refused 429: ${[...new Set(codes)].join(',')}`)
  assert.ok(lookups.n < 60, `every one of 60 unknown bearers cost a lookup (${lookups.n})`)
  await surface.stop()
})

test('V2 ER-3: existing binding survives an unknown-token flood after ingress restart, revocation still refuses', async (t) => {
  const store=memStore(), credential='c'.repeat(43)
  const binding={id:'existing',agent_id:'example-agent',verifier:createHash('sha256').update(credential).digest('hex'),revoked_at:null}
  store.maps.bindings.set(binding.id,binding)
  const {surface}=await hub({budgetCalls:5,budgetWindowMs:60_000},store)
  t.after(()=>surface.stop())
  for(let i=0;i<5;i++) await rpc(surface, `${String(i).padStart(2,'0')}${'x'.repeat(41)}`, 'tools/list',{})
  assert.equal((await rpc(surface,credential,'tools/list',{})).status,200)
  binding.revoked_at=new Date().toISOString()
  assert.equal((await rpc(surface,credential,'tools/list',{})).status,401)
})

test('ER-8: the hub holds its port on [::1] as well, so localhost reaches Fabric and not a squatter', async () => {
  const probe = createServer()
  await new Promise((r) => probe.listen(0, '127.0.0.1', r))
  const port = probe.address().port
  await new Promise((r) => probe.close(r))
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e' })
  await surface.start({ port })
  const squat = await new Promise((resolve) => {
    const q = createServer((req, res) => res.end('SQUATTER'))
    q.once('error', (e) => resolve(e.code))
    q.listen(port, '::1', () => { q.close(); resolve('BOUND') })
  })
  assert.notEqual(squat, 'BOUND', 'another program took the hub port on [::1] while Fabric held it')
  const r = await fetch(`http://[::1]:${port}/nothing`, { method: 'POST' })
  assert.equal(r.status, 404, '[::1] did not reach Fabric')
  await surface.stop()
  // Stopped, both loopbacks are free again.
  const again = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e' })
  await again.start({ port })
  await again.stop()
})

test('ER-8: [::1] taken by another program refuses the hub port, as 127.0.0.1 taken does', async () => {
  const blocker = createServer()
  await new Promise((r) => blocker.listen(0, '::1', r))
  const port = blocker.address().port
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e' })
  await assert.rejects(surface.start({ port }), (e) => e instanceof HubPortUnavailable && /\[::1\]|::1/.test(e.message))
  assert.equal(surface.origin, '')
  // Nothing is left half-listening on 127.0.0.1.
  const probe = createServer()
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve) })
  probe.close(); blocker.close()
})

test('ER-8: the agent-facing text says to use the published origin verbatim, never localhost', async () => {
  const { surface } = await hub()
  const tools = (await rpc(surface, DOOR, 'tools/list', {})).body.result.tools
  for (const t of tools) assert.match(t.description, /origin.*exactly.*never.*localhost/i, `${t.name} does not say to use the origin as written`)
  await surface.stop()
})
// #endregion hub-consent


test('V2 ER-3: hostile Host and browser Origin are refused before any credential lookup', async (t) => {
  const { surface, lookups } = await hub({ budgetCalls: 5 })
  t.after(() => surface.stop())
  for (const headers of [{host: 'attacker.example'}, {host: `attacker.example@127.0.0.1:${new URL(surface.origin).port}`}, {host: `127.0.0.1:${Number(new URL(surface.origin).port) + 1}`}, {origin: 'http://attacker.example'}, {origin: 'null'}]) {
    const status = await new Promise((resolve, reject) => {
      const req = request(`${surface.origin}/mcp`, {method:'POST',headers:{authorization:'Bearer attacker','content-type':'application/json',...headers}}, res => {res.resume();res.on('end',()=>resolve(res.statusCode))})
      req.on('error',reject);req.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}))
    })
    assert.ok([403,421].includes(status), `host/origin accepted: ${status}`)
  }
  assert.equal(lookups.n, 0, 'hostile browser traffic spent the unknown credential budget')
  assert.equal((await rpc(surface, DOOR, 'tools/list', {})).status, 200)
})

test('V2 ER-5: JSON-RPC batches are rejected before creating a hub transport', async (t) => {
  const { surface } = await hub()
  t.after(() => surface.stop())
  const body = Array.from({length: 300}, (_, i) => ({jsonrpc:'2.0',id:i,method:'tools/list'}))
  const res = await fetch(`${surface.origin}/mcp`, {method:'POST',headers:{authorization:`Bearer ${DOOR}`,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify(body)})
  assert.equal(res.status,400)
  assert.match(await res.text(), /batch/i)
})
