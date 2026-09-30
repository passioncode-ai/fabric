#!/usr/bin/env node
// No hook below a component's early return (S01).
//
// React compares the hooks a render calls against the previous render's list. A
// component that returns early on one render and falls through on the next runs
// MORE hooks the second time, and React throws — killing the window rather than
// showing anything.
//
// `Shell` had three early returns above a `useEffect` and a `useRef`, on exactly
// the transition the app makes at boot. THE CRASH WAS NOT REPRODUCED: three
// attempts to drive that transition in a test stalled on the boot stubs, and the
// app boots daily. So this is not a claim that it crashed — it is the invariant
// made enforceable, which is the only useful thing to do with a rule you cannot
// currently falsify by running it.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = 'apps/desktop/src/renderer/src'
const HOOK = /\buse(?:State|Effect|Memo|Ref|Callback|Reducer|Context)\s*\(/
const COMPONENT = /^(?:export )?function ([A-Z]\w*)\s*\(/

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const full = path.join(dir, e)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(e) && !e.includes('.test.')) out.push(full)
  }
  return out
}

const problems = []
let components = 0

for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let depth = 0
  let inComponent = null
  let earlyReturn = null

  for (const [i, line] of lines.entries()) {
    const start = COMPONENT.exec(line)
    if (start && depth === 0) {
      inComponent = start[1]
      earlyReturn = null
      components++
    }

    // A return at the component's own depth — not one inside a nested function,
    // a callback or a map. Those are ordinary control flow and say nothing.
    if (inComponent && depth === 1 && /^\s{2}(?:if \([^)]*\)\s*)?return\b/.test(line) && !/return \($/.test(line))
      earlyReturn ??= i + 1

    if (inComponent && depth === 1 && earlyReturn && HOOK.test(line))
      problems.push(
        `${file}:${i + 1}  a hook in ${inComponent} sits below the early return at line ${earlyReturn} — ` +
          `a render that returns early calls fewer hooks, and the next one throws`
      )

    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
    if (inComponent && depth <= 0) {
      inComponent = null
      earlyReturn = null
    }
  }
}

if (problems.length) {
  console.error(`hooks: ${problems.length} component(s) that can change their hook count between renders\n`)
  for (const p of problems) console.error('  ' + p)
  console.error('\nMove every early return BELOW the last hook. The returns are cheap to move; the crash is not cheap to debug.')
  process.exit(1)
}

console.log(`hooks: ${components} components, no hook below an early return`)
