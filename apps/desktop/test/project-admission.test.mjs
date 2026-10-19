// Automatic project registration through the real main-process admission service and the real resolver.
// Real temporary Git repositories; an in-memory journal projection, with stack-backed projector coverage in
// command-ingress-db.test.mjs. No Electron event is fabricated and no remote is contacted.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { createProjectAdmission } = await import(path.join(SRC, 'projectAdmission.ts'))
const { resolveAgentFolder } = await import(path.join(SRC, 'sessionEnroll.ts'))
const { inspectFolder } = await import(path.join(SRC, 'projectDiscovery.ts'))
const { folderProjectId, gitTopLevel } = await import(path.join(SRC, 'folderResolver.ts'))
const { ScanCandidates } = await import(path.join(SRC, 'startChoices.ts'))
const { originOf } = await import(path.join(SRC, 'agentSyncLeases.ts'))

const ESTATE = '0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const OPERATOR = { kind: 'person', id: 'operator' }
const root = mkdtempSync(path.join(tmpdir(), 'fabric-admission-'))
let nextId = 0
const uuid = () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

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

function harness(home = root) {
  const projects = new Map(), repos = [], removals = [], events = []
  let refreshes = 0, mirrors = 0
  const apply = (e) => {
    events.push(e)
    if (e.type === 'project.created@1') {
      projects.set(e.payload.id, {
        id: e.payload.id, estate_id: ESTATE, name: e.payload.name, purpose: e.payload.purpose ?? null,
        repo_path: null, status: 'active', config_revision: 0, created_at: '2026-10-17T00:00:00Z',
        memory_backend: 'local', default_agent: 'claude-code', mcp_servers: []
      })
    } else if (e.type === 'project.repo.attached@1') {
      if (!repos.some((r) => r.id === e.payload.id)) {
        repos.push({
          id: e.payload.id, project_id: e.projectId, path: e.payload.path, label: e.payload.label,
          is_primary: !repos.some((r) => r.project_id === e.projectId && r.is_primary), attached_at: '2026-10-17T00:00:00Z',
          remote_key: e.payload.remote_key ?? null, kind: e.payload.kind ?? 'checkout', admitted_by: e.payload.admitted_by ?? null
        })
      }
      for (let i = removals.length - 1; i >= 0; i--) {
        const r = removals[i]
        if (r.id === e.payload.id || (r.project_id === e.projectId && (r.path === e.payload.path || (r.remote_key && r.remote_key === e.payload.remote_key)))) removals.splice(i, 1)
      }
    } else if (e.type === 'project.repo.detached@1') {
      const index = repos.findIndex((r) => r.id === e.payload.id && r.project_id === e.projectId)
      if (index >= 0) repos.splice(index, 1)
      removals.push({ id: e.payload.id, project_id: e.projectId, path: e.payload.path ?? null, remote_key: e.payload.remote_key ?? null, kind: e.payload.kind ?? null })
    }
  }
  const service = createProjectAdmission({
    estateId: ESTATE,
    append: async (e) => apply(e),
    readProject: async (id) => projects.get(id) ?? null,
    listRepos: async (projectId) => repos.filter((r) => r.project_id === projectId),
    readImported: async () => {
      const out = new Map()
      for (const r of repos) out.set(r.path, [...(out.get(r.path) ?? []), { id: r.project_id, name: projects.get(r.project_id)?.name ?? r.project_id }])
      return out
    },
    listRemovals: async () => removals,
    refresh: async () => { refreshes++ },
    mirror: () => { mirrors++ },
    home
  })
  const reach = { granted: (p) => p, candidates: new ScanCandidates({ home }), home }
  const deps = {
    admittedFolders: async () => repos.map((r) => ({ projectId: r.project_id, path: r.path, remoteKey: r.remote_key, kind: r.kind })),
    detachedFolders: async () => removals,
    realpath: (folder) => realpathSync.native(folder),
    remoteOf: (folder) => originOf(folder),
    inspectFolder: (folder) => inspectFolder(folder),
    gitTopLevel: (folder) => gitTopLevel(folder),
    projectIdForFolder: (folder) => folderProjectId(ESTATE, folder),
    home
  }
  return { service, deps, projects, repos, removals, events, reach, get refreshes() { return refreshes }, get mirrors() { return mirrors } }
}

