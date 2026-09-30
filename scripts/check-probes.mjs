#!/usr/bin/env node
// A probe whose script lives in a template literal may not contain a backtick.
//
// WHY THIS IS A GATE AND NOT A COMMENT. Several probes in `apps/desktop/test`
// build the code under test as a string and run it in a child process. That
// string is a TEMPLATE LITERAL, so a backtick anywhere inside it — including in
// a comment — ends the literal and produces a syntax error far from the edit
// that caused it.
//
// It happened four times in one run. The fourth was in a file that already
// carried a warning about it, written by the same author, two edits earlier. A
// prose warning inside a file does not survive contact with the next command
// somebody types; a check that fails does.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const dir = path.join(import.meta.dirname, '..', 'apps', 'desktop', 'test')
let failures = 0

for (const name of readdirSync(dir).filter((n) => n.endsWith('.mjs'))) {
  const text = readFileSync(path.join(dir, name), 'utf8')
  const open = text.indexOf('const script = `')
  if (open === -1) continue
  const body = text.slice(open + 'const script = `'.length)
  const close = body.indexOf('\n`\n')
  if (close === -1) {
    console.log(`  FAIL ${name}: the script template is never closed`)
    failures++
    continue
  }
  const script = body.slice(0, close)
  const lines = script.split('\n')
  lines.forEach((line, i) => {
    // An ESCAPED backtick is fine; a bare one ends the literal.
    const bare = line.replace(/\\`/g, '')
    if (bare.includes('`')) {
      console.log(`  FAIL ${name}:${i + 2} a bare backtick inside the script template: ${line.trim().slice(0, 70)}`)
      failures++
    }
  })
}

if (failures > 0) {
  console.log(`\n${failures} probe template problem(s) — a backtick inside the template ends it`)
  process.exit(1)
}
console.log('ok: no probe script template contains a bare backtick')
