// A field written on every path and read on none.
//
// FIVE TIMES IN THIRTY-EIGHT ITERATIONS, and each time it looked like finished
// work — a declared field, a documented reason, and no reader:
//
//   UX28-15  `docs/ux/lint.py` asked exactly the questions the cycle was
//            answering by hand, and no gate invoked it.
//   UX28-11  `projects.config_revision` was a real CAS token and no command
//            carried it, so a stale write could not be refused.
//   UX28-12  M168 widened `proposals.decide` to return the checker's receipt —
//            "a reason code, what to do about it, and whether trying again
//            could ever work" — and the only caller wrote `void … .catch()`.
//   AX-02    `session_heartbeats.waiting_kind` and `waiting_id` were SELECTED
//            by the widget's query and dropped before the derivation, so the
//            branch that expires a resolved wait was unreachable.
//   AX-05    `Focus.returnTo` records the route to come back to on every
//            navigation, with a comment explaining why — and nothing reads it,
//            because there is no Back.
//
// The shape is worse than an absent feature, because an absent feature
// announces itself. A field with a name, a type and a paragraph of reasoning
// reads as capability to everyone downstream, including the next author, who
// builds on it.
//
// WHAT COUNTS AS A READER, deliberately generous: `x.field`, a destructuring
// `{ field }`, an index `['field']`, or a mention inside a SQL-ish column list.
// A field is reported only when NONE of those appears anywhere in the tree
// outside its own declaration. Generosity is the point: this gate exists to
// catch five specific holes, not to police style, and a false positive would
// cost more than the sixth hole.
//
// It reads files. It runs nothing.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const SRC = path.join(root, 'apps/desktop/src')

/** Fields whose absence of a reader is DELIBERATE, each with its reason. */
const ALLOWED = new Map([
  // Written to the wire and read by the database, not by TypeScript.
  ['schemaRev', 'the journal writes it; the projector reads it in SQL'],
  ['occurredAt', 'the journal writes it; every projector arm reads it in SQL']
])

/**
 * THE DEBT AT THE MOMENT THIS GATE WAS LAID, and it may only shrink.
 *
 * A gate that arrives red on twenty-nine pre-existing entries is a gate
 * somebody switches off, so the existing ones are a baseline and only a NEW
 * one fails. And the ratchet turns both ways: a baseline entry that has since
 * gained a reader must be STRUCK, or the debt would look paid while growing —
 * the same rule `ru-baseline.txt` holds for translations.
 */
const baselineFile = path.join(root, 'scripts/written-never-read-baseline.txt')
const baseline = new Set(
  readFileSync(baselineFile, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
)

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx|mjs)$/.test(entry)) files.push(full)
  }
}
walk(SRC)
// AND THE GATES (AX-10). Measured 2026-09-11: this walk read only
// `apps/desktop/src`, so a field read by a gate script was reported as read by
// nothing — the third blind spot found in this fence, after nested interfaces
// and the name-collision one. A gate that REFUSES a run on a field's value is a
// stronger consumer than a screen that renders it: it fires. Widening can only
// ADD readers, so the baseline can only shrink, and every entry it strikes is
// one a command can be pointed at.
walk(path.join(root, 'scripts'))

/**
 * Is this field named in a column list, rather than merely appearing inside
 * some string?
 *
 * `.select('tasks', 'id,project_id,claim')` reads three columns and no property
 * access exists for them, which is why the rule has to look at strings at all.
 * The discipline is that a LIST has a comma — or the literal is exactly the
 * column, as a single-column select writes it.
 */
function columnList(field, everything) {
  const re = new RegExp(`['"\`]([\\w,.\\s]*\\b${field}\\b[\\w,.\\s]*)['"\`]`, 'g')
  for (const m of everything.matchAll(re)) {
    const literal = m[1]
    if (literal.includes(',') || literal.trim() === field) return true
  }
  return false
}

/** Every file's text, comments stripped so prose cannot stand in for a reader. */
const text = new Map()
for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  const noBlocks = raw
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  text.set(
    f,
    noBlocks
      .split('\n')
      .map((l) => (l.trim().startsWith('//') ? '' : l.replace(/\/\/.*$/, '')))
      .join('\n')
  )
}

