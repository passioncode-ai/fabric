// The owner, 2026-11-21 (02:40 and again 05:10): Russian copied or pasted in a Fabric console turned to «–î–∞–≤–∞–π», UTF-8
// read as Mac Roman. Fabric started by launchd («Служба доски») has no locale, so its consoles had none, and macOS's
// pbcopy, which Claude Code copies through, read the text as Mac Roman (`main/sessionEnv.ts#UTF8_CTYPE`).
//
// Proved through what a console really is, not through the helper alone:
//   1. a real PTY, spawned with the environment `pty.ts` gives every console (project consoles and the CEO's alike: the
//      CEO window opens its console through the same `ptys.open`, adding only `ceoLaunchExtras`), takes a paste of more
//      than 6 KB of Russian in raw mode, as Claude Code reads it, byte for byte;
//   2. pbcopy then pbpaste in that environment returns the same bytes, on the Find pasteboard (`-pboard find`, which
//      Safari, Terminal and TextEdit share for Cmd+E), never the clipboard; what it held is restored after (run twelve,
//      DA-72); the same round trip with no locale is shown to break, so the test
//      would see the defect come back;
//   3. the CEO's launch extras, for every runner, set no locale that could override the console's.
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sessionEnvironment, UTF8_CTYPE } from '../src/main/sessionEnv.ts'
import { ceoLaunchExtras, CEO_MODELS_DEFAULT, CEO_RUNNERS_KNOWN } from '../src/shared/ceoAgent.ts'

const require = createRequire(import.meta.url)
const darwin = process.platform === 'darwin'

// What launchd gives Fabric: no LANG and no LC_* at all.
const launchd = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'LANG' && !k.startsWith('LC_')))
const consoleEnv = sessionEnvironment(launchd)

// More than 6 KB of Russian, with line breaks and the owner's own letters (ё, й, щ), the size of a long dictation.
const LINE = 'Давай проверим вставку: съешь же ещё этих мягких французских булок, да выпей чаю. Ёлка, йод, щука.\n'
const TEXT = LINE.repeat(Math.ceil(6500 / Buffer.byteLength(LINE)))
const BYTES = Buffer.from(TEXT, 'utf8')

test('a console Fabric opens names UTF-8 for its characters, the CEO\'s included', () => {
  assert.equal(consoleEnv.LC_CTYPE, UTF8_CTYPE)
  for (const runner of CEO_RUNNERS_KNOWN) {
    const extras = ceoLaunchExtras(runner, CEO_MODELS_DEFAULT)
    for (const k of Object.keys(extras.env)) assert.ok(k !== 'LANG' && !k.startsWith('LC_'), `${runner} sets ${k}`)
    // `pty.ts` lays the extras over the session environment: the CEO's console keeps the locale.
    assert.equal({ ...consoleEnv, ...extras.env }.LC_CTYPE, UTF8_CTYPE, runner)
  }
})

test('a long Russian paste reaches a console\'s program whole, in raw mode as an agent reads it', { skip: !darwin && 'macOS only' }, async () => {
  const pty = require('node-pty')
  const dir = mkdtempSync(path.join(tmpdir(), 'paste-'))
  const out = path.join(dir, 'got')
  try {
    const p = pty.spawn('/bin/sh', ['-c', `stty raw -echo; head -c ${BYTES.length} > '${out}'; printf done`], { name: 'xterm-256color', cols: 120, rows: 32, cwd: dir, env: consoleEnv })
    let seen = ''
    p.onData((d) => { seen += d })
    await new Promise((r) => setTimeout(r, 300))
    // xterm hands a paste to the PTY in pieces; 1 KB pieces cross character boundaries on purpose.
    for (let i = 0; i < BYTES.length; i += 1024) p.write(BYTES.subarray(i, i + 1024))
    const deadline = Date.now() + 10_000
    while (!seen.includes('done') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50))
    p.kill()
    assert.ok(existsSync(out) && statSync(out).size === BYTES.length, `got ${existsSync(out) ? statSync(out).size : 0} of ${BYTES.length} bytes`)
    assert.ok(readFileSync(out).equals(BYTES), 'the pasted bytes changed on the way')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('text an agent copies in a console (pbcopy) is pasted back whole as Unicode, and breaks with no locale', { skip: !darwin && 'macOS only' }, () => {
  // Claude Code copies through pbcopy in the console's environment; Fabric, the terminal and every other app read the
  // pasteboard as Unicode. The reader here is a UTF-8 pbpaste, standing for them.
  const utf8 = { ...launchd, LANG: 'en_US.UTF-8' }
  const before = spawnSync('/usr/bin/pbpaste', ['-pboard', 'find'], { env: utf8 }).stdout
  const copyThenPaste = (copyEnv) => {
    const put = spawnSync('/usr/bin/pbcopy', ['-pboard', 'find'], { env: copyEnv, input: BYTES })
    assert.equal(put.status, 0, String(put.stderr))
    return spawnSync('/usr/bin/pbpaste', ['-pboard', 'find'], { env: utf8 }).stdout
  }
  try {
    assert.ok(copyThenPaste(consoleEnv).equals(BYTES), 'a copy in a console\'s environment changed the text')
    // The defect itself, so this test sees it return: copied with no locale, the paste is Mac Roman read as UTF-8.
    const broken = copyThenPaste(launchd)
    assert.ok(!broken.equals(BYTES), 'with no locale the copy should break: the check would not see the defect')
    assert.ok(broken.toString('utf8').includes('–î'), 'the break is the owner\'s «–Д…», UTF-8 read as Mac Roman')
  } finally {
    // The person's Find text back as it was (run twelve, DA-72).
    spawnSync('/usr/bin/pbcopy', ['-pboard', 'find'], { env: utf8, input: before })
  }
})
