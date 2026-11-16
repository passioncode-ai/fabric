# Handoff: the screens waves (UI quality on every screen; the board, the agents' tools and the launch paths refactored)

Date: 2026-11-16. Plan and its live state: [the screens waves](../evidence/plans/2026-11-16-screens-waves.md).
Session: this repository's `0eb9017f` (Claude Code), on the operator's words of 2026-11-16: «рефакторинг доски и
протоколов коммуникации и запуска сессий, рефакторинг странички агента проекта таски и доски разбора сделать хороший UI,
качественный на все уровня не только на главной, пока все не будет готово не заканчивать, волнами».

## Objective

Every screen of the left column at the quality of the home, proven in a browser, and the board's reads, the agents'
tool surface and the launch paths split out of `index.ts` and `agentSurface.ts` into modules with tests of their own.

## Done

- **The stand** (`apps/desktop/stand`, S1): the real screens, the real stylesheets, a fake `window.fabric` fed by
  fixtures, fixed clock; `scripts/test/screens-stand.browser.mjs` gates 14 screens (home, agent, task, project, board,
  review, comms, Pulse, История, План, graph, Agent access, Settings, the task form) in two locales and two themes,
  1 120 checks: page errors, unfed calls, text past the window or under 11 px, leaked `undefined`, raw Markdown, i18n keys.
- **Screen defects fixed from its shots**: S1 nineteen, S4 sixteen, S3 two (the plan's tables list each with its fix).
- **S2, the board and the agents' doors**: `main/boardReads.ts`; `main/externalIngress.ts` and `main/requestBody.ts`
  (ADR-0115's ingress); `main/relayedAccessTools.ts`, `main/projectTools.ts`, `main/effectTools.ts`,
  `main/questionTools.ts`, `main/taskTools.ts`, `main/agentReference.ts`. `agentSurface.ts` 3 397 lines to 2 000. Each with a test that needs
  no database, each watched failing on a planted defect.
- **S3, launching**: `main/consoleOpen.ts` (`terminal.open`) and `main/taskStart.ts` (`tasks.start`), each with its test.
- **Gates taught the moves**: `check-surface-tools.mjs` reads the tool groups; ADR-0050's citation resolves at the call
  site (the record itself is not rewritten).

## Open

- `serverFor` still registers 9 tools inline: the session's own reads (whoami, stage, agents, tasks list, memory,
  transcripts, heartbeat, leases); they stay with the surface that holds the session.
- The full tier (`scripts/ci.sh full`) was not run for these changes; the fast tier was, before each landing.
- Older open items: the rest of W4 and W5 (the dispatcher), the 0.3.21 release close, 0.3.22.

## Decisions

- A moved symbol cited by an ADR's measurement keeps the record as written; the file it named names the symbol where it
  is used (`agentSurface.ts`, the moved groups' call sites).
- People's long text breaks with nothing added, reversing W6's hyphenation (a hyphen inside a broken address reads as
  part of it).
- The dispatcher and the comms IPC are not split further: both already are one factory or one line per call with tests.

## Checks actually run

`bash scripts/ci.sh fast` green on each landed head; the stand's gate (1 120 checks); the component tests of every
changed screen; `check-design`, `check-private`, `check-regions`, `check-test-chains`, `check-surface-tools`,
`check-registers`, `check-design-map`.

## Next task

Run `scripts/ci.sh full` once over the waves' changes (the stack-backed probes, `agent-surface.test.mjs` and
`work-claims-db.test.mjs` among them, exercise the moved tools against a database).
