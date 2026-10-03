#!/usr/bin/env node
// The macOS release: Fabric as one Developer ID signed, notarized and stapled DMG for Apple silicon.
//
//   python3 ~/DATA/project-observatory/tools/use_secret.py run apple-publisher-kj35uyyl22 \
//     ASC_API_KEY_P8_B64,ASC_KEY_ID,ASC_ISSUER_ID -- node scripts/release-mac.mjs
//
// The notarization key reaches a temporary mode-600 file that is removed on exit; no value is
// printed. The build comes from a clean, committed tree so the manifest names a real commit. Every
// claim the release makes is checked on the artifact itself, and the receipt records those checks:
// the app's deep signature, Gatekeeper's assessment of the app, the stapled tickets of app and DMG,
// and the DMG's SHA-256.

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { releaseGateProblems } from './lib/release-gate.mjs'

const root = path.resolve(import.meta.dirname, '..'), desktop = path.join(root, 'apps', 'desktop')
const run = (bin, args, opts = {}) => execFileSync(bin, args, { cwd: desktop, stdio: 'inherit', ...opts })
const out = (bin, args, opts = {}) => execFileSync(bin, args, { cwd: desktop, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()
const fail = m => { console.error('release: ' + m); process.exit(1) }
// spctl answers on stderr and by exit status; a rejection is a failed release, never a note.
const assess = (args, what) => { const r = spawnSync('spctl', args, { encoding: 'utf8' }); const said = `${r.stderr}${r.stdout}`.trim(); if (r.status !== 0) fail(`Gatekeeper rejected the ${what}: ${said}`); return said.split('\n')[0] }

for (const v of ['ASC_API_KEY_P8_B64', 'ASC_KEY_ID', 'ASC_ISSUER_ID']) if (!process.env[v]) fail(`${v} missing — run through use_secret.py (see the header)`)
if (out('git', ['status', '--porcelain'], { cwd: root })) fail('the tree is not clean; commit first so the build names its commit')
const version = JSON.parse(readFileSync(path.join(desktop, 'package.json'), 'utf8')).version
// The release gate (plan row P-02): three independent verification iterations, the last with no blocking
// finding open, recorded in the ledger docs/launch/release-gate.json names (scripts/lib/release-gate.mjs).
{
  const gateFile = path.join(root, 'docs', 'launch', 'release-gate.json')
  const gateText = (() => { try { return readFileSync(gateFile, 'utf8') } catch { return '' } })()
  const ledgerPath = (() => { try { return JSON.parse(gateText).ledger } catch { return null } })()
  const ledgerText = (() => { try { return ledgerPath ? readFileSync(path.join(root, ledgerPath), 'utf8') : '' } catch { return '' } })()
  const problems = releaseGateProblems({ version, gateText, ledgerText })
  if (problems.length) fail(`the release gate is not clear:\n  ${problems.join('\n  ')}`)
}
const commit = out('git', ['rev-parse', 'HEAD'], { cwd: root })

const tmp = mkdtempSync(path.join(tmpdir(), 'fabric-release-'))
try {
  const key = path.join(tmp, 'asc.p8')
  writeFileSync(key, Buffer.from(process.env.ASC_API_KEY_P8_B64, 'base64'), { mode: 0o600 })
  const notary = ['--key', key, '--key-id', process.env.ASC_KEY_ID, '--issuer', process.env.ASC_ISSUER_ID]
  const env = { ...process.env, APPLE_API_KEY: key, APPLE_API_KEY_ID: process.env.ASC_KEY_ID, APPLE_API_ISSUER: process.env.ASC_ISSUER_ID, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
  delete env.ASC_API_KEY_P8_B64

  console.log(`\n== build Fabric ${version} from ${commit.slice(0, 12)}`)
  rmSync(path.join(desktop, 'dist'), { recursive: true, force: true })
  run('node', ['../../scripts/stage-app-icon.mjs'])
  run('pnpm', ['exec', 'electron-vite', 'build'])
  run('node', ['../../scripts/build-manifest.mjs'])
  console.log('\n== sign, notarize and staple the app; build and sign the DMG')
  run('pnpm', ['exec', 'electron-builder', '--mac', '--config', 'electron-builder.release.yml'], { env })

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
  const gatekeeperApp = assess(['--assess', '--type', 'execute', '-vv', app], 'app')
  run('xcrun', ['stapler', 'validate', app])
  run('xcrun', ['stapler', 'validate', dmg])
  const gatekeeperDmg = assess(['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', dmg], 'DMG')
  const sha256 = createHash('sha256').update(readFileSync(dmg)).digest('hex')

  const receipt = { schema: 'FabricMacRelease@1', version, commit, artifact: dmgName, bytes: statSync(dmg).size, sha256,
    arch: 'arm64', minimumMacOS: out('/usr/libexec/PlistBuddy', ['-c', 'Print :LSMinimumSystemVersion', path.join(app, 'Contents', 'Info.plist')]),
    signed: 'Developer ID Application (KJ35UYYL22), hardened runtime', notarization: { dmg: submitted.id, status: submitted.status },
    checks: { codesignDeepStrict: 'passed', gatekeeperApp, staple: 'app and DMG validated', gatekeeperDmg },
    builtAt: new Date().toISOString() }
  mkdirSync(path.join(root, 'docs', 'releases'), { recursive: true })
  writeFileSync(path.join(root, 'docs', 'releases', `fabric-${version}-mac.json`), JSON.stringify(receipt, null, 2) + '\n')
  console.log('\n' + JSON.stringify(receipt, null, 2))
} finally { rmSync(tmp, { recursive: true, force: true }) }
