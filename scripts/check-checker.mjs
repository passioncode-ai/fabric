#!/usr/bin/env node
// A proposal is written through the checker, or it is not written (M168).
//
// MEASURED BEFORE THE CHECKER EXISTED: two entry points appended proposal
// events and they validated different things. `agentSurface.ts` asked
// `mayChain` and nothing else; `index.ts` asked "does it exist and is it
// undecided", then created a task in a project it never checked was still
// there. Neither shared a line of validation, and a third entry point added
// tomorrow would share nothing with either.
//
// THIS IS THE PART A COMMENT CANNOT HOLD. "All proposal writes go through the
// checker" is true for exactly as long as everyone remembers, and the moment it
// stops being true is the moment nobody notices — because the bypass looks like
// ordinary code that works. ADR-0049's form: a boundary is held by a mechanism.
//
// The gate is deliberately narrow. It does not try to know whether the checker
// is CORRECT; it knows only that nothing else appends these event types.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const MAIN = 'apps/desktop/src/main'
/** The one module allowed to write them, and the shared rules it applies. */
const OWNER = path.join(MAIN, 'commands')
/** Event types that may only be appended from the owner. */
const GUARDED = ['proposal.filed@1', 'proposal.decided@1']

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
let writes = 0

for (const file of walk(MAIN)) {
  const src = readFileSync(file, 'utf8')
  const lineOf = (i) => src.slice(0, i).split('\n').length
  for (const type of GUARDED) {
    for (const m of src.matchAll(new RegExp(`type:\\s*'${type.replace('.', '\\.')}'`, 'g'))) {
      writes++
      if (file.startsWith(OWNER)) continue
      problems.push(
        `${file}:${lineOf(m.index)}  appends ${type} outside ${OWNER}/ — every proposal write goes through the ` +
          `checker, or the rules it applies are whatever this call site happened to remember`
      )
    }
  }
}

if (writes === 0)
  problems.push(
    `no guarded proposal write found anywhere. Either the vocabulary moved and this gate is now checking a ` +
      `type nobody appends — which passes forever and proves nothing — or the feature was removed.`
  )

if (problems.length) {
  console.error(`checker: ${problems.length} proposal write(s) that bypass the checker\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(`checker: ${writes} proposal write(s), all inside ${OWNER}/`)
