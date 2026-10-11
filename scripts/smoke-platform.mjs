#!/usr/bin/env node
// #region smoke-platform — docs: docs/evidence/plans/2026-10-10-windows-linux-port.md#req-table
// Starts an installed Fabric in its SMOKE mode on a runner and reads what it says (0.3.5, CO-238, REQ-03):
//
//   node scripts/smoke-platform.mjs --exe <path> --expect ok|started [--timeout <seconds>] [--no-sandbox] [--mcp] [--receipt <file> --check <name>]
//   node scripts/smoke-platform.mjs --exe <path> --mcp-only
//
// SMOKE mode boots the whole app — stack, schema, identity, journal, agent surface — and prints `SMOKE OK …`,
// or the classified startup failure `SMOKE FAILED (<cause>) …` and exits 1. `--expect ok` (a runner with Docker and
// the Supabase CLI) passes on SMOKE OK only. `--expect started` (a Windows runner, which cannot run Linux
// containers) passes when the app reached its own classified failure about the stack — never on a crash, a hang,
// an unknown cause or no line at all. A throwaway user-data folder keeps the runner's profile out of it.
//
// `--mcp` also starts the install's own bin/fabric-mcp (ADR-0134) with a throwaway home and requires initialize and
// tools/list answered (scripts/lib/smoke-platform.mjs#runMcpProbe): the launcher runs the fused binary as Node from
// app.asar, a path no source-tree test reaches. Its verdict goes into the receipt as `checks['fabric-mcp']`.
// `--mcp-only` runs that check alone, without starting the app.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { packagedMcpCheck, smokeVerdict } from './lib/smoke-platform.mjs'

const argv = process.argv.slice(2)
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined }
const exe = opt('exe'), expect = opt('expect'), timeout = Number(opt('timeout') ?? 300)
const usage = 'usage: smoke-platform.mjs --exe <path> --expect ok|started [--timeout s] [--no-sandbox] [--mcp] [--receipt <file> --check <name>]\n       smoke-platform.mjs --exe <path> --mcp-only'
async function mcpCheck() {
  const mcp = await packagedMcpCheck({ exe })
  if (!mcp.pass && mcp.stderr.trim()) process.stderr.write(mcp.stderr)
  console.log(`smoke-platform: fabric-mcp ${mcp.pass ? 'PASS' : 'FAIL'} — ${mcp.why}`)
  return mcp
}
// `--mcp-only` checks bin/fabric-mcp and starts nothing else: no SMOKE run, so no stack is started or reached — the
// form for a Mac whose own stack is live (docs/launch/release-mac.md, step 7).
if (exe && argv.includes('--mcp-only')) process.exit((await mcpCheck()).pass ? 0 : 1)
if (!exe || !['ok', 'started'].includes(expect)) { console.error(usage); process.exit(2) }

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
child.on('exit', async (code, signal) => {
  clearTimeout(timer)
  const verdict = smokeVerdict({ output: out, code, signal, expect })
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* A Windows file still held by an exiting helper; the runner discards it. */ }
  console.log(`smoke-platform: ${verdict.pass ? 'PASS' : 'FAIL'} — ${verdict.why}`)
  const mcp = argv.includes('--mcp') ? await mcpCheck() : null
  // The verdicts go into the package's receipt under `checks` (PL-10), so the release says what was started.
  const receipt = opt('receipt'), check = opt('check')
  if (receipt && check) {
    const r = JSON.parse(readFileSync(receipt, 'utf8'))
    r.checks = { ...(r.checks ?? {}), [check]: { pass: verdict.pass, why: verdict.why, expect }, ...(mcp ? { 'fabric-mcp': { pass: mcp.pass, why: mcp.why } } : {}) }
    writeFileSync(receipt, JSON.stringify(r, null, 2) + '\n')
  }
  process.exit(verdict.pass && (mcp?.pass ?? true) ? 0 : 1)
})
// #endregion smoke-platform