const resolve = (h, cwd) => resolveAgentFolder(cwd, h.deps)

test('an unknown eligible Git repository is proposed without a write, created once, and is exact on re-entry', async () => {
  const h = harness()
  const repo = repository('alpha', 'git@github.com:passioncode-ai/alpha.git')
  const proposed = await resolve(h, repo)
  const realRepo = realpathSync.native(repo)
  assert.equal(proposed.ok, true)
  assert.deepEqual([proposed.candidate, proposed.how, proposed.root, proposed.projectId], ['create', 'create', realRepo, folderProjectId(ESTATE, realRepo)])
  assert.equal(h.events.length, 0, 'the door proposal itself writes nothing')

  const project = await h.service.enroll(proposed, 'kimi-code')
  assert.equal(project.id, proposed.projectId)
  assert.deepEqual(h.events.map((e) => e.type), ['project.created@1', 'project.repo.attached@1'])
  assert.deepEqual(h.events.map((e) => e.actor), [{ kind: 'agent', id: 'kimi-code' }, { kind: 'agent', id: 'kimi-code' }])
  assert.deepEqual(h.repos.map((r) => [r.kind, r.remote_key, r.admitted_by]), [['primary', 'github.com/passioncode-ai/alpha', 'agent']])

  const again = await resolve(h, repo)
  assert.deepEqual([again.how, again.candidate], ['exact', undefined])
  await h.service.enroll(again, 'kimi-code')
  assert.equal(h.events.length, 2, 're-entry is idempotent')
  assert.ok(h.refreshes >= 1)
  assert.equal(h.mirrors, 1)
})

test('a clone joins its existing project by remote and a worktree of an unknown repository creates at the main root', async () => {
  const h = harness()
  const main = repository('main', 'git@github.com:passioncode-ai/shared.git')
  const clone = repository('clone', 'https://github.com/passioncode-ai/shared.git')
  const created = await h.service.create({ id: uuid(), name: 'shared', repoPaths: [main] }, OPERATOR, h.reach)
  const initialEvents = h.events.length

  const remote = await resolve(h, clone)
  assert.deepEqual([remote.candidate, remote.how, remote.projectId], ['attach', 'remote', created.id])
  await h.service.enroll(remote, 'codex')
  assert.equal(h.repos.length, 2)
  assert.equal(h.repos[1].kind, 'checkout')
  assert.equal(h.repos[1].remote_key, 'github.com/passioncode-ai/shared')
  assert.equal(h.events.filter((e) => e.type === 'project.created@1').length, 1, 'a clone never makes a sibling project')
  assert.equal(h.events.length, initialEvents + 1)

  const detachedRoot = repository('worktree-source')
  const worktree = path.join(root, 'worktree-checkout')
  git('-C', detachedRoot, 'worktree', 'add', '-q', '--detach', worktree)
  const proposed = await resolve(h, worktree)
  assert.deepEqual([proposed.candidate, proposed.root], ['create', realpathSync.native(detachedRoot)])
  await h.service.enroll(proposed, 'claude-code')
  const after = await resolve(h, worktree)
  assert.deepEqual([after.how, after.candidate], ['worktree', undefined])
})

test('manual detach wins over automation until the operator explicitly reattaches', async () => {
  const h = harness()
  const repo = repository('removable', 'git@github.com:passioncode-ai/removable.git')
  const proposed = await resolve(h, repo)
  const project = await h.service.enroll(proposed, 'kimi-code')
  const repoId = h.repos[0].id
  await h.service.detach(project.id, repoId, OPERATOR)
  assert.equal(h.repos.length, 0)
  assert.equal(h.removals.length, 1)

  const refused = await resolve(h, repo)
  assert.deepEqual([refused.ok, refused.code], [false, 'no-project'])
  assert.match(refused.message, /detached/)
  const before = h.events.length
  await assert.rejects(h.service.enroll(proposed, 'kimi-code'), /detached/)
  assert.equal(h.events.length, before, 'automation cannot undo the detach')

  await h.service.attach(project.id, [repo], OPERATOR, h.reach)
  assert.equal(h.removals.length, 0, 'an explicit operator attach clears the tombstone')
  assert.equal((await resolve(h, repo)).how, 'exact')
})

