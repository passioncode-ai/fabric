// A grid with three children and two tracks is a layout nobody declared.
//
// MEASURED 2026-09-10 (UX28-14). `.project-columns` declares two tracks —
// `minmax(0, 1.6fr) minmax(300px, 1fr)` — and two screens use it:
//
//   `ProjectHome` renders TWO children, `col-main` then `col-side`, and works.
//   `EstateAgents` renders THREE, `col-side` `col-main` `col-side`.
//
// So on the estate agents screen the session LIST gets the wide 1.6fr track,
// the console gets the narrow one, and the third panel wraps to a second row.
// The card names this exact target ("estate three-child/two-column grid").
//
// AND THE CLASS NAMES DO NOTHING. `col-main` and `col-side` have no rule in any
// stylesheet: placement is positional, so `ProjectHome` is correct BY ACCIDENT
// — its order happens to match the names — while the names actively tell a
// reader that placement is controlled when it is not. That is the worse half:
// a wrong layout gets noticed, a misleading name gets trusted.
//
// WHAT THIS GATE IS NOT. It is a STRUCTURAL check on arity, and UX28-14's
// exclusion is explicit: no accessibility PASS from static CSS. It proves that
// a declared grid has as many tracks as the screen puts children into it, and
// nothing at all about how any of it looks, reads aloud, or behaves at 375
// pixels. Those need a person at a real runtime.
//
// A SECOND RULE, same subject: a declaration that disagrees with reality. A
// grid with a fixed track count and no narrow-width collapse gives each column
// `width / n` at every width — `.board` was `repeat(4, minmax(0, 1fr))` with no
// media query anywhere in `components.css`, so at the 375-wide target this card
// names each column got about 85 pixels. Either the tracks collapse below a
// declared breakpoint, or the grid sizes itself with `auto-fit`; a fixed grid
// that does neither is a layout that was only ever looked at wide.
//
// It reads files. It runs nothing and needs no browser.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const SRC = path.join(root, 'apps/desktop/src/renderer/src')

/**
 * Count the tracks a `grid-template-columns` value declares.
 *
 * `repeat(N, …)` IS EXPANDED, and it took a plant to notice: the first version
 * split on whitespace at brace depth zero, so `repeat(4, minmax(0, 1fr))` was
 * one token and the gate reported "1 fixed track" for a four-column board. The
 * failure was correct and its number was not — and a gate that prints a wrong
 * number is one the next reader stops believing.
 */
function trackCount(value) {
  const repeat = /^repeat\(\s*(\d+)\s*,([\s\S]*)\)$/.exec(value.trim())
  if (repeat) return Number(repeat[1]) * trackCount(repeat[2])
  let depth = 0
  let current = ''
  const tracks = []
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (/\s/.test(ch) && depth === 0) {
      if (current) tracks.push(current)
      current = ''
    } else current += ch
  }
  if (current) tracks.push(current)
  return tracks.length
}

/** Grid classes and how many tracks each declares, from the stylesheets. */
const declared = new Map()
/** Fixed-arity classes that DO collapse somewhere, by class name. */
const collapses = new Set()
for (const file of readdirSync(SRC).filter((n) => n.endsWith('.css'))) {
  const css = readFileSync(path.join(SRC, file), 'utf8')
  // Only rules OUTSIDE a media query count as the base arity: a narrow-screen
  // collapse to `1fr` is the point, not a mismatch.
  const base = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  for (const m of base.matchAll(/\.([a-z0-9-]+)\s*\{([^}]*)\}/gi)) {
    const rule = m[2]
    const cols = /grid-template-columns\s*:\s*([^;]+)/.exec(rule)
    if (!cols) continue
    const value = cols[1].trim()
    // `auto-fill`/`auto-fit` grids size themselves; arity is not fixed.
    if (/auto-fill|auto-fit/.test(value)) continue
    // `order` is the declaration's position, because an element carrying two
    // grid classes gets the LAST one at equal specificity — which is how a
    // three-track template is layered onto the two-track base.
    declared.set(m[1], { tracks: trackCount(value), value, where: `${file}`, order: declared.size })
  }
}

// Which fixed-arity classes are answered inside a media query — a collapse.
for (const file of readdirSync(SRC).filter((n) => n.endsWith('.css'))) {
  const css = readFileSync(path.join(SRC, file), 'utf8')
  for (const block of css.matchAll(/@media[^{]*\{([\s\S]*?)\n\}/g))
    for (const rule of block[1].matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/grid-template-columns/.test(rule[2])) continue
      // EVERY class in the selector list, not the first. Reading only the
      // first added `.project-columns` and missed `.project-columns-3` on the
      // line below it, so a grid that DOES collapse was reported as one that
      // never had been.
      for (const cls of rule[1].matchAll(/\.([a-z0-9-]+)/g)) collapses.add(cls[1])
    }
}

const problems = []
const notes = [`${declared.size} fixed-arity grid class(es) declared`]

for (const [cls, spec] of declared)
  if (!collapses.has(cls))
    problems.push(
      `\`.${cls}\` declares ${spec.tracks} fixed track(s) (${spec.value}) in ${spec.where} and no ` +
        `media query answers it, so every viewport gets the same ${spec.tracks} columns — about ` +
        `${Math.floor(375 / spec.tracks)} css pixels each at the 375-wide target. Collapse it below a ` +
        `breakpoint, or size it with auto-fit.`
    )

/** Every `.tsx` under the renderer. */
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) files.push(full)
  }
}
walk(SRC)

let checked = 0
for (const file of files) {
  const where = path.relative(root, file)
  const text = readFileSync(file, 'utf8')
  // Every element whose class list names at least one declared grid class.
  for (const use of text.matchAll(/className="([^"]*)"/g)) {
    const names = use[1].split(/\s+/).filter((n) => declared.has(n))
    if (names.length === 0) continue
    // THE CASCADE, modelled rather than assumed: at equal specificity the last
    // declaration wins, so an element carrying `project-columns
    // project-columns-3` is a three-track grid. Taking the first match instead
    // reported the base template and called a corrected layout broken.
    const cls = names.reduce((a, b) => (declared.get(b).order > declared.get(a).order ? b : a))
    const spec = declared.get(cls)
    {
      const after = text.slice(use.index)
      const kids = [...after.matchAll(/className="(col-[a-z]+)"/g)]
      if (kids.length === 0) continue
      // Children of THIS grid: the run of `col-*` before the next grid opens.
      const nextGrid = after.slice(1).search(/className="[^"]*project-columns/)
      const limit = nextGrid === -1 ? after.length : nextGrid + 1
      const mine = kids.filter((k) => k.index < limit)
      checked++
      if (mine.length !== spec.tracks)
        problems.push(
          `${where} puts ${mine.length} child(ren) into \`.${cls}\`, which declares ${spec.tracks} ` +
            `track(s) (${spec.value}) in ${spec.where}. The extra child wraps to a new row and the ` +
            `tracks are assigned by POSITION — the \`col-*\` names have no rule anywhere, so they ` +
            `describe an intent the stylesheet does not carry. Declare a template with as many ` +
            `tracks as the screen uses.`
        )
    }
  }
}

notes.push(`${checked} grid usage(s) checked for arity`)

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' grid declaration(s) that disagree with reality')
  process.exit(1)
}
console.log(
  'grids: every fixed-arity grid has as many tracks as its screens put children into it, and collapses at narrow widths'
)
