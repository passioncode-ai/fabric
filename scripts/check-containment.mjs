#!/usr/bin/env node
// A mode that removes the runner's gate says so (FA-09).
//
// WHY A SCRIPT. `containment` is declared per permission mode rather than derived
// from the flags, because a runner whose bypass is spelled differently would
// read as contained. A declaration nothing checks is a comment: the next mode
// added with `--yolo` in its args and `runner-gated` beside it would be believed,
// and Fabric would authorise a floored effect for something with no gate at all.
//
// THREE RULES, and the second is the one that matters.
//
//   1. Every permission mode declares its containment. A missing declaration is
//      not a default; it is a mode nobody decided about.
//   2. A mode carrying a known bypass flag is declared `none`. The flags are
//      named in `containment.ts` so a new one arrives deliberately rather than
//      inside an args array nobody reads. A flag followed by the value 'false'
//      switches the bypass off (`--auto-approve false`), and is not one.
//   3. A mode whose session config allows every tool (`'*': 'allow'`, the way a
//      `config-content-env` runner such as Kilo is ungated, ADR-0119) is declared
//      `none` too: its gate lives in the config, not in a flag.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const AGENTS = 'apps/desktop/src/shared/agents.ts'
const CONTRACT = 'apps/desktop/src/shared/containment.ts'

const src = readFileSync(path.join(ROOT, AGENTS), 'utf8')
const contract = readFileSync(path.join(ROOT, CONTRACT), 'utf8')

const flags = [...contract.matchAll(/'(--[a-z-]+)'/g)].map((m) => m[1])
if (!flags.length) {
  console.error(`${CONTRACT}  names no bypass flags, so rule 2 checks nothing`)
  process.exit(1)
}

const problems = []
// Each mode is one object literal inside a `permissionModes` array. Matched by
// its `id:` and read to the closing brace of that entry.
const modes = [...src.matchAll(/\{\s*id:\s*'([^']+)',\s*labelKey:\s*'agent\.mode\.[^']+'[\s\S]*?\n?\s*\}/g)]
if (modes.length === 0) problems.push(`${AGENTS}  no permission mode was found; this gate is reading nothing`)

for (const m of modes) {
  const body = m[0]
  const id = m[1]
  const line = src.slice(0, m.index).split('\n').length
  const declared = /containment:\s*'([a-z-]+)'/.exec(body)?.[1]
  if (!declared)
    problems.push(
      `${AGENTS}:${line}  mode '${id}' declares no containment. A missing declaration is not a ` +
        `default — it is a mode nobody decided about, and the floor would treat it as decided.`
    )
  else if (/'\*':\s*'allow'/.test(body) && declared !== 'none')
    problems.push(
      `${AGENTS}:${line}  mode '${id}' carries a session config that allows every tool ('*': 'allow') ` +
        `and declares '${declared}'. A runner told through its config (ADR-0119) has its gate in that ` +
        `config, and this one has none.`
    )
  // A flag given the value `'false'` turns the bypass OFF: Cline's Ask mode is `--auto-approve false`,
  // because Cline 3.0.46 auto-approves by default (audit 2026-10-06 UX-1). Any other use is a bypass.
  else if (flags.some((f) => new RegExp(`'${f}(?!=false')(?:=[^']*)?'(?!\\s*,\\s*'false')`).test(body)) && declared !== 'none')
    problems.push(
      `${AGENTS}:${line}  mode '${id}' carries a bypass flag and declares '${declared}'. ` +
        `Nothing stands between that mode and the world, and a floored effect authorised for it ` +
        `authorises the asking rather than the doing.`
    )
}

if (problems.length) {
  console.error(`containment: ${problems.length} mode(s) whose gate is not what they say\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `containment: ${modes.length} permission mode(s) declare what stands between them and the world, ` +
    `and every bypass flag (${flags.join(', ')}) is declared as none`
)
