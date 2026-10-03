// The new project's folder (ADR-0100 §4, SCN-129), driven against the real filesystem and real git.
// Iteration 1 found: a failed `git init` left the folder behind and every retry answered "exists";
// the call blocked the main process; the name rule accepted right-to-left overrides and threw on a
// non-string. Each case below is one of those, watched failing first.
import { existsSync, mkdtempSync, readdirSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const { createProjectFolder } = await import(path.resolve(import.meta.dirname, '../src/main/projectFolder.ts'))
const { folderNameProblem } = await import(path.resolve(import.meta.dirname, '../src/shared/startPaths.ts'))

const parent = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-newfolder-')))
const inParent = (p) => { const r = path.resolve(p); if (r !== parent) throw new Error('outside'); return r }

// made, as a git repository
const ok = await createProjectFolder({ parent, name: 'alpha', git: true }, inParent)
assert.equal(ok.ok, true)
assert.ok(existsSync(path.join(parent, 'alpha', '.git')), 'git init ran')

// exists, invalid, outside
assert.deepEqual((await createProjectFolder({ parent, name: 'alpha', git: false }, inParent)).reason, 'exists')
assert.equal((await createProjectFolder({ parent, name: '../up', git: false }, inParent)).reason, 'invalid-name')
assert.equal((await createProjectFolder({ parent: '/', name: 'x', git: false }, inParent)).reason, 'outside')

// a failed git init leaves NOTHING behind, so the retry can succeed
const failed = await createProjectFolder({ parent, name: 'beta', git: true }, inParent, { gitBinary: path.join(parent, 'no-such-git') })
assert.equal(failed.ok, false)
assert.equal(failed.reason, 'failed')
assert.equal(existsSync(path.join(parent, 'beta')), false, 'the half-made folder is removed')
const retried = await createProjectFolder({ parent, name: 'beta', git: true }, inParent)
assert.equal(retried.ok, true, 'the retry is not refused as "exists"')

// it does not block: the call returns a promise and the event loop keeps turning while git runs
let ticks = 0; const t = setInterval(() => ticks++, 1)
await createProjectFolder({ parent, name: 'gamma', git: true }, inParent)
clearInterval(t)
assert.ok(ticks > 0, 'the event loop ran while the folder was being made')

// the name rule
for (const bad of ['', '  ', '.hidden', 'a/b', 'a\\b', 'a:b', 'x'.repeat(81), 'evil‮txt.exe', 'a⁦b', 'a\u0007b']) assert.ok(folderNameProblem(bad), JSON.stringify(bad))
for (const bad of [42, null, undefined, {}]) assert.ok(folderNameProblem(bad), String(bad))
assert.equal(folderNameProblem('billing-service'), null)
assert.deepEqual(readdirSync(parent).sort(), ['alpha', 'beta', 'gamma'])
console.log('PASS project folder: made with git, exists/invalid/outside refused, failed git leaves nothing, non-blocking, name rule')

// ── the window's choices (iteration 1 → 2): a parent folder is remembered per window and forgotten with
// it; only an unpackaged run answers the picker from FABRIC_WALK_PICK.
const { ParentChoices, walkPickFor } = await import(path.resolve(import.meta.dirname, '../src/main/startChoices.ts'))
{
  const choices = new ParentChoices()
  const outside = () => { throw new Error('outside every root') }
  assert.equal(choices.record('win:1', parent), parent, 'a chosen parent is recorded by its real path')
  assert.equal(choices.resolve('win:1', parent, outside), parent, 'the window that chose it may create in it')
  assert.throws(() => choices.resolve('win:2', parent, outside), /outside every root/, 'another window falls through to its own roots')
  assert.throws(() => choices.resolve('win:1', path.join(parent, 'nope-missing'), outside), /outside every folder/, 'a path that does not exist is refused, not created')
  assert.equal(choices.record('win:1', path.join(parent, 'vanished')), null, 'a folder that vanished after the picker is not recorded')
  choices.revoke('win:1')
  assert.throws(() => choices.resolve('win:1', parent, outside), /outside every root/, 'a closed window keeps no parent')
}
{
  const env = { FABRIC_WALK_PICK: ['/a', '/b', '/c'].join(path.delimiter) }
  assert.equal(walkPickFor('project', env, false), '/a')
  assert.equal(walkPickFor('scan', env, false), '/b')
  assert.equal(walkPickFor('parent', env, false), '/c')
  assert.equal(walkPickFor('scan', env, true), null, 'a packaged app never answers the picker by itself')
  assert.equal(walkPickFor('scan', {}, false), null)
  assert.equal(walkPickFor('parent', { FABRIC_WALK_PICK: '/only' }, false), '/only', 'one folder answers every purpose')
}
console.log('PASS start choices: parent per window, revoked on close; walk pick only unpackaged')

// ── "already in a project" (iteration 1 errors #11, data #12): matched by real path, every holder named once
const { indexImported } = await import(path.resolve(import.meta.dirname, '../src/main/startChoices.ts'))
{
  const { symlinkSync, mkdirSync } = await import('node:fs')
  const real = path.join(parent, 'held')
  mkdirSync(real)
  const link = path.join(parent, 'held-link')
  symlinkSync(real, link)
  const index = indexImported(
    [{ path: link, project_id: 'p1' }, { path: real + '/', project_id: 'p1' }, { path: real, project_id: 'p2' }, { path: path.join(parent, 'gone'), project_id: 'p3' }],
    [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }]
  )
  assert.deepEqual(index.get(real), [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }], 'a symlink and a trailing slash are the same folder; one project is named once')
  assert.deepEqual(index.get(path.join(parent, 'gone')), [{ id: 'p3', name: 'p3' }], 'a removed folder still names its project, by id when the name is unknown')
}
console.log('PASS imported index: real paths, each holder once')
