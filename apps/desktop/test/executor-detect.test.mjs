// Executor detection for the first run (ADR-0100, SCN-126 step 2). Driven through REAL
// processes: two stand-in programs on a temporary PATH — one answers `--version`, one hangs
// past the timeout — and one program that is absent. Nothing is modelled.

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const { detectExecutors } = await import(path.resolve(import.meta.dirname, '../src/main/executorDetect.ts'))

const bin = mkdtempSync(path.join(tmpdir(), 'fabric-bin-'))
const program = (name, body) => {
  const p = path.join(bin, name)
  writeFileSync(p, `#!/bin/sh\n${body}\n`)
  chmodSync(p, 0o755)
}
program('claude', 'echo "2.1.288 (Claude Code)"')
program('codex', `${path.join(bin, 'codex-child')} & echo $! > ${path.join(bin, 'child.pid')}; wait`)
program('aider', 'exit 3')
mkdirSync(path.join(bin, 'dirprog'))
program('codex-child', 'exec /bin/sleep 30')

const env = { PATH: bin, HOME: process.env.HOME ?? '/tmp' }
const rows = await detectExecutors(
  [
    { id: 'claude-code', label: 'Claude Code', program: 'claude', connected: true },
    { id: 'codex', label: 'Codex', program: 'codex', connected: false },
    { id: 'goose', label: 'Goose', program: 'goose', connected: false },
    { id: 'aider', label: 'Aider', program: 'aider', connected: false },
    { id: 'dir', label: 'Dir', program: 'dirprog', connected: false }
  ],
  { env, timeoutMs: 800 }
)
const by = Object.fromEntries(rows.map((r) => [r.id, r]))

assert.equal(by['claude-code'].state, 'found')
assert.equal(by['claude-code'].version, '2.1.288')
assert.equal(by['claude-code'].path, path.join(bin, 'claude'))

assert.equal(by['codex'].state, 'unresponsive', 'a program that does not answer in time is not reported as found or missing')
assert.equal(by['codex'].version, null)

assert.equal(by['aider'].state, 'unresponsive', 'a program that fails on --version is installed but unusable, never "found"')
assert.equal(by['goose'].state, 'missing')
assert.equal(by['goose'].path, null)
assert.equal(by['goose'].install, null, 'no install command is invented for a program without a verified one')
assert.equal(by['claude-code'].install, null, 'an installed agent is not offered an install command')
assert.equal(by['codex'].install, null, 'an installed agent that did not answer is not told to install it')
assert.equal(by['dir'].state, 'missing', 'a directory of that name on PATH is not the program')
assert.equal(by['claude-code'].connected, true)
assert.equal(by['codex'].connected, false, 'found is not the same as connected to Fabric')
// The hung probe's CHILD is gone too: the whole process group was killed on the timeout.
await new Promise((r) => setTimeout(r, 200))
const childPid = Number(readFileSync(path.join(bin, 'child.pid'), 'utf8'))
let alive = true
try { process.kill(childPid, 0) } catch { alive = false }
assert.equal(alive, false, 'a hung probe leaves no child process running')
const missingRows = await detectExecutors([{ id: 'claude-code', label: 'Claude Code', program: 'claude', connected: true }], { env: { PATH: '/nonexistent' } })
assert.equal(missingRows[0].install, 'curl -fsSL https://claude.ai/install.sh | bash', "a missing Claude Code is offered the vendor's native installer")

console.log('PASS executor detection: found with version, unresponsive on timeout, missing; install hints only where verified')
