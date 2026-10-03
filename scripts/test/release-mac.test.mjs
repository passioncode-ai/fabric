// The inputs `scripts/release-mac.mjs` takes from CI (and from a person debugging locally): which
// signing identity, which tag, which commit, and what the signature on the artifact says. Pure
// functions over strings, except the commit rule, which runs against real git repositories made here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { builderConfig, builderIdentity, parseReleaseArgs, releaseCommitProblem, signatureOf, tagProblem } from '../lib/release-mac.mjs'

// Fake identities only: a team id is ten upper-case characters, and none of these is a real one.
const ID = 'Developer ID Application: Example Org (ABCDE12345)'

test('the identity comes from --identity, --identity=, or FABRIC_SIGN_IDENTITY; never from a default', () => {
  assert.equal(parseReleaseArgs(['--identity', ID], {}).identity, ID)
  assert.equal(parseReleaseArgs([`--identity=${ID}`], {}).identity, ID)
  assert.equal(parseReleaseArgs([], { FABRIC_SIGN_IDENTITY: ID }).identity, ID)
  assert.equal(parseReleaseArgs(['--identity', 'ABCDE12345'], { FABRIC_SIGN_IDENTITY: ID }).identity, 'ABCDE12345', 'the argument wins over the environment')
  assert.equal(parseReleaseArgs([], {}).identity, null)
  assert.equal(parseReleaseArgs([], { FABRIC_SIGN_IDENTITY: '  ' }).identity, null, 'blank is absent')
})

test('the flags: --check-only and --tag; an unknown flag or a flag without its value refuses', () => {
  const a = parseReleaseArgs(['--check-only', '--tag', 'v1.2.3'], {})
  assert.equal(a.checkOnly, true)
  assert.equal(a.tag, 'v1.2.3')
  assert.equal(parseReleaseArgs([], {}).checkOnly, false)
  assert.throws(() => parseReleaseArgs(['--notarize-later'], {}), /unknown argument --notarize-later/)
  assert.throws(() => parseReleaseArgs(['--identity'], {}), /--identity needs a value/)
  assert.throws(() => parseReleaseArgs(['--tag', '--check-only'], {}), /--tag needs a value/)
})

test('electron-builder is given the name without its certificate-type prefix, which it refuses', () => {
  assert.equal(builderIdentity(ID), 'Example Org (ABCDE12345)')
  assert.equal(builderIdentity('ABCDE12345'), 'ABCDE12345', 'a team id alone is matched as a substring')
  assert.equal(builderIdentity('  Example Org (ABCDE12345) '), 'Example Org (ABCDE12345)')
})

test('a certificate that cannot sign a Developer ID download refuses, and so does an empty name', () => {
  for (const wrong of ['Apple Distribution: Example Org (ABCDE12345)', '3rd Party Mac Developer Application: Example Org (ABCDE12345)',
    'Developer ID Installer: Example Org (ABCDE12345)', 'Apple Development: someone (ABCDE12345)'])
    assert.throws(() => builderIdentity(wrong), /not a Developer ID Application identity/, wrong)
  assert.throws(() => builderIdentity(''), /no signing identity/)
  assert.throws(() => builderIdentity(null), /no signing identity/)
})

test('the tag names the version the commit carries, or a rehearsal of it; no tag is a local debug build', () => {
  assert.equal(tagProblem({ tag: 'v0.3.0', version: '0.3.0' }), null)
  assert.equal(tagProblem({ tag: 'v0.3.0-rc.2', version: '0.3.0' }), null)
  assert.equal(tagProblem({ tag: null, version: '0.3.0' }), null)
  assert.match(tagProblem({ tag: 'v0.2.0', version: '0.3.0' }), /tag v0\.2\.0 does not name version 0\.3\.0/)
  assert.match(tagProblem({ tag: 'main', version: '0.3.0' }), /tag main does not name version 0\.3\.0/)
  assert.match(tagProblem({ tag: 'v0.3.0-beta', version: '0.3.0' }), /does not name version/)
  assert.match(tagProblem({ tag: 'v0.3.0.1', version: '0.3.0' }), /does not name version/, 'a version is not a prefix match')
})

test('the signature read back from codesign names its authority and team; anything but Developer ID refuses', () => {
  const said = ['Executable=/x/Fabric.app/Contents/MacOS/Fabric', 'Identifier=ai.passioncode.desktop', 'CodeDirectory v=20500 size=1 flags=0x10000(runtime)',
    `Authority=${ID}`, 'Authority=Developer ID Certification Authority', 'Authority=Apple Root CA', 'TeamIdentifier=ABCDE12345', 'Runtime Version=15.0.0'].join('\n')
  assert.deepEqual(signatureOf(said), { authority: ID, team: 'ABCDE12345', hardenedRuntime: true })
  assert.equal(signatureOf(said.replace('(runtime)', '(none)')).hardenedRuntime, false)
  assert.throws(() => signatureOf('Executable=/x\nSignature=adhoc\nTeamIdentifier=not set'), /not signed with a Developer ID Application identity/)
  assert.throws(() => signatureOf(said.replace('TeamIdentifier=ABCDE12345', 'TeamIdentifier=ZZZZZ99999')), /team ZZZZZ99999 does not match the authority/)
})

