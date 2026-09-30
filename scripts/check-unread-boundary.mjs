#!/usr/bin/env node
// A null collapsed at a door cannot be told from a measurement (M108, UXA-C05).
//
// `EstateHome` states the rule in its own props: "null until it has been read;
// the empty array is a MEASUREMENT". MEASURED at `ab3a42b`, the same two values
// reached three other surfaces through `sessions={sessions ?? []}` written at
// the CALL SITE — so downstream the third state did not exist:
//
//   * the estate agents view said "No agent is running anywhere in this estate"
//     inside an `EmptyState read`, on the first paint;
//   * the project agents panel already carried `read={sessions !== null}`, and
//     it could never be false, so its waiting line was unreachable copy;
//   * the status bar took a plain `number` and rendered "no agents running" for
//     zero — while the prop DIRECTLY BELOW it, `blocked`, is optional on purpose
//     because "a hardcoded zero renders as 'nothing is blocked', which is a
//     measurement nobody took".
//
// A type cannot forbid this: `TerminalSession[]` is assignable to
// `TerminalSession[] | null`, so widening the prop leaves the caller free to go
// on collapsing. The gap is in the CALLER, and the only cure for a gap in a
// caller is making it impossible to forget.
//
// COVERAGE, MEASURED 2026-09-11 by running it: every `.tsx` under
// `apps/desktop/src/renderer/` that is not a test — 43 files, three
// attribute-shaped collapses in the tree this gate was written against and none
// after them. WHAT IT DOES NOT
// CATCH, said rather than implied: a collapse written some other way — a
// variable defaulted before the JSX, `Array.isArray(x) ? x : []`, or a `||`
// instead of a `??`. It refuses the SHAPE this defect actually took three times
// in one file pair, and claims nothing about the shapes it has not seen.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = 'apps/desktop/src/renderer'
/** `name={ … ?? []}` as a JSX attribute value, parenthesised or not. */
const COLLAPSE = /(^|[\s])([a-zA-Z][\w]*)=\{\s*\(?\s*[\w.?[\]]+\s*\?\?\s*\[\]\s*\)?\s*\}/g

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(full)
  }
  return out
}

const files = walk(ROOT)
const problems = []
for (const file of files) {
  const src = stripComments(readFileSync(file, 'utf8'))
  for (const m of src.matchAll(COLLAPSE)) {
    const line = src.slice(0, m.index).split('\n').length
    problems.push(
      `${file}:${line}  \`${m[2]}={… ?? []}\` collapses a possibly-unread list at the door — ` +
        `downstream there is no third state, so "nothing yet" renders as "nothing"`
    )
  }
}

if (problems.length) {
  console.error(`unread-boundary: ${problems.length} collapsed prop(s) across ${files.length} files\n`)
  for (const p of problems) console.error('  ' + p)
  console.error(
    `\nPass the value through and widen the prop to \`T[] | null\`. Narrow ONCE inside the\n` +
      `component, where the distinction is rendered — not at the call site, where it is lost.`
  )
  process.exit(1)
}

console.log(
  `unread-boundary: ${files.length} renderer components, no list collapsed at a call site`
)
