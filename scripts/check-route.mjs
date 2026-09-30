#!/usr/bin/env node
// The shell is in ONE place at a time, and a script says so (S13).
//
// MEASURED BEFORE THIS EXISTED. `App.tsx` held `active: Tab` and, beside it, a
// boolean `showAgents`. Every content branch read `{!showAgents && active.kind
// === '…' && …}`, and `openProject` — reached from the search panel, the CEO
// panel and the estate home — set `active` and not the boolean. So a click on a
// search hit while the agents view was up opened the tab, changed the tab
// strip, and left the agents list covering the project it had just opened. The
// operator navigated and nothing happened.
//
// WHY A SCRIPT AND NOT A CONVENTION (ADR-0049). The fix at the call site is one
// more `setShowAgents(false)`, and there were three call sites; the fourth is
// the one somebody adds next month. Collapsing the two values into one route
// removes the state that cannot be reached — and this gate is what stops a
// second boolean growing beside it, because the next author will have a good
// local reason, exactly as the first one did.
//
// THE RULE. Inside `<main className="content">`, a branch is guarded by
// `active.kind === '<arm>'` and by nothing else that decides WHICH SCREEN
// SHOWS. Guards that decide something *within* a screen are fine and named:
// `current` (the project row has loaded) and `workspaceFor` (which of a
// project's two screens). A bare boolean is not.
//
// This is deliberately about one file. `App.tsx` is the only place in the tree
// that chooses between whole screens; a gate that swept every component would
// be finding conditional rendering, which is not the defect.

import { readFileSync } from 'node:fs'

const FILE = 'apps/desktop/src/renderer/src/App.tsx'
const src = readFileSync(FILE, 'utf8')
const lineOf = (index) => src.slice(0, index).split('\n').length

const open = src.indexOf('<main className="content">')
const close = src.indexOf('</main>', open)
if (open < 0 || close < 0) {
  console.error(`route: no <main className="content"> … </main> in ${FILE} — the gate cannot see the shell`)
  process.exit(1)
}
const content = src.slice(open, close)

/** Guards that decide something INSIDE a screen rather than which screen. Each
 *  is here because it was read and understood, not because it is short. */
const WITHIN_SCREEN = new Set([
  // The project row for `active.projectId`, once `projects` has loaded. Not a
  // place — the route already says "a project", this says "we have it yet".
  'current',
  // Which of a project's two screens: the home or the workspace. A sub-route of
  // the project arm, and it is compared against `current.id` rather than being
  // a bare boolean.
  'workspaceFor'
])

const problems = []
const arms = new Set()

// Each top-level `{ … && ( … )}` branch begins at a `{` immediately after a
// newline at the JSX indentation of the main's children.
for (const m of content.matchAll(/\n\s{8}\{([^\n]*?)&&\s*\(/g)) {
  const guard = m[1]
  const line = lineOf(open + m.index)
  const kinds = [...guard.matchAll(/active\.kind === '([a-z]+)'/g)].map((k) => k[1])
  if (kinds.length !== 1) {
    problems.push(
      `${FILE}:${line}  a content branch guarded by ${kinds.length} route tests — every screen is chosen by exactly one \`active.kind === '<arm>'\``
    )
    continue
  }
  arms.add(kinds[0])
  // Everything else the guard mentions.
  const rest = guard.replace(/active\.kind === '[a-z]+'/g, ' ')
  for (const id of rest.matchAll(/[A-Za-z_$][\w$]*/g)) {
    const name = id[0]
    if (WITHIN_SCREEN.has(name)) continue
    if (name === 'active' || name === 'id') continue
    problems.push(
      `${FILE}:${line}  the screen at \`active.kind === '${kinds[0]}'\` is also gated on \`${name}\` — ` +
        `a boolean beside the route has states the route cannot reach, and the one that hides the screen ` +
        `you just navigated to is silent (see the header of this gate)`
    )
  }
}

// Every arm of the route must have a screen, or the shell can be somewhere that
// renders nothing at all.
const routeSrc = readFileSync('apps/desktop/src/shared/appRoute.ts', 'utf8')
const declared = new Set([...routeSrc.matchAll(/\{ kind: '([a-z]+)'/g)].map((m) => m[1]))
for (const arm of declared)
  if (!arms.has(arm))
    problems.push(
      `apps/desktop/src/shared/appRoute.ts  the route can be '${arm}' and ${FILE} renders nothing for it`
    )

if (problems.length) {
  console.error(`route: ${problems.length} place(s) where the shell can be in two states at once\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `route: ${arms.size} screen(s) chosen by one route value — ${[...arms].sort().join(', ')}; ` +
    `every arm of AppRoute renders`
)
