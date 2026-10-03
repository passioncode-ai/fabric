#!/usr/bin/env node
// The macOS release: Fabric as one Developer ID signed, notarized and stapled DMG for Apple silicon.
//
// A release is signed ONLY in CI, in the protected `release` environment of
// .github/workflows/release.yml (ADR-0111; passioncode-ai/.github release-signing/README.md):
//
//   node scripts/release-mac.mjs --check-only --tag v0.3.0     the preflight: commit, tag, gate
//   node scripts/release-mac.mjs --tag v0.3.0                  the build; the identity arrives in
//                                                              FABRIC_SIGN_IDENTITY, ASC_* as secrets
//
// Run by a person with their own identity it is a DEBUG build, never published:
//
//   python3 ~/DATA/project-observatory/tools/use_secret.py run apple-publisher-kj35uyyl22 \
//     ASC_API_KEY_P8_B64,ASC_KEY_ID,ASC_ISSUER_ID -- node scripts/release-mac.mjs --identity '<your Developer ID>'
//
// electron-builder signs the app with the identity it is given, notarizes and staples it with the App
// Store Connect API key (mapped to APPLE_API_KEY*), and builds and signs the DMG; this script then
// notarizes and staples the DMG. The key reaches a temporary mode-600 file that is removed on exit; no
// value is printed or passed in argv. Every claim the release makes is checked on the artifact itself,
// and the receipt records those checks: the app's deep signature and who signed it, Gatekeeper's
// assessment of the app and the DMG, the stapled tickets of both, and the DMG's SHA-256.

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { releaseGateProblems } from './lib/release-gate.mjs'
import { builderConfig, builderIdentity, parseReleaseArgs, releaseCommitProblem, signatureOf, tagProblem } from './lib/release-mac.mjs'

