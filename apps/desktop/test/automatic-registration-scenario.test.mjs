// REQ-001/REQ-004 of the automatic project registration run (org-index docs/runs/2026-10-17-automatic-project-registration):
// the main-process path a coding agent's first call takes, composed from the REAL pieces index.ts wires together —
// resolveAgentFolder (sessionEnroll.ts), AccessService.request/status (accessService.ts) and the canonical admission
// service (projectAdmission.ts) — over real temporary Git repositories, a worktree and a clone. Two rounds: the first
// registers, the second must change no Project or repository. Then the operator's detach and a standing denial must
// hold against automation. In-memory journal projections stand in for PostgreSQL (the projector half is covered by
// command-ingress-db.test.mjs); no Electron, no network, no running Fabric is touched.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { AccessService } = await import(path.join(SRC, 'accessService.ts'))
const { createProjectAdmission } = await import(path.join(SRC, 'projectAdmission.ts'))
const { resolveAgentFolder } = await import(path.join(SRC, 'sessionEnroll.ts'))
const { inspectFolder } = await import(path.join(SRC, 'projectDiscovery.ts'))
const { folderProjectId } = await import(path.join(SRC, 'folderResolver.ts'))
const { originOf } = await import(path.join(SRC, 'agentSyncLeases.ts'))

const ESTATE = '0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const OPERATOR = { kind: 'person', id: 'operator' }
const RUNNERS = { 'claude-code': 'Claude Code', codex: 'Codex', 'kimi-code': 'Kimi Code' }
const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'fabric-autoreg-')))

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
function repository(name, remote = null) {
  const folder = path.join(root, name)
  mkdirSync(folder, { recursive: true })
  git('-C', folder, 'init', '-q')
  git('-C', folder, 'config', 'user.name', 'Fabric Test')
  git('-C', folder, 'config', 'user.email', 'fabric@example.invalid')
  writeFileSync(path.join(folder, 'README.md'), `# ${name}\n`)
  git('-C', folder, 'add', 'README.md')
  git('-C', folder, 'commit', '-qm', 'initial')
  if (remote) git('-C', folder, 'remote', 'add', 'origin', remote)
  return folder
}

