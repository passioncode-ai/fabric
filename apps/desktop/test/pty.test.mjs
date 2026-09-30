// Live PTY probe. Exists because of a real defect caught 2026-08-31: node-pty's
// darwin prebuilds ship spawn-helper WITHOUT the exec bit, and every pty.spawn
// then dies with `posix_spawnp failed`. The root postinstall chmods it; this
// test is the check that catches a regression (fresh install, dependency bump).

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pty = require('node-pty')

const shell = process.env.SHELL ?? '/bin/zsh'
const p = pty.spawn(shell, ['-c', 'echo PTY-ALIVE-$((6*7))'], {
  name: 'xterm',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env
})

let out = ''
p.onData((d) => (out += d))
p.onExit(({ exitCode }) => {
  const ok = out.includes('PTY-ALIVE-42') && exitCode === 0
  console.log(ok ? 'ok   PTY spawn + echo through a real pseudo-terminal' : `FAIL pty: exit=${exitCode} out=${out}`)
  process.exit(ok ? 0 : 1)
})
setTimeout(() => {
  console.error('FAIL pty: timeout')
  process.exit(1)
}, 10_000)
