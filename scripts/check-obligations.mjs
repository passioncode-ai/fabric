#!/usr/bin/env node
// A rule labelled REFUSED names the thing that refuses (M155).
//
// MEASURED BEFORE THIS: `fabric_whoami` handed an agent eight rules as one flat
// list, and their force differed completely. "You can only see and touch this
// project" is refused by the scoped store. "Claim a task before working on it"
// was checked by NOTHING — no lease is consulted before a move. Told in the
// same voice, both read as enforced, and one of them was a hope.
//
// THE LABEL IS THE THING THIS GUARDS. Anybody can make a rule sound firmer;
// nobody can make a sentence refuse. So an obligation claiming REFUSED must
// name `file#symbol`, and this resolves it against the tree. A voluntary client
// cannot be given an enforced label by writing more sternly — which is the
// failure mode the card names: intent text counted as enforcement.
//
// It deliberately does NOT try to judge whether the symbol refuses correctly.
// That is what the planted-defect probes are for. This answers the cheaper
// question that was never asked: does the thing being pointed at exist at all.

import { existsSync, readFileSync } from 'node:fs'

const SOURCE = 'apps/desktop/src/shared/protocolObligations.ts'
const src = readFileSync(SOURCE, 'utf8')

const problems = []
let refused = 0
let observed = 0
let advice = 0

// Each object literal in OBLIGATIONS, crudely but exactly: split on `id:` and
// read the fields of each block. A parser here would be a second TypeScript.
const blocks = src.split(/\n  \{\n/).slice(1)
for (const raw of blocks) {
  const block = raw.split(/\n  \},?\n/)[0]
  const id = /id: '([^']+)'/.exec(block)?.[1]
  if (!id) continue
  const mode = /mode: '([A-Z]+)'/.exec(block)?.[1]
  const point = /enforcementPoint: '([^']+)'/.exec(block)?.[1]
  const evidence = /evidence:/.test(block)

  if (mode === 'REFUSED') {
    refused++
    if (!point) {
      problems.push(
        `${id} claims REFUSED and names nothing that refuses. A sentence cannot refuse; add the ` +
          `enforcementPoint, or label it ADVICE and say plainly that nothing stops it.`
      )
      continue
    }
    const [file, symbol] = point.split('#')
    if (!existsSync(file)) {
      problems.push(`${id} points at ${file}, which does not exist`)
      continue
    }
    if (!readFileSync(file, 'utf8').includes(symbol)) {
      problems.push(
        `${id} names ${symbol} in ${file}, and it is not there. An enforcement point that moved takes the ` +
          `label with it — otherwise the rule keeps saying ENFORCED about a symbol nobody kept.`
      )
    }
  } else if (mode === 'OBSERVED') {
    observed++
    if (!evidence)
      problems.push(
        `${id} claims OBSERVED and names no evidence. "Watched" with nothing recorded is advice with a ` +
          `firmer word on it.`
      )
  } else if (mode === 'ADVICE') {
    advice++
  } else {
    problems.push(`${id} has no mode; every obligation says whether it is a wall, a record or a suggestion`)
  }
}

if (refused === 0)
  problems.push(
    'no obligation is REFUSED at all. Either the vocabulary moved and this gate now checks nothing — which ' +
      'passes forever and proves nothing — or the product stopped enforcing anything it tells an agent.'
  )

if (problems.length) {
  console.error(`obligations: ${problems.length} rule(s) claiming more force than they have\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `obligations: ${refused} enforced (each naming a symbol that exists), ${observed} observed with evidence, ${advice} advice`
)
