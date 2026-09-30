// "Nobody counted" is not "nothing was cut".
//
// `coverageOfList` answers a capped read with THREE values, not two:
//
//   true       — it was cut short, and we know
//   false      — it is all of them, and we know
//   'unknown'  — nobody counted, so this may or may not be all of them
//
// `planProgress.ts` says why the third exists, in its own words: "reporting it
// as complete is how a capped read becomes a total one screen along."
//
// MEASURED 2026-09-10. Three surfaces read a coverage flag and one of them
// wrote `closedCoverage?.truncated === true`, which reads `'unknown'` as "not
// truncated" — so a goal reported a real fraction of a closed list nobody had
// counted, and a project with three open and forty done showed "2 of 3 done"
// as though it had been measured. The other two surfaces were already right,
// in two different idioms, six files away.
//
// TYPESCRIPT CANNOT HELP HERE. `boolean | 'unknown'` compared against `true`
// is legal, well-typed, and wrong — the same shape as a `data-testid` a
// component silently drops. So the rule is mechanical: a coverage flag is read
// by asking whether it is `false`, or by naming `'unknown'` explicitly. Both
// idioms are allowed, because both say the same thing and this repository has
// one of each; what is refused is the comparison that has no place to put the
// third answer.
//
// It reads files. It runs nothing and needs no network.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const SRC = path.join(root, 'apps/desktop/src')

/** Every field declared `boolean | 'unknown'` — the three-valued flags. */
const types = readFileSync(path.join(SRC, 'shared/types.ts'), 'utf8')
const declared = [...types.matchAll(/(\w+):\s*\{\s*truncated:\s*boolean\s*\|\s*'unknown'/g)].map(
  (m) => m[1]
)

const problems = []
const notes = []

if (declared.length === 0)
  problems.push(
    'no three-valued coverage field is declared in types.ts any more — this gate has lost its subject. ' +
      'If the third answer was removed, remove this gate in the same change and say why.'
  )
else notes.push(`${declared.length} coverage field(s) declared three-valued: ${declared.join(', ')}`)

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.')) files.push(full)
  }
}
walk(SRC)

let reads = 0
for (const file of files) {
  const where = path.relative(root, file)
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((raw, i) => {
      // COMMENTS FIRST, and this gate is one of the reasons that rule keeps
      // earning its place: three of the files below explain this very defect in
      // prose that contains the expression.
      if (/^\s*(\/\/|\*|\/\*)/.test(raw)) return
      const line = raw.replace(/\/\/.*$/, '')
      if (!/\btruncated\b/.test(line)) return

      // A comparison against `true`, with no `'unknown'` anywhere on the line.
      const strict = /\btruncated\s*===\s*true/.test(line)
      const namesUnknown = /'unknown'/.test(line)
      if (strict && !namesUnknown) {
        problems.push(
          `${where}:${i + 1} reads a coverage flag with \`=== true\`, which has nowhere to put ` +
            `'unknown' — "nobody counted" then reads as "nothing was cut", and the surface reports a ` +
            `measurement built on a number nobody took. Ask \`!== false\`, or name 'unknown' beside it.`
        )
        return
      }
      // Bare truthiness on a coverage flag: `'unknown'` is truthy, so this
      // happens to be safe — but it is safe by accident, and the accident
      // reverses the day the third value is renamed.
      if (/\btruncated\s*\?/.test(line) && !namesUnknown) {
        const field = line.match(/(\w+)[?.]*\.truncated/)?.[1]
        if (field && declared.some((d) => line.includes(d) || field.toLowerCase().includes(d.toLowerCase())))
          problems.push(
            `${where}:${i + 1} reads a three-valued coverage flag as a bare truthy. 'unknown' is truthy, ` +
              `so this is correct BY ACCIDENT and stops being correct if the third value is ever renamed. ` +
              `Say which answers it means.`
          )
        return
      }
      if (/\btruncated\s*(===|!==|\?)/.test(line)) reads++
    })
}

notes.push(`${reads} coverage read(s) that account for all three answers`)

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' coverage read(s) with nowhere to put "unknown"')
  process.exit(1)
}
console.log('coverage reads: every reader of a three-valued coverage flag accounts for all three answers')
