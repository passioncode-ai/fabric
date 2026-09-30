// A control with no name is announced as "combo box" and nothing else.
//
// MEASURED 2026-09-10 (UX28-14). Thirty-three text-entry controls in the
// renderer; three had no accessible name:
//
//   the launch-option selector in `ProjectHome`'s Agents panel;
//   the same selector on the Tasks screen;
//   the move selector on a task card, which is the interesting one — its
//   placeholder OPTION describes the control while nothing is chosen and stops
//   describing it the moment something is, because a screen reader announces
//   the VALUE. A name is not a value.
//
// WRAPPING IS NOT THE IDIOM HERE and `components/Field.tsx` says why in its own
// header: "half the app's controls are `<select>`s inside grids where wrapping
// changes the layout — and a label that is not bound is a label a screen reader
// cannot use". So a control is named by a wrapping `<label>`, by `aria-label`,
// by `aria-labelledby`, or by an `id` a `<label htmlFor>` points at, which is
// what `Field` generates.
//
// WHAT THIS GATE IS NOT, and the card is explicit about it: UX28-14 excludes
// "accessibility PASS from static CSS, jsdom, axe alone". This proves that a
// control HAS a name. It proves nothing about whether the name is a good one,
// whether the reading order makes sense, whether focus goes anywhere sensible,
// or whether any of it works in a real screen reader. A person at a native
// runtime is the only thing that answers those, and this gate exists to stop
// them wasting that pass on a control that was never named at all.
//
// COMMENTS ARE STRIPPED FIRST. The measurement that found these three
// over-reported five, because two matches were `<select>` written in PROSE —
// including in the header of the very component that solves the problem.
//
// It reads files. It runs nothing, opens no browser and reads no credential.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from './lib/strip-comments.mjs'

const root = new URL('..', import.meta.url).pathname
const SRC = path.join(root, 'apps/desktop/src/renderer/src')

/** Comments out, line numbers preserved. */


/**
 * The attribute text of one JSX tag, from just after its name to the `>` that
 * closes it — counting only a `>` outside braces, quotes and parentheses.
 */
function attributesOf(text, from) {
  let depth = 0
  let quote = null
  for (let i = from; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{' || ch === '(') depth++
    else if (ch === '}' || ch === ')') depth--
    else if (ch === '>' && depth === 0) return text.slice(from, i)
  }
  return text.slice(from)
}

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) files.push(full)
  }
}
walk(SRC)

const problems = []
let controls = 0
let named = 0

for (const file of files) {
  const where = path.relative(root, file)
  const text = stripComments(readFileSync(file, 'utf8'))
  for (const m of text.matchAll(/<(input|select|textarea)\b/g)) {
    const tag = m[1]
    // THE TAG'S REAL END, not the first `>`. A JSX attribute value holds
    // arbitrary expressions and `onChange={(e) => …}` contains a `>`, so a
    // non-greedy match to the first one truncates the attribute list — and this
    // gate's first version did exactly that, reporting two controls as unnamed
    // whose `aria-label` sat AFTER the handler. A check that cries wolf is
    // worse than no check: it teaches the next reader to skip it.
    const attrs = attributesOf(text, m.index + m[0].length)
    // A checkbox or radio takes its name from the text beside it, which this
    // check cannot read and a person can.
    if (/type="(checkbox|radio|hidden)"/.test(attrs)) continue
    controls++
    const hasName =
      /aria-label[=\s]/.test(attrs) || /aria-labelledby[=\s]/.test(attrs) || /\bid=/.test(attrs)
    const before = text.slice(0, m.index)
    const wrapped = before.lastIndexOf('<label') > before.lastIndexOf('</label>')
    if (hasName || wrapped) {
      named++
      continue
    }
    problems.push(
      `${where}:${before.split('\n').length} a <${tag}> with no accessible name — no wrapping ` +
        `<label>, no aria-label, no aria-labelledby, and no id for a label to point at. A screen ` +
        `reader announces its VALUE and nothing about what it selects. Bind it through ` +
        `components/Field.tsx, or give it aria-label={t('…')}.`
    )
  }
}

console.log(`  ok   ${controls} text-entry control(s) inspected, ${named} named`)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' control(s) a screen reader cannot introduce')
  process.exit(1)
}
console.log('control names: every text-entry control has an accessible name — NOT an accessibility pass')
