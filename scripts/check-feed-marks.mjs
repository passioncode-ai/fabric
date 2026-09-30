// A counter that stops counting is a change signal that stops signalling.
//
// The renderer keeps the last 500 events for display (`App.tsx`, the `slice`
// below is read by this gate rather than quoted from memory). That cap is
// correct — a panel does not need ten thousand rows. What is NOT correct is
// deriving "something happened" from the length of that array: after the
// five-hundredth event the length never changes again, so every reader watching
// it freezes for the rest of the session, and nothing looks broken. The panels
// keep rendering, the numbers just stop.
//
// MEASURED TWICE. M42 moved `ProjectHome` off `feed.length` after its claims,
// statistics and repository panels stopped refreshing; UX28-02 found the same
// line still in `EstateHome`, where the estate Board and the attention count
// froze the same way. Two occurrences of one shape is the point at which this
// repository writes a script instead of a third ledger row.
//
// THE RULE. A change signal comes from `FeedMarks` — the journal's own `seq`,
// which is monotonic and knows nothing about a display cap. Reading
// `feed.length` to RENDER something ("no events yet") is fine and stays legal:
// the defect is not the expression, it is the expression used as a trigger.
// So this gate looks in the two places a trigger lives — a hook's dependency
// array, and a prop whose name says it is a mark.
//
// It reads files. It runs nothing and needs no network.

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const RENDERER = path.join(root, 'apps/desktop/src/renderer/src')

const problems = []
const notes = []

// ── the cap this whole rule exists because of ──────────────────────────────
//
// Read, not remembered. If the cap were ever removed the rule's REASON changes,
// and a gate enforcing a rule whose reason it can no longer find is a gate
// nobody can argue with.
const app = readFileSync(path.join(RENDERER, 'App.tsx'), 'utf8')
const cap = app.match(/setFeed\([^\n]*\.slice\(-(\d+)\)\)/)
if (!cap) problems.push('App.tsx no longer caps the feed in a shape this gate can read — this gate has lost its premise')
else notes.push(`the display feed is capped at ${cap[1]} events, which is why a length is not a change signal`)

// ── the files ──────────────────────────────────────────────────────────────
const files = readdirSync(RENDERER)
  .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
  .sort()

let deps = 0
let renders = 0

for (const file of files) {
  const text = readFileSync(path.join(RENDERER, file), 'utf8')
  const lines = text.split('\n')

  lines.forEach((raw, i) => {
    // COMMENTS FIRST, and this gate is the reason to keep saying so: three of
    // the files below explain the defect IN PROSE, on a line containing the
    // exact expression. A check that matches its own documentation reads as a
    // finding right up until somebody opens the line.
    if (/^\s*(\/\/|\*|\/\*)/.test(raw)) return
    const line = raw.replace(/\/\/.*$/, '')
    const where = `${path.relative(root, path.join(RENDERER, file))}:${i + 1}`

    // A hook's dependency array. `}, [ … ])` on one line covers every hook in
    // this renderer; a multi-line dependency array would slip past, so the
    // shape is asserted below rather than assumed.
    const dep = line.match(/\},\s*\[([^\]]*)\]\)/)
    if (dep) {
      deps++
      if (/\bfeed\b/.test(dep[1]) && /\.length/.test(dep[1]))
        problems.push(
          `${where} — a hook re-runs on \`${dep[1].trim()}\`, and that length stops changing at the display cap. ` +
            `After the cap this effect never fires again and the panel silently freezes. Depend on a \`FeedMarks\` ` +
            `field instead: \`marks.all\`, or \`markOf(marks, [families])\` for one kind of news.`
        )
      return
    }

    // A prop that says it is a mark, fed a length.
    const mark = line.match(/\b(\w*[Mm]ark)=\{([^}]*)\}/)
    if (mark && /\bfeed\b/.test(mark[2]) && /\.length/.test(mark[2]))
      problems.push(
        `${where} — \`${mark[1]}\` is given \`${mark[2].trim()}\`. A mark is the journal's own sequence; a capped ` +
          `array's length is not one, and it stops moving at the cap. Pass \`markOf(marks, [families])\`.`
      )

    // Rendering off the length is legal and counted, so the gate's own numbers
    // show it is not simply banning the expression.
    if (/\bfeed\??\.length/.test(line) && !dep && !mark) renders++
  })
}

notes.push(`${deps} dependency array(s) read across ${files.length} renderer component(s)`)
notes.push(`${renders} legal use(s) of a feed length to render, which this rule does not touch`)

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' change signal(s) taken from a capped length')
  process.exit(1)
}
console.log('feed marks: no renderer derives "something happened" from a length that stops changing at the cap')
