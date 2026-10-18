// A folder no project holds is attributed by Fabric itself (ADR-0164, CO-328): attached to the one project it belongs
// to by its git remote, by its owner, or as a sibling of the asking agent's project — or made a new project — and the
// act is journalled as the asking agent's, with its cause. A folder too broad, outside every repository or around other
// projects' folders is refused with the reason, never handed to the person. Pure: the git probes are injected, except
// where the default probe itself is the subject.
import path from 'node:path'
import { mkdtempSync, realpathSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import test from 'node:test'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { decideAttribution, gitTopLevel } = await import(path.join(SRC, 'folderResolver.ts'))
const { createFolderAttribution } = await import(path.join(SRC, 'folderAttribution.ts'))

const HOME = '/Users/me'
const rows = [
  { projectId: 'p-fabric', path: '/Users/me/DATA/fabric' },
  { projectId: 'p-esim', path: '/Users/me/DATA/esim/android' },
  { projectId: 'p-esim', path: '/Users/me/DATA/esim/ios' },
  { projectId: 'p-site', path: '/Users/me/DATA/site' }
]
const ORIGINS = {
  '/Users/me/DATA/fabric': 'git@github.com:PassionCode-AI/Fabric.git',
  '/Users/me/DATA/esim/android': 'https://github.com/appvillis/esim-android',
  '/Users/me/DATA/esim/ios': 'https://github.com/appvillis/esim-ios.git',
  '/Users/me/DATA/site': 'https://github.com/ssheleg/site'
}

/** Probes over a pretend disk: `repos` maps a repository root to its origin (null: no origin); a folder inside one of
 *  them has that root as its top level. `worktrees` maps a worktree to the `.git` of its main checkout. */
function probes({ repos = {}, worktrees = {} } = {}) {
  const all = { ...ORIGINS, ...repos }
  const rootOf = (f) => Object.keys(all).concat(Object.keys(worktrees)).filter((r) => f === r || f.startsWith(r + '/')).sort((a, b) => b.length - a.length)[0] ?? null
  return {
    topLevel: async (f) => rootOf(f),
    commonDir: async (f) => {
      const r = rootOf(f)
      if (!r) return null
      return worktrees[r] ?? `${r}/.git`
    },
    origin: async (p) => (Object.hasOwn(all, p) ? all[p] : null),
    tooBroad: (p) => p === '/' || p === HOME || HOME.startsWith(p + '/')
  }
}

test('a second clone of a project\'s repository joins that project: same remote, scp and https folded together', async () => {
  const d = await decideAttribution('/Users/me/clones/fabric/src', rows, [], probes({ repos: { '/Users/me/clones/fabric': 'https://github.com/passioncode-ai/fabric' } }))
  assert.deepEqual(d, { act: 'attach', projectId: 'p-fabric', root: '/Users/me/clones/fabric', cause: 'same-remote', remoteKey: 'github.com/passioncode-ai/fabric' })
})

test('a new repository of an owner exactly one project holds joins that project: owner', async () => {
  const d = await decideAttribution('/Users/me/DATA/esim-web', rows, [], probes({ repos: { '/Users/me/DATA/esim-web': 'git@github.com:appvillis/esim-web.git' } }))
  assert.deepEqual([d.act, d.projectId, d.cause, d.root], ['attach', 'p-esim', 'owner', '/Users/me/DATA/esim-web'])
})

test('an owner two projects hold is a tie: a new project, never a guess between them', async () => {
  const two = [...rows, { projectId: 'p-blog', path: '/Users/me/DATA/blog' }]
  const d = await decideAttribution('/Users/me/DATA/notes', two, [], probes({ repos: { '/Users/me/DATA/blog': 'https://github.com/ssheleg/blog', '/Users/me/DATA/notes': 'https://github.com/ssheleg/notes' } }))
  assert.deepEqual([d.act, d.cause, d.root, d.name], ['create', 'new-project', '/Users/me/DATA/notes', 'notes'])
})

test('the asking agent\'s project wins an owner tie: a new folder of the project its agent works in', async () => {
  const two = [...rows, { projectId: 'p-blog', path: '/Users/me/DATA/blog' }]
  const p = probes({ repos: { '/Users/me/DATA/blog': 'https://github.com/ssheleg/blog', '/Users/me/DATA/notes': 'https://github.com/ssheleg/notes' } })
  const d = await decideAttribution('/Users/me/DATA/notes', two, ['p-blog'], p)
  assert.deepEqual([d.act, d.projectId, d.cause], ['attach', 'p-blog', 'owner'])
})

test('a sibling folder of a project whose parent holds only that project\'s folders joins it, when that project\'s agent asks', async () => {
  const p = probes({ repos: { '/Users/me/DATA/esim/admin': null } })
  const asked = await decideAttribution('/Users/me/DATA/esim/admin', rows, ['p-esim'], p)
  assert.deepEqual([asked.act, asked.projectId, asked.cause], ['attach', 'p-esim', 'sibling'])
  // Another project's agent, or the door with no project: the parent alone does not attribute — a new project.
  assert.equal((await decideAttribution('/Users/me/DATA/esim/admin', rows, ['p-site'], p)).act, 'create')
  assert.equal((await decideAttribution('/Users/me/DATA/esim/admin', rows, [], p)).act, 'create')
})

test('a parent shared by several projects\' folders singles out none of them: no sibling match', async () => {
  const d = await decideAttribution('/Users/me/DATA/tool', rows, ['p-fabric'], probes({ repos: { '/Users/me/DATA/tool': null } }))
  assert.deepEqual([d.act, d.cause, d.name], ['create', 'new-project', 'tool'])
})

test('an archived project takes no folder: its owner match does not count, its folders still do for containment', async () => {
  const p = probes({ repos: { '/Users/me/DATA/esim-web': 'git@github.com:appvillis/esim-web.git', '/Users/me/DATA/esim': null } })
  const d = await decideAttribution('/Users/me/DATA/esim-web', rows, [], p, (id) => id !== 'p-esim')
  assert.deepEqual([d.act, d.cause], ['create', 'new-project'])
  const around = await decideAttribution('/Users/me/DATA/esim', rows, [], p, (id) => id !== 'p-esim')
  assert.deepEqual([around.act, around.reason], ['refuse', 'contains-projects'])
})

test('a repository that matches nothing becomes a new project named after its folder, rooted at its top level', async () => {
  const d = await decideAttribution('/Users/me/DATA/fresh/src/lib', rows, [], probes({ repos: { '/Users/me/DATA/fresh': 'https://gitlab.com/someone/fresh' } }))
  assert.deepEqual(d, { act: 'create', root: '/Users/me/DATA/fresh', name: 'fresh', cause: 'new-project', remoteKey: 'gitlab.com/someone/fresh' })
})

test('a worktree of a repository no project holds roots the new project at its main checkout', async () => {
  const p = probes({ repos: { '/Users/me/DATA/fresh': null }, worktrees: { '/tmp/wt/fresh-1': '/Users/me/DATA/fresh/.git' } })
  const d = await decideAttribution('/tmp/wt/fresh-1', rows, [], p)
  assert.deepEqual([d.act, d.root, d.name], ['create', '/Users/me/DATA/fresh', 'fresh'])
})

test('refusals say why, and none of them is a step for the person', async () => {
  const p = probes({ repos: { [HOME]: 'https://github.com/me/dotfiles', '/Users/me/DATA': null } })
  for (const [folder, reason] of [
    ['/', 'too-broad'],
    [HOME, 'too-broad'],
    // A folder inside a dotfiles repository whose top level is the home folder: still too broad.
    ['/Users/me/Documents/x', 'too-broad'],
    // ~/DATA holds other projects' folders: never a project around them.
    ['/Users/me/DATA', 'contains-projects']
  ]) {
    const d = await decideAttribution(folder, rows, [], p)
    assert.deepEqual([d.act, d.reason], ['refuse', reason], folder)
    assert.doesNotMatch(d.message, /person|operator|\+ Project/)
  }
  const plain = await decideAttribution('/Users/me/scratch', rows, [], probes())
  assert.deepEqual([plain.act, plain.reason], ['refuse', 'not-a-repository'])
  assert.match(plain.message, /git init/)
})

test('the default top-level probe is asynchronous, answers a repository\'s root and null outside one, never rejects', async () => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-attr-')))
  execFileSync('git', ['init', '-q', repo])
  mkdirSync(path.join(repo, 'deep/er'), { recursive: true })
  const answer = gitTopLevel(path.join(repo, 'deep/er'))
  assert.ok(answer instanceof Promise)
  assert.equal(await answer, repo)
  assert.equal(await gitTopLevel(realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-nogit-')))), null)
  assert.equal(await gitTopLevel('/no/such/folder/anywhere'), null)
})

// ── the act ─────────────────────────────────────────────────────────────────────────────────────────────────────

function act(over = {}) {
  const journaled = []
  let n = 0
  let held = [...rows]
  const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const changed = []
  const attribution = createFolderAttribution({
    admittedFolders: async () => held,
    probes: probes(over.probes),
    newId: ids,
    journal: async (e) => {
      journaled.push(e)
      if (e.type === 'project.repo.attached@1') held = [...held, { projectId: e.projectId, path: e.payload.path }]
      if (over.failOn === e.type) throw new Error('journal refused')
    },
    changed: async () => { changed.push(1) },
    ...over.deps
  })
  return { attribution, journaled, changed }
}

const CLAUDE = { runner: 'claude-code', via: 'binding', bindingId: 'b-1', runtimeSessionId: 'rt-9', projects: ['p-esim'] }

test('an attach is the agent\'s act: project.repo.attached with the agent as actor, the cause and the session', async () => {
  const h = act({ probes: { repos: { '/Users/me/DATA/esim/admin': null } } })
  const r = await h.attribution('/Users/me/DATA/esim/admin', CLAUDE)
  assert.deepEqual(r, { ok: true, projectId: 'p-esim', root: '/Users/me/DATA/esim/admin', cause: 'sibling', created: false })
  assert.equal(h.journaled.length, 1)
  const [e] = h.journaled
  assert.equal(e.type, 'project.repo.attached@1')
  assert.deepEqual(e.actor, { kind: 'agent', id: 'claude-code' })
  assert.equal(e.projectId, 'p-esim')
  assert.deepEqual(e.payload.attributed, { cause: 'sibling', runner: 'claude-code', via: 'binding', binding_id: 'b-1', runtime_session_id: 'rt-9', remote_key: null })
  assert.deepEqual([e.payload.path, e.payload.label], ['/Users/me/DATA/esim/admin', 'admin'])
  assert.equal(h.changed.length, 1, 'the file roots and the mirror are told')
})

test('a new project: project.created then its folder attached as primary, both the agent\'s acts', async () => {
  const h = act({ probes: { repos: { '/Users/me/DATA/fresh': 'https://gitlab.com/someone/fresh' } } })
  const door = { runner: 'codex', via: 'door', bindingId: null, runtimeSessionId: null, projects: [] }
  const r = await h.attribution('/Users/me/DATA/fresh', door)
  assert.equal(r.ok, true)
  assert.equal(r.created, true)
  assert.equal(r.cause, 'new-project')
  assert.deepEqual(h.journaled.map((e) => e.type), ['project.created@1', 'project.repo.attached@1'])
  const [made, attached] = h.journaled
  assert.equal(made.payload.id, r.projectId)
  assert.equal(made.projectId, r.projectId)
  assert.equal(made.payload.name, 'fresh')
  assert.equal(made.payload.default_agent, 'codex')
  assert.deepEqual(made.actor, { kind: 'agent', id: 'codex' })
  assert.equal(attached.projectId, r.projectId)
  assert.equal(attached.payload.is_primary, true)
  assert.equal(attached.payload.attributed.via, 'door')
  assert.equal(attached.payload.attributed.cause, 'new-project')
})

test('an agent that names no runner is still the actor, as a coding agent', async () => {
  const h = act({ probes: { repos: { '/Users/me/DATA/fresh': null } } })
  await h.attribution('/Users/me/DATA/fresh', { runner: null, via: 'door', bindingId: null, runtimeSessionId: null, projects: [] })
  assert.deepEqual(h.journaled[0].actor, { kind: 'agent', id: 'coding-agent' })
  assert.equal(h.journaled[0].payload.default_agent, undefined, 'no runner: the project keeps Fabric\'s default agent')
})

test('two agents in one new folder at once make one project, not two: the act is serialized and resolves again', async () => {
  const h = act({ probes: { repos: { '/Users/me/DATA/fresh': null } } })
  const door = { runner: 'codex', via: 'door', bindingId: null, runtimeSessionId: null, projects: [] }
  const [a, b] = await Promise.all([h.attribution('/Users/me/DATA/fresh', door), h.attribution('/Users/me/DATA/fresh/src', door)])
  assert.equal(h.journaled.filter((e) => e.type === 'project.created@1').length, 1)
  assert.equal(a.projectId, b.projectId)
  assert.deepEqual([b.created, b.cause], [false, 'already'])
})

test('a refusal journals nothing', async () => {
  const h = act()
  const r = await h.attribution('/Users/me/scratch', CLAUDE)
  assert.deepEqual([r.ok, r.reason], [false, 'not-a-repository'])
  assert.equal(h.journaled.length, 0)
  assert.equal(h.changed.length, 0)
})

test('a journal that refuses the attach is thrown, and the next attribution is not blocked by it', async () => {
  const h = act({ probes: { repos: { '/Users/me/DATA/esim/admin': null } }, failOn: 'project.repo.attached@1' })
  await assert.rejects(() => h.attribution('/Users/me/DATA/esim/admin', CLAUDE), /journal refused/)
  const again = await h.attribution('/Users/me/scratch', CLAUDE)
  assert.equal(again.ok, false)
})
