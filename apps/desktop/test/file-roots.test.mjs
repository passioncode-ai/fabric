// The filesystem boundary (SEC-REQ-016).
//
// Before this, `files.read` / `files.write` / `files.list` took any absolute
// path and served it. Every window held, through the typed bridge, a read and
// write primitive over the operator's entire home directory. Nothing in the
// product needs that: the editor is opened from a repository tree.
//
// Four things must hold, and the last two are where naive implementations of
// this fail:
//
//   1. inside an open root: allowed
//   2. outside every root: refused, and the refusal names the boundary
//   3. `..` traversal out of a root: refused
//   4. a SYMLINK inside a root pointing outside it: refused — and a sibling
//      directory whose name merely starts with the root's name is NOT inside it
//      ('/repo-backup' begins with '/repo' and is a different folder)

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { FileRoots, OutsideRoots, listDirectory, readFile, resolveForOpen, writeFile } from ${JSON.stringify(path.join(HERE, '../src/main/files.ts'))}
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const base = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'fabric-roots-')))
const repo = path.join(base, 'repo');          mkdirSync(repo)
const decoy = path.join(base, 'repo-backup');  mkdirSync(decoy)
const secrets = path.join(base, 'secrets');    mkdirSync(secrets)
writeFileSync(path.join(repo, 'src.ts'), 'export const a = 1\\n')
writeFileSync(path.join(decoy, 'src.ts'), 'not the same folder\\n')
writeFileSync(path.join(secrets, 'id_rsa'), 'PRIVATE KEY\\n')
symlinkSync(path.join(secrets, 'id_rsa'), path.join(repo, 'link-out'))

const roots = new FileRoots()
roots.reset([repo])

const refuses = (label, fn) => {
  try {
    fn()
    fail(label + ' — it was ALLOWED')
  } catch (e) {
    if (e instanceof OutsideRoots) ok(label)
    else fail(label + ' — refused, but with ' + e.name + ': ' + e.message)
  }
}

// 1 — inside
try {
  const f = readFile(path.join(repo, 'src.ts'), roots)
  if (f.content.includes('export const a')) ok('a file inside an open repository reads normally')
  else fail('the file read back wrong')
  const listed = listDirectory(repo, roots)
  if (listed.entries.length >= 2) ok('the repository itself lists')
  else fail('listing the root returned ' + listed.entries.length + ' entries')
} catch (e) {
  fail('a file inside the root was refused: ' + e.message)
}

// 2 — outside
refuses('an absolute path outside every root is refused', () => readFile(path.join(secrets, 'id_rsa'), roots))
refuses('/etc/passwd is refused', () => readFile('/etc/passwd', roots))
refuses('listing a directory outside every root is refused', () => listDirectory(secrets, roots))
refuses('writing outside every root is refused', () =>
  writeFile(path.join(secrets, 'planted'), 'x', 'nohash', roots, true))

// 3 — traversal
refuses('..-traversal out of a root is refused', () =>
  readFile(path.join(repo, '..', 'secrets', 'id_rsa'), roots))

// 4 — the two that catch a naive check
refuses('a symlink inside the root pointing outside it is refused', () =>
  readFile(path.join(repo, 'link-out'), roots))
refuses('a sibling whose NAME starts with the root name is not inside it', () =>
  readFile(path.join(decoy, 'src.ts'), roots))

// and a new file in an open repository still works — the guard must not make
// the editor unable to create anything.
try {
  writeFile(path.join(repo, 'new.md'), '# new\\n', 'unused', roots, true)
  if (readFileSync(path.join(repo, 'new.md'), 'utf8') === '# new\\n')
    ok('a file that does not exist yet can still be created inside a root')
  else fail('the new file has the wrong content')
} catch (e) {
  fail('creating a file inside an open root was refused: ' + e.message)
}

// The boundary moves when the operator opens something — FOR THE WINDOW THAT
// OPENED IT (S02.roots). It used to move for everything at once.
roots.allow(secrets, 'win:0')
try {
  readFile(path.join(secrets, 'id_rsa'), roots, 'win:0')
  ok('a folder the operator explicitly opens becomes reachable to that window')
} catch {
  fail('an explicitly opened folder is still refused')
}

// ————————————————————————————————————————————————— S02.roots: a grant is not global
//
// MEASURED BEFORE THE SPLIT: a folder chosen in the native dialog went into the
// ONE shared set, so it stayed reachable from every other window and every agent
// session for the life of the process — and outlived the window that asked for
// it. A choice made in one place is not a decision about everywhere.
{
  const chosen = mkdtempSync(path.join(tmpdir(), 'fabric-chosen-'))
  writeFileSync(path.join(chosen, 'note.md'), 'operator picked this')

  const roots = new FileRoots()
  roots.reset([repo])
  roots.allow(chosen, 'win:1')

  try {
    roots.resolve(path.join(chosen, 'note.md'), 'win:1')
    ok('the window that chose the folder can reach it')
  } catch (e) {
    fail('the chooser cannot reach its own grant: ' + String(e))
  }

  try {
    roots.resolve(path.join(chosen, 'note.md'), 'win:2')
    fail('ANOTHER window reached a folder it never chose')
  } catch {
    ok('and another window cannot — a grant belongs to the window that made it')
  }

  try {
    roots.resolve(path.join(chosen, 'note.md'))
    fail('an unscoped caller reached a scoped grant')
  } catch {
    ok('and an unscoped caller — an agent session — reaches only the repositories')
  }

  // The repositories stay reachable from anywhere: they are the estate's own
  // working set, not one window's choice.
  try {
    roots.resolve(path.join(repo, 'src.ts'), 'win:2')
    ok('while the estate repositories are reachable from any window')
  } catch (e) {
    fail('a repository became unreachable: ' + String(e))
  }

  // And the grant dies with the window.
  roots.revoke('win:1')
  try {
    roots.resolve(path.join(chosen, 'note.md'), 'win:1')
    fail('a grant survived the window that owned it')
  } catch {
    ok('and it dies with the window, rather than outliving it for the session')
  }

  // An unscoped grant is refused rather than defaulted to everywhere — that
  // default IS the defect.
  try {
    roots.allow(chosen, '')
    fail('an unscoped grant was accepted')
  } catch {
    ok('an unscoped grant is refused, not treated as a grant to everything')
  }
}

