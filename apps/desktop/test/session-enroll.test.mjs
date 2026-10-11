// `fabric.session.enroll` (ADR-0134 §2): a live grant on the resolved project mints a session like a launched
// one and journals it; no grant, no project or a bad folder are typed answers. Pure — injected store.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { enrollSession } = await import(path.resolve(import.meta.dirname, '../src/main/sessionEnroll.ts'))

const P = '0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const binding = { id: 'b-1', agent_id: 'claude-code', revoked_at: null }
const grant = (over = {}) => ({ id: 'g-1', callee: 'fabric', capability: 'session.enroll', resource: `project:${P}`, revoked_at: null, expires_at: new Date(Date.now() + 86400000).toISOString(), ...over })

function deps(over = {}) {
  const minted = [], journaled = []
  return {
    minted, journaled,
    d: {
      liveGrants: async () => [grant()],
      admittedFolders: async () => [{ projectId: P, path: '/Users/me/DATA/site' }],
      projectName: async () => 'site',
      realpath: (f) => f,
      mint: (projectId, sessionId, taskId) => { minted.push({ projectId, sessionId, taskId }); return { token: 'T'.repeat(32) } },
      journal: async (type, projectId, payload) => { journaled.push({ type, projectId, payload }) },
      gitCommonDir: () => null,
      ...over
    }
  }
}

test('a live grant on the folder\'s project mints one session for that project, no task, and journals it', async () => {
  const h = deps()
  const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site/src', runtimeSessionId: 'abc-123' }, h.d)
  assert.equal(r.ok, true)
  assert.equal(r.session.projectId, P)
  assert.equal(r.session.how, 'ancestor')
  assert.deepEqual(h.minted.map((m) => [m.projectId, m.taskId]), [[P, null]])
  assert.equal(h.journaled[0].type, 'session.enrolled@1')
  assert.equal(h.journaled[0].payload.runner, 'claude-code')
  assert.equal(h.journaled[0].payload.runtime_session_id, 'abc-123')
  assert.equal(JSON.stringify(h.journaled).includes('/Users/me'), false, 'the folder itself is not journalled')
})

test('no grant, a revoked grant, an expired grant or a grant on another project: needs-grant, nothing minted', async () => {
  for (const grants of [[], [grant({ revoked_at: 'x' })], [grant({ expires_at: new Date(Date.now() - 1).toISOString() })], [grant({ resource: 'project:1b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d' })], [grant({ capability: 'agent.call' })]]) {
    const h = deps({ liveGrants: async () => grants })
    const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)
    assert.deepEqual([r.ok, r.code, r.resource], [false, 'needs-grant', `project:${P}`])
    assert.equal(h.minted.length, 0)
    assert.equal(h.journaled.length, 0)
  }
})

test('a folder no project holds: no-project, with what to do', async () => {
  const h = deps()
  const r = await enrollSession(binding, { cwd: '/Users/me/elsewhere' }, h.d)
  assert.deepEqual([r.ok, r.code], [false, 'no-project'])
  assert.match(r.message, /Open a project/)
})

test('a relative, missing or non-string folder: bad-folder', async () => {
  for (const cwd of ['relative', 42, undefined]) assert.equal((await enrollSession(binding, { cwd }, deps().d)).code, 'bad-folder')
  assert.equal((await enrollSession(binding, { cwd: '/gone' }, deps({ realpath: () => null }).d)).code, 'bad-folder')
})