test('a plain folder becomes its own project; broad folders and archived projects are refused without journal writes', async () => {
  const h = harness()
  const plain = path.join(root, 'plain-parent', 'plain')
  mkdirSync(plain, { recursive: true })
  const proposedPlain = await resolve(h, plain)
  assert.equal(proposedPlain.ok, true, JSON.stringify(proposedPlain))
  assert.equal(proposedPlain.candidate, 'create')
  const plainProject = await h.service.enroll(proposedPlain, 'kimi-code')
  assert.equal(plainProject.name, 'plain')

  const broadHome = path.join(root, 'broad-home')
  mkdirSync(path.join(broadHome, '.git'), { recursive: true })
  const broad = harness(broadHome)
  const refused = await resolve(broad, broadHome)
  assert.deepEqual([refused.ok, refused.code], [false, 'no-project'])
  assert.equal(broad.events.length, 0)

  const archived = harness()
  const repo = repository('archived')
  const proposed = await resolve(archived, repo)
  const project = await archived.service.enroll(proposed, 'kimi-code')
  archived.projects.get(project.id).status = 'archived'
  archived.repos.splice(0)
  const before = archived.events.length
  await assert.rejects(archived.service.enroll(proposed, 'kimi-code'), /archived/)
  assert.equal(archived.events.length, before)
})

test('ADR-0166: an agent started in a subfolder attributes the repository at its Git top level', async () => {
  const h = harness()
  const repo = repository('deep-unknown', 'git@github.com:passioncode-ai/deep-unknown.git')
  const realRepo = realpathSync.native(repo)
  const sub = path.join(repo, 'src', 'deep')
  mkdirSync(sub, { recursive: true })
  const proposed = await resolve(h, sub)
  assert.equal(proposed.ok, true, JSON.stringify(proposed))
  assert.deepEqual([proposed.candidate, proposed.root, proposed.projectId, proposed.projectName],
    ['create', realRepo, folderProjectId(ESTATE, realRepo), 'deep-unknown'])
  await h.service.enroll(proposed, 'claude-code')
  assert.deepEqual(h.repos.map((r) => r.path), [realRepo], 'the repository is attached, never the subfolder')
  assert.equal((await resolve(h, sub)).how, 'ancestor')

  const known = repository('deep-known', 'git@github.com:passioncode-ai/deep-shared.git')
  const project = await h.service.create({ id: uuid(), name: 'deep-shared', repoPaths: [known] }, OPERATOR, h.reach)
  const clone = repository('deep-clone', 'https://github.com/passioncode-ai/deep-shared.git')
  const cloneSub = path.join(clone, 'pkg')
  mkdirSync(cloneSub, { recursive: true })
  const attach = await resolve(h, cloneSub)
  assert.deepEqual([attach.candidate, attach.how, attach.projectId], ['attach', 'remote', project.id])
  await h.service.enroll(attach, 'codex')
  assert.ok(h.repos.some((r) => r.project_id === project.id && r.path === realpathSync.native(clone)), 'the clone is attached at its top level')
  assert.ok(!h.repos.some((r) => r.path === realpathSync.native(cloneSub)), 'never at the subfolder')
})

test('ADR-0166: a detach keeps automation off that folder only, not off every clone of its remote', async () => {
  const h = harness()
  const first = repository('scoped-first', 'git@github.com:passioncode-ai/scoped.git')
  const second = repository('scoped-second', 'https://github.com/passioncode-ai/scoped.git')
  const project = await h.service.create({ id: uuid(), name: 'scoped', repoPaths: [first, second] }, OPERATOR, h.reach)
  const secondRow = h.repos.find((r) => r.path === realpathSync.native(second))
  await h.service.detach(project.id, secondRow.id, OPERATOR)

  const refused = await resolve(h, second)
  assert.deepEqual([refused.ok, refused.code], [false, 'no-project'], 'the detached folder stays out')
  const third = repository('scoped-third', 'git@github.com:passioncode-ai/scoped.git')
  const proposed = await resolve(h, third)
  assert.deepEqual([proposed.ok, proposed.candidate, proposed.projectId], [true, 'attach', project.id], JSON.stringify(proposed))
  await h.service.enroll(proposed, 'claude-code')
  assert.ok(h.repos.some((r) => r.path === realpathSync.native(third)))
})