// ── AND THE ONE THAT HANDS A PATH TO THE OPERATING SYSTEM (AX-15) ─────────
//
// files.read, files.write and files.list were bounded by SEC-REQ-016.
// files.openExternally was not: it passed the renderer's string straight to
// shell.openPath, which asks the OS to OPEN the file with whatever handler is
// registered for it. That is strictly worse than reading it — the module's own
// header names the example, and this is the door that runs it rather than
// showing it.
//
// A doctrine applied to three of four callers is a habit with a gap, and the
// gap here was the widest one.
{
  const inside = path.join(repo, 'src.ts')
  const outside = path.join(secrets, 'id_rsa')
  writeFileSync(outside, 'PRIVATE KEY' + String.fromCharCode(10))

  const good = resolveForOpen(inside, roots)
  good.ok && good.path === realpathSync(inside)
    ? ok('a file inside an open root resolves for opening, and to its REAL path')
    : fail('an ordinary file could not be opened: ' + JSON.stringify(good))

  const bad = resolveForOpen(outside, roots)
  bad.ok === false
    ? ok('a file outside every open root is REFUSED before the operating system is asked')
    : fail('an arbitrary file was handed to the OS: ' + JSON.stringify(bad))
  bad.ok === false && /outside every folder/.test(bad.reason)
    ? ok('and the refusal names the boundary rather than blaming the file')
    : fail('the refusal explains nothing: ' + JSON.stringify(bad))

  const climbed = resolveForOpen(path.join(repo, '..', 'secrets', 'id_rsa'), roots)
  climbed.ok === false
    ? ok('and a path that climbs out of a root with .. is refused too')
    : fail('.. traversal reached the OS')

  const linked = path.join(repo, 'link-to-secret')
  symlinkSync(outside, linked)
  const followed = resolveForOpen(linked, roots)
  followed.ok === false
    ? ok('and a symlink inside a root pointing outside it is refused, because resolve walks it first')
    : fail('a symlink carried the OS outside the roots')
}

// 5 — an attached repository that later became a LINK, and a root too broad to be a repository
// (confirmation pass after iteration 3: a repo swapped for a link to / made the roots ['/'] on refresh).
{
  const { rmSync } = await import('node:fs')
  const victim = path.join(base, 'victim'); mkdirSync(victim)
  const swapped = new FileRoots()
  swapped.reset([victim])
  rmSync(victim, { recursive: true }); symlinkSync('/', victim)
  swapped.reset([victim])
  swapped.list().includes(path.parse(realpathSync(victim)).root) || swapped.list().includes('/')
    ? fail('a repository swapped for a link to / became a root')
    : ok('a repository that became a link is not a root after a refresh')
  const broad = new FileRoots()
  broad.reset(['/', path.dirname(realpathSync(process.env.HOME))])
  broad.list().length === 0 ? ok('the filesystem root and the folder holding the home folder are never roots') : fail('a too-broad root was kept: ' + broad.list().join(', '))
}

// 6 — a PARENT folder swapped for a link after attach, and a stored path that is not its own canonical
// spelling (re-verification after the confirmation pass: lstat checked only the last component, and JS
// realpath keeps a path's letter case, so '/USERS' and firmlinked spellings slipped past isTooBroad).
{
  const { rmSync, renameSync } = await import('node:fs')
  const parentDir = path.join(realpathSync.native(base), 'parent'); mkdirSync(parentDir)
  const child = path.join(parentDir, 'child'); mkdirSync(child)
  const elsewhere = path.join(realpathSync.native(base), 'elsewhere'); mkdirSync(path.join(elsewhere, 'child'), { recursive: true })
  writeFileSync(path.join(elsewhere, 'child', 'secret.txt'), 'not chosen')
  const r = new FileRoots()
  r.reset([child])
  r.list().includes(child) ? ok('a canonical attached repository is a root') : fail('a canonical repository was refused: ' + r.list().join(', '))
  renameSync(parentDir, parentDir + '-moved'); symlinkSync(elsewhere, parentDir)
  r.reset([child])
  r.list().length === 0 ? ok('a repository whose parent became a link grants nothing') : fail('a swapped parent made a root: ' + r.list().join(', '))
  const upper = new FileRoots()
  upper.reset([child.toUpperCase(), '/USERS', '/System/Volumes/Data/Users'])
  upper.list().length === 0 ? ok('a stored path in another spelling (case, firmlink) grants nothing') : fail('a non-canonical spelling became a root: ' + upper.list().join(', '))
}

if (failures > 0) {
  console.error('\\n' + failures + ' check(s) FAILED — the filesystem boundary does not hold')
  process.exit(1)
}
console.log('\\nall green: the filesystem API reaches what the operator opened, and nothing else')
`

console.log('file roots: the filesystem API reaches only what is open')
try {
  execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    stdio: 'inherit',
    cwd: path.join(HERE, '..')
  })
} catch {
  process.exit(1)
}
