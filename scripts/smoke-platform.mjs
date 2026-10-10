#!/usr/bin/env node
// #region smoke-platform — docs: docs/evidence/plans/2026-10-10-windows-linux-port.md#req-table
// Starts an installed Fabric in its SMOKE mode on a runner and reads what it says (0.3.5, CO-238, REQ-03):
//
//   node scripts/smoke-platform.mjs --exe <path> --expect ok|started [--timeout <seconds>] [--no-sandbox]
//
// SMOKE mode boots the whole app — stack, schema, identity, journal, agent surface — and prints `SMOKE OK …`,
// or the classified startup failure `SMOKE FAILED (<cause>) …` and exits 1. `--expect ok` (a runner with Docker and
// the Supabase CLI) passes on SMOKE OK only. `--expect started` (a Windows runner, which cannot run Linux
// containers) passes when the app reached its own classified failure about the stack — never on a crash, a hang,
// an unknown cause or no line at all. A throwaway user-data folder keeps the runner's profile out of it.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { smokeVerdict } from './lib/smoke-platform.mjs'

const argv = process.argv.slice(2)
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined }
const exe = opt('exe'), expect = opt('expect'), timeout = Number(opt('timeout') ?? 300)
if (!exe || !['ok', 'started'].includes(expect)) { console.error('usage: smoke-platform.mjs --exe <path> --expect ok|started [--timeout s] [--no-sandbox]'); process.exit(2) }

const profile = mkdtempSync(path.join(tmpdir(), 'fabric-smoke-'))
const args = [`--user-data-dir=${profile}`, ...(argv.includes('--no-sandbox') ? ['--no-sandbox'] : [])]
const child = spawn(exe, args, { env: { ...process.env, SMOKE: '1', FABRIC_NO_KEYCHAIN: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
let out = ''
child.stdout.on('data', (d) => { out += d; process.stdout.write(d) })
child.stderr.on('data', (d) => { out += d; process.stderr.write(d) })
const kill = () => {
  if (process.platform === 'win32') spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGKILL')
}
const timer = setTimeout(() => { out += `\n[smoke-platform] no verdict within ${timeout} s\n`; kill() }, timeout * 1000)
child.on('exit', (code, signal) => {
  clearTimeout(timer)
  const verdict = smokeVerdict({ output: out, code, signal, expect })
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* A Windows file still held by an exiting helper; the runner discards it. */ }
  console.log(`smoke-platform: ${verdict.pass ? 'PASS' : 'FAIL'} — ${verdict.why}`)
  process.exit(verdict.pass ? 0 : 1)
})
// #endregion smoke-platform
