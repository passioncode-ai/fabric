#!/usr/bin/env node
// Every operation is observable, and silence carries its reason (M81).
//
// MEASURED BEFORE THIS EXISTED: thirty-one `console.error` calls in a process
// that has no terminal, and a set of `catch` blocks that returned a fallback
// and dropped the reason on the floor. So a routine tick failing at three in the
// morning left its evidence in a stream nobody reads, or left none.
//
// THREE RULES, and the third is the interesting one.
//
//   1. An IPC handler is registered through `handle`, not `ipcMain.handle`. The
//      wrapper is what gives every call a correlation id and a duration, and a
//      rule applied by hand at seventy-six call sites holds until somebody is
//      busy.
//   2. NO console channel appears in the main process — not `error`, and not
//      `warn` or `log` either. The first version of this gate banned only
//      `console.error`, and eleven `warn`/`log` calls carried on writing to a
//      terminal a packaged app does not have: the second-initialize refusal,
//      the call-budget exhaustion, the session-id mismatch, three startup
//      recoveries. A gate that names one channel teaches the next author to
//      use a different one, which is worse than no gate — it looks enforced.
//   3. A `catch` block either RECORDS or EXPLAINS. Silence is often correct —
//      a temp file that will not delete is litter, an already-closed handle is
//      not news — and the difference between correct silence and a dropped
//      failure is a sentence saying which. Same shape as the scope map's
//      `global` entries: an exemption carries its reason or it is not one.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const MAIN = 'apps/desktop/src/main'
/** The sink itself: it IS the mechanism, so it holds the only correct swallows
 *  and the only place a record can fail with nowhere left to report. */
const SINK = new Set(['ops.ts', 'opsSink.ts'])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

const problems = []
let catches = 0
let handlers = 0
let consoles = 0

for (const file of walk(MAIN)) {
  const name = path.basename(file)
  const src = readFileSync(file, 'utf8')
  const lineOf = (index) => src.slice(0, index).split('\n').length

  // ——— 1 · registration goes through the wrapper
  for (const m of src.matchAll(/\bipcMain\.handle\(/g)) {
    // The wrapper's own call is the one that takes `channel`.
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 20)
    if (after.startsWith('channel')) continue
    problems.push(
      `${file}:${lineOf(m.index)}  ipcMain.handle registered directly — use handle(), which gives the call a correlation id and a duration`
    )
  }

  handlers += [...src.matchAll(/(?<![.\w])handle\(\s*\n?\s*IPC\./g)].length

  // ——— 2 · nothing writes to a terminal that is not there
  if (!SINK.has(name))
    for (const m of src.matchAll(/console\.(error|warn|log|info|debug)\(/g)) {
      const line = lineOf(m.index)
      // The SMOKE path is exempt BY NAME: under SMOKE there is a terminal — it
      // is CI — and the log lives in a directory the runner throws away.
      // Looks FORWARD as well as back. The smoke run's own summary line sits
      // further than 400 characters from the branch that gated it, so the
      // backward-only window missed it and the gate demanded that CI's one
      // legitimate terminal write be routed to a file CI throws away.
      const context = src.slice(Math.max(0, m.index - 400), m.index + 200)
      if (context.includes('process.env.SMOKE') || context.includes('SMOKE OK')) continue
      consoles++
      const advice =
        m[1] === 'error'
          ? 'use ops.failed(), which lands somewhere readable'
          : `use ops.record({ level: '${m[1] === 'warn' ? 'warn' : 'info'}' }) — a packaged app has no terminal for this to reach`
      problems.push(`${file}:${line}  console.${m[1]} in the main process — ${advice}`)
    }

  // ——— 3 · a catch records or explains
  if (SINK.has(name)) continue
  for (const m of src.matchAll(/\bcatch\s*(?:\(\s*\w+\s*\))?\s*\{/g)) {
    catches++
    const open = m.index + m[0].length
    let depth = 1
    let i = open
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
    }
    const body = src.slice(open, i - 1)
    const records = /\bops\.(failed|record)\(/.test(body)
    const explains = /\/\/|\/\*/.test(body)
    // A block that re-throws or converts to a typed refusal has already told
    // somebody; it is not silence.
    const speaks = /\bthrow\b|\breturn\s+\{[^}]*(ok|status|verdict|reason)/.test(body)
    if (!records && !explains && !speaks)
      problems.push(
        `${file}:${lineOf(m.index)}  a catch that neither records nor explains — call ops.failed(), or say in a comment why silence is right here`
      )
  }
}

if (problems.length) {
  console.error(`ops: ${problems.length} operation(s) that cannot be debugged\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `ops: ${handlers} IPC registrations through the wrapper, ${catches} catch blocks each recording or explaining, ` +
    `${consoles} console call(s) outside the SMOKE path`
)