// #region release-mac — docs: docs/launch/release-mac.md#how-a-release-is-made
const root = path.resolve(import.meta.dirname, '..'), desktop = path.join(root, 'apps', 'desktop')
const run = (bin, args, opts = {}) => execFileSync(bin, args, { cwd: desktop, stdio: 'inherit', ...opts })
const out = (bin, args, opts = {}) => execFileSync(bin, args, { cwd: desktop, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()
const fail = m => { console.error('release: ' + m); process.exit(1) }
// spctl answers on stderr and by exit status; a rejection is a failed release, never a note.
const assess = (args, what) => { const r = spawnSync('spctl', args, { encoding: 'utf8' }); const said = `${r.stderr}${r.stdout}`.trim(); if (r.status !== 0) fail(`Gatekeeper rejected the ${what}: ${said}`); return said.split('\n')[0] }

let args
try { args = parseReleaseArgs(process.argv.slice(2), process.env) } catch (e) { fail(e.message) }
if (out('git', ['status', '--porcelain'], { cwd: root })) fail('the tree is not clean; commit first so the build names its commit')
// A clean `git status` can hide an edit: a file flagged skip-worktree or assume-unchanged is not compared
// (confirmation pass after iteration 3). None may exist, so what is built is what is committed.
{
  const hidden = out('git', ['ls-files', '-v'], { cwd: root }).split('\n').filter((l) => /^(?:S|[a-z]) /.test(l))
  if (hidden.length) fail(`files are flagged skip-worktree or assume-unchanged, so the tree may differ from the commit:\n  ${hidden.slice(0, 10).join('\n  ')}`)
}
const version = JSON.parse(out('git', ['show', 'HEAD:apps/desktop/package.json'], { cwd: root })).version
if (JSON.parse(readFileSync(path.join(desktop, 'package.json'), 'utf8')).version !== version) fail('apps/desktop/package.json on disk differs from the commit')
// A release is built from `main` as it is on the remote (plan row P-03), and only when the release gate
// is clear (P-02, scripts/lib/release-gate.mjs). Both files are read FROM THE COMMIT, not the working tree:
// a clean `git status` can hide a skip-worktree edit (iteration 3).
{
  // HEAD must be ON main: its tip, or a release tag on main that CI checks out after main moved on.
  try { out('git', ['fetch', '--quiet', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { cwd: root }) } catch { fail('could not fetch origin/main to check the release commit') }
  const notOnMain = releaseCommitProblem((a) => out('git', a, { cwd: root }))
  if (notOnMain) fail(notOnMain)
  const badTag = tagProblem({ tag: args.tag, version })
  if (badTag) fail(badTag)
  const atHead = (p) => { try { return out('git', ['show', `HEAD:${p}`], { cwd: root }) } catch { return '' } }
  const gateText = atHead('docs/launch/release-gate.json')
  const ledgerPath = (() => { try { return JSON.parse(gateText).ledger } catch { return null } })()
  const ledgerText = typeof ledgerPath === 'string' && /^docs\/[\w./-]+\.md$/.test(ledgerPath) && !ledgerPath.includes('..') ? atHead(ledgerPath) : ''
  const problems = releaseGateProblems({ version, gateText, ledgerText })
  if (problems.length) fail(`the release gate is not clear:\n  ${problems.join('\n  ')}`)
}
const commit = out('git', ['rev-parse', 'HEAD'], { cwd: root })
if (args.checkOnly) {
  console.log(`release: Fabric ${version} at ${commit.slice(0, 12)}${args.tag ? ` (${args.tag})` : ''} is on origin/main and its release gate is clear`)
  process.exit(0)
}
let identity
try { identity = builderIdentity(args.identity) } catch (e) { fail(e.message) }
for (const v of ['ASC_API_KEY_P8_B64', 'ASC_KEY_ID', 'ASC_ISSUER_ID']) if (!process.env[v]) fail(`${v} missing — in CI the release environment's secret; locally run through use_secret.py (see the header)`)
const inCI = process.env.GITHUB_ACTIONS === 'true'

const tmp = mkdtempSync(path.join(tmpdir(), 'fabric-release-'))
// `fail` exits the process, which skips `finally`; the key file must go on that path too.
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }))
try {
  const key = path.join(tmp, 'asc.p8')
  writeFileSync(key, Buffer.from(process.env.ASC_API_KEY_P8_B64, 'base64'), { mode: 0o600 })
  const notary = ['--key', key, '--key-id', process.env.ASC_KEY_ID, '--issuer', process.env.ASC_ISSUER_ID]
  const env = { ...process.env, APPLE_API_KEY: key, APPLE_API_KEY_ID: process.env.ASC_KEY_ID, APPLE_API_ISSUER: process.env.ASC_ISSUER_ID, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
  delete env.ASC_API_KEY_P8_B64

  console.log(`\n== build Fabric ${version} from ${commit.slice(0, 12)}`)
  // LC-15: the previous build is removed before the new one, and its app bundle is first unregistered
  // from LaunchServices, so no stale copy of Fabric answers an `open` or a Dock click afterwards. The
  // previous release itself lives in the published GitHub release, not on this machine.
  const previousApp = path.join(desktop, 'dist', 'mac-arm64', 'Fabric.app')
  if (existsSync(previousApp)) spawnSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-u', previousApp], { stdio: 'ignore', timeout: 30_000 })
  rmSync(path.join(desktop, 'dist'), { recursive: true, force: true })
  run('node', ['../../scripts/stage-app-icon.mjs'])
  run('pnpm', ['exec', 'electron-vite', 'build'])
  run('node', ['../../scripts/build-manifest.mjs'])
  console.log('\n== sign, notarize and staple the app; build and sign the DMG')
  // The identity rides in a config file that extends the release config (scripts/lib/release-mac.mjs
  // builderConfig says why not `-c.mac.identity=`). In CI it is found in the apple-signing action's
  // keychain (CSC_KEYCHAIN), never in a login keychain.
  const config = path.join(tmp, 'electron-builder.release-identity.json')
  writeFileSync(config, JSON.stringify(builderConfig({ releaseConfig: path.join(desktop, 'electron-builder.release.yml'), identity: args.identity })))
  console.log(`   identity: ${identity}${process.env.CSC_KEYCHAIN ? ' (CI keychain)' : ''}`)
  run('pnpm', ['exec', 'electron-builder', '--mac', '--config', config], { env })

  const dist = path.join(desktop, 'dist')
  const dmgName = readdirSync(dist).find(f => f.endsWith('.dmg')) ?? fail('no DMG was produced')
  const dmg = path.join(dist, dmgName), app = path.join(dist, 'mac-arm64', 'Fabric.app')

  console.log('\n== notarize and staple the DMG')
  const submitted = JSON.parse(out('xcrun', ['notarytool', 'submit', dmg, ...notary, '--wait', '--timeout', '45m', '--output-format', 'json']))
  if (submitted.status !== 'Accepted') {
    try { run('xcrun', ['notarytool', 'log', submitted.id, ...notary]) } catch { /* The status line above is the failure. */ }
    fail(`the DMG was not accepted by notarization: ${submitted.status}`)
  }
  run('xcrun', ['stapler', 'staple', dmg])

  console.log('\n== verify the artifacts')
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app])
  // Who signed it is read back from the app, not restated: codesign -dvv answers on stderr.
  const described = spawnSync('codesign', ['-dvv', app], { encoding: 'utf8' })
  if (described.status !== 0) fail(`codesign could not describe the app: ${described.stderr.trim()}`)
  let signature
  try { signature = signatureOf(described.stderr) } catch (e) { fail(e.message) }
  if (!signature.hardenedRuntime) fail('the app is signed without the hardened runtime')
  const gatekeeperApp = assess(['--assess', '--type', 'execute', '-vv', app], 'app')
  run('xcrun', ['stapler', 'validate', app])
  run('xcrun', ['stapler', 'validate', dmg])
  const gatekeeperDmg = assess(['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', dmg], 'DMG')
  const sha256 = createHash('sha256').update(readFileSync(dmg)).digest('hex')

  const ciRun = inCI ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null
  const receipt = { schema: 'FabricMacRelease@1', version, commit, tag: args.tag, artifact: dmgName, bytes: statSync(dmg).size, sha256,
    arch: 'arm64', minimumMacOS: out('/usr/libexec/PlistBuddy', ['-c', 'Print :LSMinimumSystemVersion', path.join(app, 'Contents', 'Info.plist')]),
    signed: `${signature.authority}, hardened runtime`, team: signature.team, notarization: { dmg: submitted.id, status: submitted.status },
    checks: { codesignDeepStrict: 'passed', gatekeeperApp, staple: 'app and DMG validated', gatekeeperDmg },
    // Only a build from the release environment is published; anything else is a debug build.
    builtBy: inCI ? { ci: ciRun } : 'local debug build (never published)',
    builtAt: new Date().toISOString() }
  mkdirSync(path.join(root, 'docs', 'releases'), { recursive: true })
  writeFileSync(path.join(root, 'docs', 'releases', `fabric-${version}-mac.json`), JSON.stringify(receipt, null, 2) + '\n')
  console.log('\n' + JSON.stringify(receipt, null, 2))
} finally { rmSync(tmp, { recursive: true, force: true }) }
// #endregion release-mac