/**
 * THE PRODUCT'S OWN TEXT, tests excluded — and the gate's first version did not
 * exclude them, which made it miss the instance that motivated it.
 * `Focus.returnTo` is asserted in `appRoute.test.ts` and read nowhere else, so
 * counting that as a reader let the gate pass a field whose only consumer was
 * the assertion that it had been written.
 *
 * That is M113's finding word for word: "nothing breaks, nothing throws, and a
 * unit test on the reader stays green". A field read only by a test is not a
 * field the product uses.
 */
const everything = [...text.entries()]
  .filter(([f]) => !f.includes('.test.'))
  .map(([, t]) => t)
  .join('\n')

/** Interfaces declared in `shared/`, which is where the contracts live. */
const problems = []
const notes = []
/** Baseline entries that now HAVE a reader, and must be struck. */
const paidOff = []
/** Every field with no reader, baseline or not — so the count is honest. */
const unread = new Set()
let fields = 0

for (const f of files) {
  if (!f.includes('/shared/') || f.includes('.test.')) continue
  const body = text.get(f)
  for (const m of body.matchAll(/export interface (\w+)\s*\{([^}]*)\}/g)) {
    const [, name, block] = m
    for (const fm of block.matchAll(/^\s*(\w+)\??\s*:/gm)) {
      const field = fm[1]
      if (ALLOWED.has(field)) continue
      fields++
      const read =
        new RegExp(`\\.${field}\\b`).test(everything) ||
        new RegExp(`\\[['"\`]${field}['"\`]\\]`).test(everything) ||
        // A destructuring read: the bare name inside braces on a line that
        // assigns or declares from something.
        new RegExp(`(const|let|var|\\()\\s*\\{[^}]*\\b${field}\\b[^}]*\\}\\s*(=|\\)|:)`).test(everything) ||
        // A COLUMN LIST handed to the store — which is what this rule is for,
        // and until AX-10 it did not say so: any string literal containing the
        // name counted, so prose in a gate ("canonical scenarios") read as a
        // consumer of `Fixture.scenario`. Measured when widening the corpus to
        // the gates produced two false strikes among nine. A list has a comma,
        // or the literal is the column itself.
        columnList(field, everything)
      const key = `${name}.${field}`
      if (!read && !baseline.has(key))
        problems.push(
          `${path.relative(root, f)}: \`${key}\` is declared and WRITTEN, and nothing reads it. ` +
            `A field with a name, a type and a reason reads as capability to everyone downstream — including ` +
            `the next author, who builds on it. Give it a reader, or delete it.`
        )
      if (read && baseline.has(key)) paidOff.push(key)
      if (!read) unread.add(key)
    }
  }
}

notes.push(`${fields} declared field(s) in shared contracts checked for a reader`)
notes.push(`${unread.size} without one, ${baseline.size} of them in the shrinking baseline`)

// A baseline entry that gained a reader must leave the file. Otherwise the
// debt reads as paid while it grows underneath.
if (paidOff.length)
  problems.push(
    `${paidOff.length} baseline entr(ies) now HAVE a reader — the ratchet only shrinks, so strike them ` +
      `from scripts/written-never-read-baseline.txt: ${paidOff.join(', ')}`
  )

// And an entry naming a field that no longer exists is a stale line pretending
// to be debt.
const declared = new Set()
for (const f of files) {
  if (!f.includes('/shared/') || f.includes('.test.')) continue
  for (const m of text.get(f).matchAll(/export interface (\w+)\s*\{([^}]*)\}/g))
    for (const fm of m[2].matchAll(/^\s*(\w+)\??\s*:/gm)) declared.add(`${m[1]}.${fm[1]}`)
}
const ghosts = [...baseline].filter((k) => !declared.has(k))
if (ghosts.length)
  problems.push(
    `${ghosts.length} baseline entr(ies) name a field that no longer exists: ${ghosts.join(', ')}`
  )

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' field(s) written and never read')
  process.exit(1)
}
console.log('written-never-read: every declared field in a shared contract has a reader')