// A remote with main, a release tag on main, a later commit on main and a side branch.
function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-commit-'))
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'init.defaultBranch=main', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const remote = path.join(dir, 'remote.git'), work = path.join(dir, 'work')
  git(dir, 'init', '--bare', '-q', remote)
  git(dir, 'clone', '-q', remote, work)
  const commit = (m) => { writeFileSync(path.join(work, 'f'), m); git(work, 'add', 'f'); git(work, 'commit', '-q', '-m', m); return git(work, 'rev-parse', 'HEAD') }
  const tagged = commit('release')
  git(work, 'tag', '-a', 'v1.0.0', '-m', 'v1.0.0')
  const tip = commit('later')
  git(work, 'push', '-q', 'origin', 'main', '--tags')
  git(work, 'checkout', '-q', '-b', 'side')
  const side = commit('side')
  const runner = (args) => git(work, ...args)
  return { dir, work, git, tagged, tip, side, runner }
}

test('the commit: main\'s tip, or a tag on main checked out by CI, is released; a commit not on main refuses', (t) => {
  const f = fixture()
  t.after(() => rmSync(f.dir, { recursive: true, force: true }))
  f.git(f.work, 'checkout', '-q', '--detach', f.tip)
  assert.equal(releaseCommitProblem(f.runner), null, 'origin/main itself')
  f.git(f.work, 'checkout', '-q', '--detach', 'v1.0.0')
  assert.equal(releaseCommitProblem(f.runner), null, 'a tag on main behind its tip (the CI checkout of a release tag)')
  f.git(f.work, 'checkout', '-q', 'side')
  assert.match(releaseCommitProblem(f.runner), /is not on origin\/main/)
})

test('the commit: without an origin/main to compare with, the release refuses rather than guesses', (t) => {
  const f = fixture()
  t.after(() => rmSync(f.dir, { recursive: true, force: true }))
  f.git(f.work, 'update-ref', '-d', 'refs/remotes/origin/main')
  f.git(f.work, 'checkout', '-q', '--detach', f.tip)
  assert.match(releaseCommitProblem(f.runner), /cannot read origin\/main/)
})

test('no team id or identity is written into the release config or the release script (it comes from CI)', async () => {
  const { readFileSync } = await import('node:fs')
  const root = new URL('../../', import.meta.url)
  const read = (p) => readFileSync(new URL(p, root), 'utf8')
  const config = read('apps/desktop/electron-builder.release.yml')
  assert.doesNotMatch(config, /^\s*identity\s*:/m, 'electron-builder.release.yml must not name an identity')
  assert.match(config, /^\s*notarize:\s*true\s*$/m, 'electron-builder still notarizes and staples the app, with the API key the script maps')
  for (const p of ['scripts/release-mac.mjs', 'scripts/lib/release-mac.mjs', 'apps/desktop/electron-builder.release.yml']) {
    const code = read(p).split('\n').filter((l) => !/^\s*(\/\/|#)/.test(l)).join('\n')
    assert.doesNotMatch(code, /['"(][A-Z0-9]{10}['")]/, `${p} carries what looks like a literal team id`)
  }
})

// electron-builder's own config loader decides what the release build is told. Loaded from the
// desktop app's installed electron-builder; a checkout without `pnpm install` skips and says so.
async function loadBuilderConfig(t) {
  const { createRequire } = await import('node:module')
  const desktop = path.resolve(import.meta.dirname, '../../apps/desktop')
  try {
    const req = createRequire(createRequire(path.join(desktop, 'package.json')).resolve('electron-builder'))
    return { desktop, getConfig: req('app-builder-lib/out/util/config/config').getConfig }
  } catch { t.skip('electron-builder is not installed (pnpm install)'); return null }
}

test('electron-builder resolves the release as a signed DMG with the identity CI gave, and unsigned without it', async (t) => {
  const loaded = await loadBuilderConfig(t)
  if (!loaded) return
  const { desktop, getConfig } = loaded
  const release = path.join(desktop, 'electron-builder.release.yml')
  const alone = await getConfig(desktop, release, null)
  assert.equal(alone.mac.identity, null, 'the release config by itself names no identity, so it cannot sign')
  const dir = mkdtempSync(path.join(tmpdir(), 'release-config-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'electron-builder.ci.json')
  writeFileSync(file, JSON.stringify(builderConfig({ releaseConfig: release, identity: ID })))
  const c = await getConfig(desktop, file, null)
  assert.equal(c.mac.identity, 'Example Org (ABCDE12345)')
  // The base config's `dir` target merges in beside the DMG (electron-builder concatenates the arrays);
  // the override changes the identity and nothing else about what is built.
  assert.deepEqual(c.mac.target, alone.mac.target)
  assert.ok(c.mac.target.some((x) => x?.target === 'dmg'), 'the release builds the DMG')
  assert.equal(c.mac.notarize, true)
  assert.equal(c.mac.hardenedRuntime, true)
  assert.equal(c.dmg.sign, true)
  assert.equal(c.appId, 'ai.passioncode.desktop', 'the base config is still under it')
})
