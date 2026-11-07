// CO-489: a session attaches a repository to its own project and detaches one of its folders, as the project page's
// buttons do, through the admission service; the person's detach and a plain folder stay refused. Stand-ins only.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createAgentFolders } = await import(path.resolve(import.meta.dirname, '../src/main/agentFolders.ts'))

function world({ repos = [], removals = [], gits = ['/w/app', '/w/app-2'], refuse = null } = {}) {
  const rows = repos.map((p, i) => ({ id: `r${i}`, project_id: 'P', path: p, label: path.basename(p), is_primary: i === 0, attached_at: '', remote_key: null, kind: i === 0 ? 'primary' : 'checkout' }))
  const acts = [], calls = []
  const folders = createAgentFolders({
    attach: async (projectId, paths, actor) => {
      calls.push(['attach', projectId, paths, actor])
      if (refuse) throw new Error(`repo-path-refused:${refuse}: ${paths[0]}`)
      for (const p of paths) rows.push({ id: `n${rows.length}`, project_id: projectId, path: p, label: path.basename(p), is_primary: false, attached_at: '', remote_key: null, kind: 'checkout' })
    },
    detach: async (projectId, repoId, actor) => { calls.push(['detach', projectId, repoId, actor]); rows.splice(rows.findIndex((r) => r.id === repoId), 1) },
    listRepos: async () => rows.slice(),
    listRemovals: async () => removals.map((p) => ({ path: p })),
    isRepository: async (f) => gits.includes(f),
    realpath: (f) => (f.startsWith('/w/') ? f.replace(/\/link$/, '/app-2') : null),
    note: async (outcome, opts) => { acts.push([outcome, opts]) }
  })
  return { folders, acts, calls, rows }
}

test('a session attaches a repository by its real path, as itself, and the change is an act History undoes', async () => {
  const w = world({ repos: ['/w/app'] })
  const a = await w.folders.attach('P', '/w/link', 'S1')
  assert.equal(a.done, true)
  assert.equal(a.folder, '/w/app-2')
  assert.deepEqual(a.folders, ['/w/app', '/w/app-2'])
  assert.deepEqual(w.calls[0], ['attach', 'P', ['/w/app-2'], { kind: 'agent', id: 'S1' }])
  assert.equal(w.acts.length, 1)
  assert.equal(w.acts[0][0].kind, 'repo.attach')
  assert.deepEqual(w.acts[0][0].inverse, { kind: 'repo.detach', args: { repo_id: 'n1' } })
  assert.deepEqual(w.acts[0][1], { actor: { kind: 'agent', id: 'S1' } })
})

test('refusals: a relative path, no folder, already attached, the person\'s detach, a plain folder', async () => {
  const w = world({ repos: ['/w/app'], removals: ['/w/app-2'] })
  assert.equal((await w.folders.attach('P', 'app', 'S1')).reason, 'not-a-path')
  assert.equal((await w.folders.attach('P', '/gone', 'S1')).reason, 'missing')
  assert.equal((await w.folders.attach('P', '/w/app', 'S1')).reason, 'already-attached')
  const detached = await w.folders.attach('P', '/w/app-2', 'S1')
  assert.equal(detached.reason, 'detached')
  assert.match(detached.says, /only the person/)
  assert.equal((await world().folders.attach('P', '/w/plain', 'S1')).reason, 'not-git')
  assert.equal(w.calls.length, 0, 'nothing reached the admission service')
  assert.equal(w.acts.length, 0)
})

test('the admission service\'s own refusals come back by their code; anything else is thrown', async () => {
  assert.equal((await world({ refuse: 'held-by-other' }).folders.attach('P', '/w/app', 'S1')).reason, 'held-by-other')
  assert.equal((await world({ refuse: 'too-broad' }).folders.attach('P', '/w/app', 'S1')).reason, 'too-broad')
  const broken = createAgentFolders({ ...{ listRepos: async () => [], listRemovals: async () => [], isRepository: async () => true, realpath: (f) => f, note: async () => {}, detach: async () => {} }, attach: async () => { throw new Error('database down') } })
  await assert.rejects(broken.attach('P', '/w/app', 'S1'), /database down/)
})

test('a session detaches a folder of its project, and History can attach the same folder again', async () => {
  const w = world({ repos: ['/w/app', '/w/app-2'] })
  const d = await w.folders.detach('P', '/w/app-2', 'S1')
  assert.equal(d.done, true)
  assert.deepEqual(d.folders, ['/w/app'])
  assert.deepEqual(w.calls[0], ['detach', 'P', 'r1', { kind: 'agent', id: 'S1' }])
  assert.equal(w.acts[0][0].kind, 'repo.detach')
  assert.deepEqual(w.acts[0][0].inverse.args, { project_id: 'P', repo_id: 'r1', path: '/w/app-2', label: 'app-2', remote_key: null, repo_kind: 'checkout' })
})

test('a folder of another project, or none, is not this project\'s to detach; a folder gone from disk still is', async () => {
  const w = world({ repos: ['/w/app', '/gone/old'] })
  assert.equal((await w.folders.detach('P', '/w/other', 'S1')).reason, 'not-attached')
  assert.equal((await w.folders.detach('P', 'old', 'S1')).reason, 'not-a-path')
  assert.equal((await w.folders.detach('P', '/gone/old', 'S1')).done, true)
})

test('an unreadable folder list refuses and writes nothing', async () => {
  const f = createAgentFolders({ listRepos: async () => { throw new Error('read failed') }, listRemovals: async () => [], isRepository: async () => true, realpath: (x) => x, note: async () => {}, attach: async () => {}, detach: async () => {} })
  assert.equal((await f.attach('P', '/w/app', 'S1')).reason, 'unreadable')
  assert.equal((await f.detach('P', '/w/app', 'S1')).reason, 'unreadable')
})
