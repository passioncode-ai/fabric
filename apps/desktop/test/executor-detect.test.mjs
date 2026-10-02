// Executor detection for the first run (ADR-0100, SCN-126 step 2). Driven through REAL
// processes: two stand-in programs on a temporary PATH — one answers `--version`, one hangs
// past the timeout — and one program that is absent. Nothing is modelled.

import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
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
program('codex', 'exec /bin/sleep 5')
program('aider', 'exit 3')

const env = { PATH: bin, HOME: process.env.HOME ?? '/tmp' }
const rows = await detectExecutors(
  [
    { id: 'claude-code', label: 'Claude Code', program: 'claude' },
    { id: 'codex', label: 'Codex', program: 'codex' },
    { id: 'goose', label: 'Goose', program: 'goose' },
    { id: 'aider', label: 'Aider', program: 'aider' }
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
assert.equal(by['claude-code'].install, 'npm install -g @anthropic-ai/claude-code')

console.log('PASS executor detection: found with version, unresponsive on timeout, missing; install hints only where verified')
