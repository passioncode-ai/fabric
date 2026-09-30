// Can the next agent find the way in, and is what it reads still true?
//
// FA-10. Two properties decide whether a handoff survives the person who wrote
// it, and both are computable from the files alone:
//
//  1. **A generated document says which configuration it describes.**
//     `docs/AGENT_SYNC.md` carries `cfg=<digest>` in its first line and opens by
//     saying "if it disagrees with what the tool does, the tool is right and
//     this file is stale". A document that announces its own staleness and has
//     nothing to detect it is a promise, not a check. Measured 2026-09-10: the
//     stamp matches, so the document was true — and nothing in this repository
//     would have said otherwise on the day it stopped being.
//
//  2. **An instruction file links it.** A snapshot no entry point mentions is a
//     document the next agent never opens.
//
// `agent_sync.py check` verifies both, and more that needs the coordination
// plane. It is NOT in `ci.sh`, deliberately: that plane is Notion, and a gate
// that fails when a third party is slow teaches everyone to ignore it. These two
// checks need no network, so they run here and the rest stays where it is.

import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(root + p, 'utf8')

const SNAPSHOT = 'docs/AGENT_SYNC.md'
const CONFIG = '.claude/agent-sync.json'
const MARKER = '<!-- agent-sync:generated'
const ENTRY_POINTS = ['AGENTS.md', 'CLAUDE.md', 'README.md', 'CONTRIBUTING.md']

const problems = []
const notes = []

if (!existsSync(root + CONFIG)) {
  notes.push(`${CONFIG} does not exist, so this project has no coordination to describe — nothing to check`)
} else if (!existsSync(root + SNAPSHOT)) {
  problems.push(
    `${CONFIG} exists and ${SNAPSHOT} does not: coordination is configured and no document tells the next agent ` +
      `how it works. Generate it with \`agent_sync.py setup\`.`
  )
} else {
  const head = read(SNAPSHOT).split('\n')[0] ?? ''
  if (!head.includes(MARKER))
    problems.push(
      `${SNAPSHOT} has lost its generated marker — it was hand-edited. Regenerate it, or move it somewhere it ` +
        `cannot be mistaken for the tool's own description of itself.`
    )
  else {
    const stamped = head.match(/cfg=(\w+)/)
    // The tool hashes the config's bytes and keeps twelve hex characters. The
    // same rule here, because a digest computed a second way is a second digest.
    const actual = createHash('sha256').update(readFileSync(root + CONFIG)).digest('hex').slice(0, 12)
    if (!stamped)
      problems.push(`${SNAPSHOT} predates configuration stamping, so its accuracy cannot be checked — regenerate it.`)
    else if (stamped[1] !== actual)
      problems.push(
        `${SNAPSHOT} describes configuration ${stamped[1]} and ${CONFIG} is now ${actual}. The document says the ` +
          `tool is right when they disagree — so this document is currently wrong about how coordination works ` +
          `here. Regenerate it with \`agent_sync.py setup\`.`
      )
    else notes.push(`${SNAPSHOT} describes the configuration that is actually in force (${actual})`)
  }

  const linked = ENTRY_POINTS.filter((f) => existsSync(root + f) && read(f).includes('AGENT_SYNC.md'))
  if (!linked.length)
    problems.push(
      `no instruction file links ${SNAPSHOT} — ${ENTRY_POINTS.join(', ')} were checked. An agent starting cold reads ` +
        `those and would never open it.`
    )
  else notes.push(`linked from ${linked.join(', ')}, so a cold start reaches it`)
}

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' handoff problem(s)')
  process.exit(1)
}
console.log('handoff: the generated coordination document is current and reachable from a cold start')
