// A filter as long as the data is a URL the gateway refuses.
//
// MEASURED 2026-09-10, and it arrived with no commit behind it. `chainAdvance`
// read every follows-link and then asked for the follower tasks with
// `.in('id', followerIds)`. At 294 ids that filter is 10 879 characters, and the
// gateway answers **HTTP 414 URI too long** — reproduced with curl against the
// live stack. The advancer read `.data ?? []`, so a refused request became "no
// followers are waiting", and unattended chains stopped advancing in silence.
// `ci.sh full` was green that morning and red that afternoon with nothing
// committed in between: the id list grows with the data, so the URL crosses the
// limit on its own, and the failure has no author and no date.
//
// It is the FOURTH appearance of one shape — FA-04, FA-03 and FA-02 each closed
// one — and the first where SIZE is the trigger. So the rule is structural: a
// list filter whose length the caller does not control goes through
// `store.selectIn`, which chunks it and RETURNS the error rather than an empty
// array. An inline array literal is fine: its length is written down.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const MAIN = path.join(root, 'apps/desktop/src/main')

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) files.push(full)
  }
}
walk(MAIN)

const problems = []
let checked = 0
let literals = 0

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((raw, i) => {
    // COMMENTS FIRST. The rule flagged its own explanation on the line that
    // documents the fix — a check matching the prose about itself, which is a
    // shape this repository has hit before and which reads exactly like a
    // finding until somebody looks at the line number.
    const line = raw.replace(/^\s*(\/\/|\*|\/\*).*$/, '')
    // `.in(` on a query builder. The second argument decides: an inline array
    // literal is a list somebody wrote, anything else is a list the data sized.
    const m = line.match(/\.in\(\s*(['"][^'"]+['"])\s*,\s*([^)]*)/)
    if (!m) return
    checked++
    const argument = m[2].trim()
    if (argument.startsWith('[')) {
      literals++
      return
    }
    // `selectIn`'s own implementation calls `.in` with a slice — that IS the
    // bounded read, and flagging it would mean the fix cannot be written.
    if (path.basename(file) === 'scopedStore.ts') return
    // A list bounded by a VOCABULARY rather than by the data. `memory.kinds`
    // and `memory.categories` come from a query the caller composed out of a
    // closed enum — a handful of values that cannot grow with the rows — so the
    // URL cannot cross the limit. Named one at a time, with the reason, rather
    // than by loosening the rule: an allowance that says why can be checked,
    // and a weaker pattern cannot.
    const BOUNDED_BY_A_VOCABULARY = ['q.kinds', 'q.categories']
    if (BOUNDED_BY_A_VOCABULARY.includes(argument)) {
      literals++
      return
    }
    problems.push(
      `${path.relative(root, file)}:${i + 1} — .in(${m[1]}, ${argument.slice(0, 40)}) filters by a list this ` +
        `code did not size. At 294 ids that URL is 10 879 characters and the gateway answers 414; ` +
        `\`.data ?? []\` then reads as an empty table. Use \`store.selectIn(table, columns, column, values)\`, ` +
        `which chunks the list and returns the error.`
    )
  })
}

if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' unbounded list read(s)')
  process.exit(1)
}
console.log(
  `list reads: ${checked} \`.in\` filter(s) in the main process, ${literals} of them lists written down, ` +
    `and none filtering by a list the data sized`
)
