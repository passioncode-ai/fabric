#!/usr/bin/env node
// The ratchet under S02.a: a query in the main process reaches one estate.
//
// The unit tests prove the scope map matches the schema and that the predicates
// come out right. They cannot prove that the NEXT query written goes through the
// store — and that is the failure this whole slice is about. Eighty-seven
// queries omitted the estate predicate not because anyone decided to, but
// because omitting it was shorter.
//
// So: a raw `.from('table')` in `main/` must carry an estate predicate in the
// same statement, or it fails here. Going through the scoped store satisfies it
// by construction, which is the point — the short way and the safe way are now
// the same way.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const MAIN = 'apps/desktop/src/main'
/** The store IS the mechanism; it necessarily holds the only naked `.from()`. */
const EXEMPT = new Set(['scopedStore.ts'])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.ts') && !EXEMPT.has(entry)) out.push(full)
  }
  return out
}

const offences = []
let checked = 0

for (const file of walk(MAIN)) {
  const src = readFileSync(file, 'utf8')
  const from = /\.from\('([a-z_]+)'\)/g
  for (let m = from.exec(src); m; m = from.exec(src)) {
    checked++
    // The statement, approximated as the text up to the next `.from(` or a
    // blank line — far enough to hold the chained filters, short enough not to
    // borrow a predicate from the query after it.
    let tail = src.slice(m.index + m[0].length, m.index + m[0].length + 500)
    const next = tail.indexOf(".from('")
    if (next > 0) tail = tail.slice(0, next)
    const blank = tail.indexOf('\n\n')
    if (blank > 0) tail = tail.slice(0, blank)
    if (!tail.includes('estate_id')) {
      const line = src.slice(0, m.index).split('\n').length
      offences.push(`${file}:${line}  .from('${m[1]}') carries no estate predicate`)
    }
  }
}

if (offences.length) {
  console.error(`scope: ${offences.length} of ${checked} raw queries reach every estate\n`)
  for (const o of offences) console.error('  ' + o)
  console.error(
    `\nUse the scoped store — \`store.select('${'<table>'}', '<columns>')\` — which applies the\n` +
      `predicate from apps/desktop/src/shared/scope.ts, or state the predicate in the query.`
  )
  process.exit(1)
}

// ————————————————————————————————————————————— the other half of the boundary
//
// The app is not the only thing that writes projections. The PROJECTOR does, and
// it matched rows by a bare uuid taken from an event payload — proven by moving
// one estate's task from another estate's event (ADR-0049). "The writer
// validated the id" is not the floor: under ADR-0014 a rebuild replays a
// journal with no writer present at all.

const MIGRATIONS = 'supabase/migrations'
const DOLLARS = '$'.repeat(2)

/** Each `create or replace function apply_X(e journal) … $$;`, latest wins. */
function projectorFunctions() {
  const found = new Map()
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const src = readFileSync(path.join(MIGRATIONS, file), 'utf8')
    const head = /create or replace function (apply_\w+)\(e journal\)/g
    for (let m = head.exec(src); m; m = head.exec(src)) {
      const open = src.indexOf(`as ${DOLLARS}`, m.index)
      if (open < 0) continue
      const bodyAt = open + DOLLARS.length + 3
      const close = new RegExp(`\\${'$'}\\${'$'}\\s*(?:language\\s+\\w+\\s*)?;`).exec(src.slice(bodyAt))
      if (!close) continue
      found.set(m[1], { file, block: src.slice(m.index, bodyAt + close.index + close[0].length) })
    }
  }
  return found
}

const withoutComments = (text) => text.replace(/--[^\n]*/g, '')

/** Statement boundaries, ignoring a semicolon that lives inside a line comment —
 *  the projector's own prose contains several, and splitting on the first `;`
 *  puts the predicate inside a sentence. */
function* mutations(block) {
  const head = /\n\s*(update|delete from)\s+\w+/g
  for (let m = head.exec(block); m; m = head.exec(block)) {
    let from = head.lastIndex
    for (;;) {
      const semi = block.indexOf(';', from)
      if (semi < 0) return
      const lineStart = block.lastIndexOf('\n', semi)
      if (block.slice(lineStart, semi).includes('--')) {
        from = semi + 1
        continue
      }
      yield { start: m.index, end: semi }
      break
    }
  }
}

const projectorOffences = []
let statements = 0

for (const [name, { file, block }] of projectorFunctions()) {
  for (const { start, end } of mutations(block)) {
    statements++
    const statement = withoutComments(block.slice(start, end))
    if (!statement.includes('estate_id')) {
      const line = block.slice(0, start).split('\n').length
      const verb = /\n\s*(update|delete from)\s+(\w+)/.exec(block.slice(start))
      projectorOffences.push(
        `${MIGRATIONS}/${file}  ${name} +${line}  ${verb?.[1]} ${verb?.[2]} matches without an estate predicate`
      )
    }
  }
}

if (projectorOffences.length) {
  console.error(
    `scope: ${projectorOffences.length} of ${statements} projector statements reach every estate\n`
  )
  for (const o of projectorOffences) console.error('  ' + o)
  console.error(
    `\nAdd \`and estate_id = e.estate_id\` to the statement. A projection is derived,\n` +
      `so a rebuild replays the journal with nobody left to have validated the id.`
  )
  process.exit(1)
}

console.log(
  `scope: ${checked} raw queries in ${MAIN} and ${statements} projector statements, every one narrowed to an estate`
)