/** One Fabric main process: the project projection, the access store and the wiring index.ts does. */
function fabric() {
  const projects = new Map(), repos = [], removals = [], projectEvents = []
  const applyProject = (e) => {
    projectEvents.push(e)
    if (e.type === 'project.created@1') {
      projects.set(e.payload.id, { id: e.payload.id, estate_id: ESTATE, name: e.payload.name, status: 'active', repo_path: null })
    } else if (e.type === 'project.repo.attached@1') {
      if (repos.some((r) => r.path === e.payload.path)) throw new Error('project_repos path is unique per estate')
      repos.push({ id: e.payload.id, project_id: e.projectId, path: e.payload.path, label: e.payload.label,
        is_primary: !repos.some((r) => r.project_id === e.projectId && r.is_primary), attached_at: '2026-10-18T00:00:00Z',
        remote_key: e.payload.remote_key ?? null, kind: e.payload.kind ?? 'checkout' })
      for (let i = removals.length - 1; i >= 0; i--) {
        const r = removals[i]
        if (r.project_id === e.projectId && (r.path === e.payload.path || (r.remoteKey && r.remoteKey === e.payload.remote_key))) removals.splice(i, 1)
      }
    } else if (e.type === 'project.repo.detached@1') {
      const i = repos.findIndex((r) => r.id === e.payload.id)
      if (i >= 0) repos.splice(i, 1)
      removals.push({ id: e.payload.id, project_id: e.projectId, path: e.payload.path ?? null, remoteKey: e.payload.remote_key ?? null })
    }
  }
  const admission = createProjectAdmission({
    estateId: ESTATE,
    append: async (e) => applyProject(e),
    readProject: async (id) => projects.get(id) ?? null,
    listRepos: async (projectId) => repos.filter((r) => r.project_id === projectId),
    readImported: async () => {
      const out = new Map()
      for (const r of repos) out.set(r.path, [...(out.get(r.path) ?? []), { id: r.project_id, name: projects.get(r.project_id)?.name ?? r.project_id }])
      return out
    },
    listRemovals: async () => removals,
    refresh: async () => {},
    home: root
  })
  const folders = {
    admittedFolders: async () => repos.map((r) => ({ projectId: r.project_id, path: r.path, remoteKey: r.remote_key, kind: r.kind })),
    detachedFolders: async () => removals,
    realpath: (folder) => { try { return realpathSync.native(folder) } catch { return null } },
    remoteOf: originOf,
    inspectFolder,
    projectIdForFolder: (folder) => folderProjectId(ESTATE, folder),
    home: root
  }

  const rows = new Map(), bindings = new Map(), grants = new Map(), accessEvents = [], presented = []
  const matching = (r, f = {}) => (!f.status || r.status === f.status) && (!f.agentId || r.agent_id === f.agentId) &&
    (!f.callee || r.callee === f.callee) && (!f.liveAt || Date.parse(r.expires_at) > Date.parse(f.liveAt)) &&
    (!f.standingOnly || r.denial_cleared_at === null)
  const store = {
    requests: async (f) => [...rows.values()].filter((r) => matching(r, f)),
    countRequests: async (f) => [...rows.values()].filter((r) => matching(r, f)).length,
    binding: async (id) => bindings.get(id) ?? null,
    bindingByVerifier: async (v) => [...bindings.values()].find((b) => b.verifier === v) ?? null,
    liveBindings: async () => [...bindings.values()].filter((b) => b.revoked_at === null),
    grants: async (f = {}) => [...grants.values()].filter((g) => (!f.bindingId || g.binding_id === f.bindingId) &&
      (!f.requestId || g.request_id === f.requestId) && (!(f.unrevoked || f.liveAt) || g.revoked_at === null)),
    grant: async (id) => grants.get(id) ?? null,
    request: async (id) => rows.get(id) ?? null,
    append: async (type, actor, payload) => {
      accessEvents.push({ type, actor, payload })
      if (type === 'access.requested@1') rows.set(payload.id, { ...payload, asked_by_binding: payload.binding_id, status: 'pending', decided_at: null, granted_binding_id: null, credential_claimed_at: null, denial_cleared_at: null })
      else if (type === 'access.decided@1') {
        const row = rows.get(payload.request_id)
        Object.assign(row, { status: payload.decision, decided_at: new Date().toISOString() })
        if (payload.decision === 'allowed') {
          row.granted_binding_id = payload.binding_id
          if (payload.new_binding) bindings.set(payload.binding_id, { id: payload.binding_id, agent_id: row.agent_id, request_id: row.id, verifier: null, created_at: row.decided_at, claimed_at: null, revoked_at: null })
          for (const g of payload.grants) grants.set(g.id, { ...g, binding_id: payload.binding_id, request_id: row.id, agent_id: row.agent_id, callee: row.callee, decided_at: row.decided_at, revoked_at: null })
        }
      } else if (type === 'access.credential.claimed@1') Object.assign(bindings.get(payload.binding_id), { verifier: payload.verifier, claimed_at: new Date().toISOString() })
      return accessEvents.length
    }
  }
  const access = new AccessService({
    store,
    registry: { refresh() { throw Error('an enrollment ask must not read the service registry') }, resolve() { throw Error('nor resolve in it') } },
    present: (r) => presented.push(r),
    connected: async () => false,
    enrollment: {
      runner: (id) => (RUNNERS[id] ? { key: id, name: RUNNERS[id], summary: 'a coding agent' } : null),
      available: async () => true,
      project: async (id) => projects.get(id) ?? null,
      // index.ts#session-enroll-wiring, verbatim in shape.
      resolve: async (folder) => {
        const f = await resolveAgentFolder(folder, folders)
        return f.ok ? { ok: true, projectId: f.projectId, root: f.root, real: f.real, projectName: f.projectName, how: f.how, candidate: f.candidate, remoteKey: f.remoteKey } : { ok: false, message: f.message }
      },
      admit: async (folder, agentId) => {
        const project = await admission.enroll({ ...folder, real: folder.real ?? folder.root }, agentId)
        return { id: project.id, name: project.name, root: folder.root, how: folder.how }
      }
    }
  })

  /** What fabric-mcp does on a coding agent's start: session.enroll names the Project, the ask is made, the
   *  credential is collected. Returns the agent's view of the outcome. */
  async function agentStarts(runner, cwd) {
    const named = await resolveAgentFolder(cwd, folders)
    if (!named.ok) return { refused: named.message }
    const asked = await access.request({ kind: 'door' }, {
      agentId: runner, callee: 'fabric', capabilities: ['session.enroll'], resources: [`project:${named.projectId}`],
      reason: `${RUNNERS[runner]} in ${cwd}`, folder: cwd
    })
    if (!asked.ok) return { refused: asked.refused }
    if (asked.status !== 'allowed') return { status: asked.status }
    const collected = await access.status({ kind: 'door' }, asked.requestId, asked.pollSecret)
    return { status: collected.status, credential: collected.credential, projectId: named.projectId, how: named.how }
  }

  return { projects, repos, removals, projectEvents, accessEvents, presented, rows, admission, agentStarts }
}

const projectWrites = (f) => f.projectEvents.length

