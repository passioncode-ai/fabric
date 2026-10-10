#!/usr/bin/env node
// #region package-platform-cli — docs: docs/evidence/plans/2026-10-10-windows-linux-port.md#modules-walking-skeleton-first
// Builds one Windows or Linux package of Fabric on its own native runner (0.3.5, CO-238):
//
//   node scripts/package-platform.mjs --platform win32|linux --arch x64|arm64
//
// The icon is staged, the app bundled, the build manifest written, then electron-builder makes the NSIS installer
// (Windows) or the AppImage and .deb (Linux) under apps/desktop/dist with our own names. Windows is signed through
// Azure Artifact Signing when AZURE_SIGNING_ENDPOINT, AZURE_SIGNING_ACCOUNT and AZURE_SIGNING_PROFILE are all set
// (the release environment's job sets them), else the receipt says NOT_SIGNED. The receipt,
// apps/desktop/dist/fabric-<version>-<os>-<arch>.json, names every file with its SHA-256.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { artifactNames, builderArgs, parsePlatformArgs, signingOptions } from './lib/package-platform.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DESKTOP = path.join(ROOT, 'apps/desktop')
const fail = (m) => { console.error(`package-platform: ${m}`); process.exit(1) }

let args
try { args = parsePlatformArgs(process.argv.slice(2)) } catch (e) { fail(e.message) }
if (process.platform !== args.platform) fail(`build ${args.platform} on its own runner, not on ${process.platform} (native modules are per OS)`)
if (process.arch !== args.arch) fail(`build ${args.arch} on its own runner, not on ${process.arch} (node-pty's native code is per architecture)`)

const version = JSON.parse(readFileSync(path.join(DESKTOP, 'package.json'), 'utf8')).version
const signing = args.platform === 'win32' ? signingOptions(process.env) : null
const run = (file, argv, cwd = DESKTOP, env = process.env) => execFileSync(file, argv, { cwd, env, stdio: 'inherit' })
// pnpm is a .cmd shim on Windows, which execFile cannot start without a shell; our arguments carry no shell syntax.
const pnpm = (argv, env = process.env) => execFileSync('pnpm', argv, { cwd: DESKTOP, env, stdio: 'inherit', shell: process.platform === 'win32' })

run(process.execPath, [path.join(ROOT, 'scripts/stage-app-icon.mjs')], ROOT)
pnpm(['exec', 'electron-vite', 'build'])
run(process.execPath, [path.join(ROOT, 'scripts/build-manifest.mjs')], DESKTOP)
const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
// The Windows arm64 installer otherwise drops every .exe and .dll from its payload (platforms.md, lessons: nsis7z).
if (args.platform === 'win32' && args.arch === 'arm64') env.ELECTRON_BUILDER_7Z_FILTER = 'BCJ'
pnpm(['exec', 'electron-builder', '--config', 'electron-builder.yml', ...builderArgs({ ...args, version, signing })], env)

const files = artifactNames({ ...args, version }).map((name) => {
  const file = path.join(DESKTOP, 'dist', name)
  if (!existsSync(file)) fail(`electron-builder did not write ${name}`)
  return { name, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }
})
const os = args.platform === 'win32' ? 'windows' : 'linux'
// The keys every PassionCode product's platform receipt carries (platforms.md PL-10).
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
const receipt = {
  version, commit, platform: args.platform, arch: args.arch, files,
  macos_notarization: 'NOT_APPLICABLE',
  windows_authenticode: args.platform === 'win32' ? (signing ? 'SIGNED (Azure Artifact Signing)' : 'NOT_SIGNED') : 'NOT_APPLICABLE',
  checks: {},
  built_at: new Date().toISOString()
}
const out = path.join(DESKTOP, 'dist', `fabric-${version}-${os}-${args.arch}.json`)
writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n')
console.log(`package-platform: ${files.map(f => f.name).join(', ')} (${receipt.windows_authenticode ?? 'Linux packages are not code-signed; SHA256SUMS is GPG-signed at publish'}); receipt ${path.relative(ROOT, out)}`)
// #endregion package-platform-cli
