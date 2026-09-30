// What may happen per byte of agent output, and what may travel per listing.
//
// FA-08 measured the cost and `scripts/bench/pty-output.mjs` records it. This
// gate checks the SHAPE instead, because a number here would be a budget nobody
// has agreed — the card is explicit that a proposed latency budget must not be
// passed off as a measured one. Shapes are checkable without one.
//
// Three rules, each the exact regression that produced the measurement:
//
//  1. The PTY data handler does not read the buffer it just wrote to. Reading it
//     is what made every chunk pay for the whole 400 000 characters.
//  2. A session listing does not carry a field named `scrollback`. Carrying the
//     reattach buffer in every listing sent up to 400 000 characters per session
//     across the boundary on every poll, for one reader that needed it once.
//  3. Output delivered to a view carries the character count it ends at, so a
//     reattaching view can tell the replay from the gap. Without it the view is
//     back to choosing between losing those bytes and writing them twice.

import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(root + p, 'utf8')
const problems = []

// ── 1. the data handler does not read the buffer ─────────────────────────────
const pty = read('apps/desktop/src/main/pty.ts')
const handlerStart = pty.indexOf('pty.onData((data)')
if (handlerStart === -1) problems.push('apps/desktop/src/main/pty.ts: no pty.onData handler found — this gate has lost its subject')
else {
  // The handler ends where the next sibling registration begins.
  const handlerEnd = pty.indexOf('pty.onExit(', handlerStart)
  const body = pty.slice(handlerStart, handlerEnd === -1 ? pty.length : handlerEnd)
  for (const reader of ['.text()', '.tailLine()'])
    if (body.includes(reader))
      problems.push(
        'apps/desktop/src/main/pty.ts: the data handler calls ' + reader + '. That is a read of the ' +
          'whole buffer on every chunk the terminal delivers, which is the cost FA-08 measured — see ' +
          'docs/evidence/plans/2026-09-10-output-cost/. Read it where somebody asks for it.'
      )
  if (/scrollback\s*=\s*\(/.test(body))
    problems.push(
      'apps/desktop/src/main/pty.ts: the data handler rebuilds the buffer by concatenation. ' +
        'A new 400 000-character string per chunk is the allocation the chunk ring exists to avoid.'
    )
}

// ── 2. a listing does not carry the reattach buffer ─────────────────────────
const types = read('apps/desktop/src/shared/types.ts')
const sessionType = types.slice(
  types.indexOf('export interface TerminalSession'),
  types.indexOf('export interface CreateProjectInput')
)
if (!sessionType) problems.push('apps/desktop/src/shared/types.ts: TerminalSession not found — this gate has lost its subject')
else {
  if (/^\s*scrollback\s*[:?]/m.test(sessionType))
    problems.push(
      'apps/desktop/src/shared/types.ts: TerminalSession carries `scrollback`. Every listing then ' +
        'carries every session’s whole buffer across the IPC boundary, for one reader that needs ' +
        'it once per mount. The excerpt is for tiles; `terminal.scrollback` is for the mount.'
    )
  if (!/^\s*written\s*:/m.test(sessionType))
    problems.push(
      'apps/desktop/src/shared/types.ts: TerminalSession has no `written` count. A reattaching view ' +
        'needs it to tell the replay from the bytes that arrived while it was asking.'
    )
}

// ── 3. output carries the count it ends at ──────────────────────────────────
const contract = types.slice(types.indexOf('onData(cb:'), types.indexOf('onData(cb:') + 200)
if (!contract.includes('written'))
  problems.push(
    'apps/desktop/src/shared/types.ts: terminal.onData does not deliver the character count. ' +
      'Without it a reattaching view must choose between losing the bytes emitted while its replay ' +
      'was in flight and writing them twice.'
  )
const preload = read('apps/desktop/src/preload/index.ts')
if (!/cb\(sessionId, data, written\)/.test(preload))
  problems.push('apps/desktop/src/preload/index.ts: the data listener drops the count before the renderer sees it.')

if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' output-cost problem(s)')
  process.exit(1)
}
console.log(
  'output cost: the data handler writes without reading, the listing carries an excerpt rather than ' +
    'the buffer, and every chunk names the count it ends at'
)