test('two rounds of agents opening a new repository, its worktree and a clone register one Project once', async () => {
  const f = fabric()
  const repo = repository('site', 'git@github.com:passioncode-ai/site.git')
  const worktree = path.join(root, 'site-feature')
  git('-C', repo, 'worktree', 'add', '-q', '-b', 'feature', worktree)
  const clone = repository('site-clone', 'https://github.com/passioncode-ai/site.git')
  const expected = folderProjectId(ESTATE, repo)

  // Round 1: nothing is known; the first agent's start creates the Project and the other two attach to it.
  const first = await f.agentStarts('claude-code', repo)
  assert.equal(first.status, 'allowed', JSON.stringify(first))
  assert.match(first.credential, /^[A-Za-z0-9_-]{43}$/, 'the coding agent collects its revocable credential')
  assert.equal(first.projectId, expected)
  const inWorktree = await f.agentStarts('codex', worktree)
  assert.deepEqual([inWorktree.status, inWorktree.projectId, inWorktree.how], ['allowed', expected, 'worktree'])
  const inClone = await f.agentStarts('kimi-code', clone)
  assert.deepEqual([inClone.status, inClone.projectId, inClone.how], ['allowed', expected, 'remote'])

  assert.equal(f.projects.size, 1, 'one Project, never a sibling per checkout')
  assert.equal(f.projects.get(expected).name, 'site')
  assert.deepEqual(f.repos.map((r) => [path.basename(r.path), r.kind, r.remote_key]),
    [['site', 'primary', 'github.com/passioncode-ai/site'], ['site-clone', 'checkout', 'github.com/passioncode-ai/site']],
    'the worktree is attributed to the main checkout and needs no row of its own; the clone is a checkout')
  assert.ok(f.projectEvents.every((e) => e.actor.kind === 'agent'), 'every write is recorded as the coding agent\'s act')
  assert.equal(f.presented.length, 0, 'ADR-0160: no confirmation prompt on the operator\'s own machine')
  assert.ok(f.accessEvents.filter((e) => e.type === 'access.decided@1').every((e) => e.actor.kind === 'agent'))

  // Round 2: the same three starts again change no Project and no repository.
  const writes = projectWrites(f)
  for (const [runner, cwd, how] of [['claude-code', repo, 'exact'], ['codex', worktree, 'worktree'], ['kimi-code', clone, 'exact']]) {
    const again = await f.agentStarts(runner, cwd)
    assert.deepEqual([again.status, again.projectId, again.how], ['allowed', expected, how], `${runner} in ${cwd}`)
  }
  assert.equal(projectWrites(f), writes, 're-entry writes nothing to Projects or repositories')
  assert.equal(f.projects.size, 1)
  assert.equal(f.repos.length, 2)
})

test('the operator\'s detach and a standing denial hold against later agent starts; broad and plain folders are refused', async () => {
  const f = fabric()
  const repo = repository('kept-out', 'git@github.com:passioncode-ai/kept-out.git')
  const first = await f.agentStarts('claude-code', repo)
  assert.equal(first.status, 'allowed')
  await f.admission.detach(first.projectId, f.repos[0].id, OPERATOR)

  const writes = projectWrites(f)
  for (let round = 1; round <= 2; round++) {
    const after = await f.agentStarts('claude-code', repo)
    assert.match(after.refused ?? '', /detached/, `round ${round}: ${JSON.stringify(after)}`)
  }
  assert.equal(projectWrites(f), writes, 'automation never reattaches what the operator detached')

  const denied = repository('denied', 'git@github.com:passioncode-ai/denied.git')
  const id = folderProjectId(ESTATE, denied)
  // The operator denied this exact ask earlier: a standing denial the store already holds.
  f.rows.set('d0000000-0000-4000-8000-000000000001', {
    id: 'd0000000-0000-4000-8000-000000000001', agent_id: 'codex', callee: 'fabric', capabilities: ['session.enroll'],
    resources: [`project:${id}`], status: 'denied', expires_at: new Date(Date.now() + 3600_000).toISOString(), denial_cleared_at: null, asked_by_binding: null
  })
  const before = projectWrites(f)
  const refusedByDenial = await f.agentStarts('codex', denied)
  assert.equal(refusedByDenial.status, 'denied', JSON.stringify(refusedByDenial))
  assert.equal(projectWrites(f), before, 'a standing denial is read before any admission write')

  const plain = path.join(root, 'plain-folder')
  mkdirSync(plain)
  assert.match((await f.agentStarts('claude-code', plain)).refused ?? '', /not inside a Git repository/)
  assert.match((await f.agentStarts('claude-code', root)).refused ?? '', /Git repository|too broad/)
  assert.equal(projectWrites(f), before)
})
