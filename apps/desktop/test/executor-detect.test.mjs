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

const env = { PATH: bin, HOME: bin } // a HOME with no version managers: the probe sees only this PATH
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

// ── iteration 2, errors finding 8: the version is read from the RIGHT line, non-version text is not a
// version, a probe that left a child holding stdout is still answered, and nothing is left running.
{
  const bin2 = mkdtempSync(path.join(tmpdir(), 'fabric-bin2-'))
  const prog = (name, body) => { const p = path.join(bin2, name); writeFileSync(p, `#!/bin/sh\n${body}\n`); chmodSync(p, 0o755) }
  prog('codex', 'echo "update available 9.9.9 — run npm i -g"; echo "codex-cli 0.46.0"')
  prog('claude', `head -c 70000 /dev/zero | tr '\\0' x; echo`)
  prog('noisy', 'echo "hello world"')
  prog('firstline', 'echo "Tool v4.5.6 build abc"; echo "other 7.8.9"')
  prog('held', `/bin/sleep 30 & echo $! > ${path.join(bin2, 'held.pid')}; echo "held 1.2.3"`)
  const t0 = Date.now()
  const rows2 = await detectExecutors(
    [
      { id: 'codex', label: 'Codex', program: 'codex', connected: false },
      { id: 'claude-code', label: 'Claude Code', program: 'claude', connected: true },
      { id: 'noisy', label: 'Noisy', program: 'noisy', connected: false },
      { id: 'firstline', label: 'First', program: 'firstline', connected: false },
      { id: 'held', label: 'Held', program: 'held', connected: false }
    ],
    { env: { PATH: bin2, HOME: bin2 }, timeoutMs: 4000 }
  )
  const elapsed = Date.now() - t0
  const b = Object.fromEntries(rows2.map((r) => [r.id, r]))
  assert.equal(b['codex'].version, '0.46.0', 'the version is the one on the line naming the program, not an update notice')
  assert.equal(b['claude-code'].state, 'found')
  assert.equal(b['claude-code'].version, null, 'more than 64 KiB without a version is no version, not 40 characters of noise')
  assert.equal(b['noisy'].state, 'found', 'a program that answered is found even when its answer is not a version')
  assert.equal(b['noisy'].version, null, 'text that is not a version is not shown as one')
  assert.equal(b['firstline'].version, '4.5.6', 'without a line naming the program, the first version on the first line')
  assert.equal(b['held'].state, 'found', 'a program that printed its version and exited is found, even if a child still holds its output')
  assert.equal(b['held'].version, '1.2.3')
  assert.ok(elapsed < 3000, `the probe did not wait for the child's end of output (${elapsed} ms)`)
  await new Promise((r) => setTimeout(r, 200))
  const heldPid = Number(readFileSync(path.join(bin2, 'held.pid'), 'utf8'))
  let heldAlive = true
  try { process.kill(heldPid, 0) } catch { heldAlive = false }
  assert.equal(heldAlive, false, 'a probe that exited normally leaves no child running either')
}

// ── a Dock-launched app's PATH misses the version managers' folders: nvm, volta, asdf, fnm are probed when
// they exist (and only then), the nvm default first.
{
  const { widenProbePath } = await import(path.resolve(import.meta.dirname, '../src/main/executorDetect.ts'))
  const home = mkdtempSync(path.join(tmpdir(), 'fabric-home-'))
  const mk = (...p) => { const d = path.join(home, ...p); mkdirSync(d, { recursive: true }); return d }
  const volta = mk('.volta', 'bin')
  const asdf = mk('.asdf', 'shims')
  const asdfBin = mk('.asdf', 'bin')
  const nvm20 = mk('.nvm', 'versions', 'node', 'v20.1.0', 'bin')
  const nvm22 = mk('.nvm', 'versions', 'node', 'v22.3.0', 'bin')
  mkdirSync(path.join(home, '.nvm', 'alias'), { recursive: true })
  writeFileSync(path.join(home, '.nvm', 'alias', 'default'), '20\n')
  const fnm = mk('.local', 'share', 'fnm', 'aliases', 'default', 'bin')
  const widened = widenProbePath(`/usr/bin${path.delimiter}${volta}`, { HOME: home }).split(path.delimiter)
  assert.equal(widened[0], '/usr/bin', 'the PATH it was given comes first, unchanged')
  assert.equal(widened.filter((d) => d === volta).length, 1, 'a folder already on PATH is not added twice')
  for (const d of [asdf, asdfBin, nvm20, nvm22, fnm]) assert.ok(widened.includes(d), `probes ${path.relative(home, d)}`)
  assert.ok(widened.indexOf(nvm20) < widened.indexOf(nvm22), "nvm's default version is probed before the others")
  assert.ok(!widened.some((d) => d.includes('fnm') && d.includes('Application Support')), 'a folder that does not exist is not added')
  assert.equal(widenProbePath('/usr/bin', {}), '/usr/bin', 'without a HOME nothing is guessed')

  // End to end: an agent installed only through volta is FOUND from a Dock PATH.
  const p = path.join(volta, 'codex'); writeFileSync(p, '#!/bin/sh\necho "codex-cli 0.50.1"\n'); chmodSync(p, 0o755)
  const [row] = await detectExecutors([{ id: 'codex', label: 'Codex', program: 'codex', connected: false }], { env: { PATH: '/usr/bin:/bin', HOME: home } })
  assert.equal(row.state, 'found', 'a volta-installed agent is found from the Dock PATH')
  assert.equal(row.path, p)
  assert.equal(row.version, '0.50.1')
}

console.log('PASS executor detection: version from the right line, no version from noise, found despite a child holding output, no child left; nvm/volta/asdf/fnm folders probed when they exist')
