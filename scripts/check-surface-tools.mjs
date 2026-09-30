// The tool contract the panel shows is the one the surface registers.
//
// `surfaceTools.ts` declares what a session is given; `agentSurface.ts` calls
// `server.registerTool` for what it actually gets. Two lists in two files, kept
// in step by hand, and the harness panel renders the first while an agent talks
// to the second.
//
// MEASURED 2026-09-10: they agreed — 22 and 22, same names — so this gate does
// not close a live divergence. It closes the reason they agreed, which was
// maintenance rather than construction. The prose in the same panel had already
// drifted: its own string said "Sixteen tools exist and eleven write to the
// journal" while the measured figures were 22, 17 and 5. Numbers in that file
// go stale silently; nobody notices until an operator reads a list that does
// not match what their agent can call.
//
// A registered tool the panel does not declare is a capability nobody can
// audit. A declared tool nothing registers is a promise to an agent that will
// fail at the moment it is believed.
//
// It reads files. It runs nothing and needs no network.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(path.join(root, p), 'utf8')

const DECLARED = 'apps/desktop/src/shared/surfaceTools.ts'
const REGISTERED = 'apps/desktop/src/main/agentSurface.ts'

const problems = []
const notes = []

// ── what the panel declares ────────────────────────────────────────────────
const declaredSource = read(DECLARED)
const declared = [...declaredSource.matchAll(/name:\s*'(fabric_[a-z_]+)'/g)].map((m) => m[1])
if (declared.length === 0)
  problems.push(`${DECLARED} declares no tools in a shape this gate can read — it has lost its subject`)

// ── what the surface registers ─────────────────────────────────────────────
//
// `registerTool` is called with the name as its first argument, on the line
// after the call opens. Matched together rather than counted separately: two
// counts that agree can still be two different sets.
const registeredSource = read(REGISTERED)
const registered = [
  ...registeredSource.matchAll(/server\.registerTool\(\s*\n?\s*'(fabric_[a-z_]+)'/g)
].map((m) => m[1])
if (registered.length === 0)
  problems.push(`${REGISTERED} registers no tools in a shape this gate can read — it has lost half its subject`)

const declaredSet = new Set(declared)
const registeredSet = new Set(registered)

for (const name of declared)
  if (!registeredSet.has(name))
    problems.push(
      `${name} is declared in surfaceTools.ts and registered by nothing. The harness panel shows it as a tool ` +
        `a session is given, and an agent calling it gets an error — a promise that fails when it is believed.`
    )

for (const name of registered)
  if (!declaredSet.has(name))
    problems.push(
      `${name} is registered by the surface and declared nowhere. It is a capability an agent has and the ` +
        `harness panel does not list, which is the one thing that panel exists to prevent.`
    )

// ── duplicates, in either file ─────────────────────────────────────────────
for (const [where, list] of [
  ['surfaceTools.ts', declared],
  ['agentSurface.ts', registered]
]) {
  const seen = new Set()
  for (const name of list) {
    if (seen.has(name)) problems.push(`${where} names ${name} twice`)
    seen.add(name)
  }
}

// ── and no COUNT of tools is written down in prose ─────────────────────────
//
// The panel's own string carried a hand-written count for as long as it took
// the list to grow past it — the figures had drifted by six. A number in a
// sentence has no way to be recomputed, so it is now rendered from the list and
// this rule keeps it that way.
//
// The rule bans the number even inside a note EXPLAINING the old number: a
// reader skimming a screen spec sees the figure, and quotation marks do not
// stop it being read as current. This gate's own header therefore describes the
// drift rather than reprinting it — the third time in this codebase that a
// check has had to be taught not to flag its own documentation, and the first
// where the right answer was to change the documentation instead.
const WORDS = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b\s+tools?\b/i
// LINE BY LINE, and only the lines that ship to a screen. Two things went wrong
// when this scanned whole files: "one of them" matched an unrelated string
// elsewhere in the registry, and the gate flagged THIS FILE'S OWN comment,
// which quotes the stale sentence in order to explain it. A rule that cannot
// read its own documentation without reporting it is a rule nobody will keep.
// `screens.md` is scanned too, and it is why: the same stale sentence lived in
// the screen spec as well as in the shipped string, and correcting one and not
// the other is how a document and a product start disagreeing about a number
// neither of them computes.
const SCANNED = [
  'apps/desktop/src/renderer/src/i18n/en.ts',
  'apps/desktop/src/renderer/src/HarnessSection.tsx',
  'docs/ux/screens.md'
]
for (const file of SCANNED) {
  read(file)
    .split('\n')
    .forEach((raw, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(raw)) return
      const line = raw.replace(/\/\/.*$/, '')
      if (!/harness\.|harness|tool/i.test(line)) return
      const m = line.match(WORDS)
      if (m)
        problems.push(
          `${file}:${i + 1} writes a tool count in words ("${m[0]}"). It cannot be recomputed, and the last ` +
            `one was wrong by six for as long as nobody read it. Render the figure from the list.`
        )
    })
}

const recording = [...declaredSource.matchAll(/records:\s*(true|false)/g)].map((m) => m[1] === 'true')
notes.push(
  `${declared.length} tool(s) declared and registered, matching by name; ` +
    `${recording.filter(Boolean).length} write to the journal and ${recording.filter((x) => !x).length} do not`
)

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' surface-tool problem(s)')
  process.exit(1)
}
console.log('surface tools: the panel declares exactly what the surface registers, and no count is written in prose')
