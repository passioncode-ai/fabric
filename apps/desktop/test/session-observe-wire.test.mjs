// fabric_session_observe takes what the working-with-fabric session hooks actually send (D4, the adapter's
// `fabric_session.py#deliver`). The hook reads a turn's facts from git and sends JSON `null` for every fact git could
// not give: a folder that is not a repository (no HEAD, no status), a repository with no commit yet (no HEAD, so no
// lines against it). Before this test the schema took `head: null` but refused `filesChanged`/`linesAdded`/
// `linesRemoved: null` as invalid input (MCP -32602), so every turn of such a session was refused — `refused:unnamed`
// in the hook's log — and never journalled.
//
// Driven the way the hook meets it: a real MCP client and server (the SDK validates the arguments against the tool's
// registered schema), the real `registerWorkTools`. The store and the journal are stand-ins: this proves the WIRE
// (what is accepted, and the payload built from it), not the journal write, which `work-claims-db.test.mjs` proves on
// a disposable stack.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

const { registerWorkTools } = await import(path.resolve(import.meta.dirname, '../src/main/workTools.ts'))

/** A scoped-store stand-in: every read answers "nothing recorded yet". */
const emptyStore = {
  select() {
    const chain = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve) => resolve({ data: [], error: null })
        if (prop === 'maybeSingle' || prop === 'single') return async () => ({ data: null, error: null })
        return () => chain
      }
    })
    return chain
  }
}

async function connect(runtimeSessionId = 'rt-hook-1') {
  const appended = []
  const observed = []
  let ended = 0
  const server = new McpServer({ name: 'fabric', version: 'test' })
  registerWorkTools(server, {
    scope: { estateId: 'e', projectId: 'p', sessionId: 's-1', taskId: null, cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId },
    store: emptyStore,
    append: async (e) => { appended.push(e); return { seq: appended.length } },
    appendObserved: async (e) => { observed.push(e); return { seq: 100 + observed.length } },
    checkReference: () => {},
    sessions: () => [],
    session: () => null,
    resolveSource: async () => ({ ok: false, part: 'repository', reason: 'none' }),
    leaseRefs: async () => null,
    onClaimed: () => {},
    endSession: () => { ended++ },
    now: () => Date.parse('2026-10-13T10:00:00Z')
  })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a)
  const client = new Client({ name: 'hook', version: 'test' })
  await client.connect(b)
  return { client, appended, observed, get ended() { return ended } }
}

// The hook's arguments, exactly as `deliver` builds them: dict(git_facts(cwd), event, runtime, runtimeSessionId,
// observedAt, idempotencyKey), observedAt in `%Y-%m-%dT%H:%M:%SZ`, the key `<session id>:<spool entry>`.
const hookTurn = (facts) => ({
  head: null, filesChanged: null, linesAdded: null, linesRemoved: null, ...facts,
  event: 'turn', runtime: 'claude-code', runtimeSessionId: 'rt-hook-1', observedAt: '2026-10-13T10:00:00Z',
  idempotencyKey: 'rt-hook-1:0001780000000'
})
const said = (r) => JSON.parse(r.content[0].text)

test('a turn in a folder that is not a git repository (every fact null) is recorded, its facts null', async () => {
  const h = await connect()
  const r = await h.client.callTool({ name: 'fabric_session_observe', arguments: hookTurn({}) })
  assert.notEqual(r.isError, true, JSON.stringify(r))
  assert.equal(said(r).recorded, true)
  assert.equal(h.appended.length, 1)
  const p = h.appended[0].payload
  assert.equal(h.appended[0].type, 'session.turn.observed@1')
  assert.deepEqual([p.head, p.files_changed, p.lines_added, p.lines_removed], [null, null, null, null])
})

test('a turn in a repository with no commit yet (no HEAD, so no lines) is recorded with the count git gave', async () => {
  const h = await connect()
  const r = await h.client.callTool({ name: 'fabric_session_observe', arguments: hookTurn({ filesChanged: 2 }) })
  assert.notEqual(r.isError, true, JSON.stringify(r))
  const p = h.appended[0].payload
  assert.deepEqual([p.head, p.files_changed, p.lines_added, p.lines_removed], [null, 2, null, null])
})

test('an end with null facts is recorded with its reason and ends the session', async () => {
  const h = await connect()
  const r = await h.client.callTool({ name: 'fabric_session_observe', arguments: { ...hookTurn({}), event: 'end', reason: 'prompt_input_exit', idempotencyKey: 'rt-hook-1:0001780000001' } })
  assert.notEqual(r.isError, true, JSON.stringify(r))
  assert.equal(said(r).session, 'ended')
  assert.equal(h.observed[0].payload.reason, 'prompt_input_exit')
  assert.equal(h.observed[0].payload.files_changed, null)
  assert.equal(h.ended, 1)
})

test('the facts still refuse what is not a count: a negative or fractional number, a string', async () => {
  const h = await connect()
  for (const bad of [{ filesChanged: -1 }, { linesAdded: 1.5 }, { linesRemoved: '3' }]) {
    const r = await h.client.callTool({ name: 'fabric_session_observe', arguments: hookTurn(bad) }).catch((e) => ({ isError: true, thrown: String(e) }))
    assert.equal(r.isError, true, `accepted ${JSON.stringify(bad)}`)
  }
  assert.equal(h.appended.length, 0)
})
