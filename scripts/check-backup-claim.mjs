// The mirror may not be sold as a backup (AX-12).
//
// `storageContract.ts` states the rule in the repository's own words, on the
// `goals` row: "NOT REBUILDABLE from the two mirrored files, and not carried —
// this is the largest gap in the mirror and the reason it may not be called a
// backup". Two of thirty-odd tables are carried; goals, tasks, questions and
// routines are not among them.
//
// MEASURED at `ade0954`: the onboarding sentence said "Without one there is no
// backup and no version history", which grants one by implication — an operator
// who keeps a folder believing it protects them, or declines one because they
// already have backups, decides on the product's word. One string of 577 said
// it, and nothing stopped a second.
//
// WHAT THIS REFUSES is the PROMISE, not the word: "it is not a backup" is
// exactly the sentence that should be there, and a rule that banned the noun
// would forbid the correction along with the defect. So the shapes below are
// the ones that grant.
//
// COVERAGE, stated rather than implied: it reads the two operator-facing string
// registries — 577 keys in `en.ts` and the Russian ones beside them — and
// nothing else. A promise made in a component's inline text, in a document, or
// in a dialog composed in the main process is OUT OF ITS REACH. It is a narrow
// fence over the place the defect was found, not a proof about the product.
//
// It reads files. It runs nothing and needs no network.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const REGISTRIES = [
  'apps/desktop/src/renderer/src/i18n/en.ts',
  'apps/desktop/src/renderer/src/i18n/ru.ts'
]

/**
 * Sentences that GRANT a backup, in either registry's language.
 *
 * Each is a shape that leaves the reader believing the folder protects them:
 * saying its absence costs a backup, or naming the folder as one.
 */
const GRANTS = [
  { re: /(there is|you have) no backup/i, says: 'says its absence costs a backup, which grants one by implication' },
  { re: /(is|as) (a|your) backup/i, says: 'names the folder as a backup' },
  { re: /без (неё|нее) нет (резервной копии|бэкапа)/i, says: 'says its absence costs a backup, which grants one by implication' },
  { re: /(это|является) (ваша |ваш )?(резервная копия|резервной копией|бэкап)/i, says: 'names the folder as a backup' }
]

/** A refusal is not a promise: "it is not a backup" must stay writable. */
const REFUSES = /(not a backup|не резервная копия|это не резервная копия)/i

const problems = []
let strings = 0

for (const rel of REGISTRIES) {
  const text = readFileSync(path.join(root, rel), 'utf8')
  const lines = text.split('\n')
  lines.forEach((raw, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(raw)) return
    const line = raw.replace(/\/\/.*$/, '')
    const literal = line.match(/'([^']{4,})'/)?.[1]
    if (!literal) return
    strings++
    if (REFUSES.test(literal)) return
    for (const grant of GRANTS)
      if (grant.re.test(literal))
        problems.push(
          `${rel}:${i + 1} ${grant.says}. The mirror carries two of thirty-odd tables; ` +
            `goals, tasks, questions and routines are NOT REBUILDABLE from it. ` +
            `Say what the folder IS, and say plainly that it is not a backup.`
        )
  })
}

console.log(`  ok   ${strings} operator-facing string(s) read across ${REGISTRIES.length} registries`)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' string(s) promise a backup the mirror is not')
  process.exit(1)
}
console.log('backup claim: no operator-facing string sells the mirror as a backup')
