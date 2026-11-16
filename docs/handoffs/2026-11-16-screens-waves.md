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
- **Screen defects fixed from its shots**: S1 nineteen, S4 nineteen, S3 two (the plan's tables list each with its fix).
- **S2, the board and the agents' doors**: `main/boardReads.ts`; `main/externalIngress.ts` and `main/requestBody.ts`
  (ADR-0115's ingress); `main/relayedAccessTools.ts`, `main/projectTools.ts`, `main/effectTools.ts`,
  `main/questionTools.ts`, `main/taskTools.ts`, `main/agentReference.ts`. `agentSurface.ts` 3 397 lines to 2 000. Each with a test that needs
  no database, each watched failing on a planted defect.
- **S3, launching**: `main/consoleOpen.ts` (`terminal.open`) and `main/taskStart.ts` (`tasks.start`), each with its test.
- **Gates taught the moves**: `check-surface-tools.mjs` reads the tool groups; ADR-0050's citation resolves at the call
  site (the record itself is not rewritten).

- **Wave 2 of the other screens** (the operator, 2026-11-16; Fabric task `a78ff261`): twenty defects from the stand's
  shots at 1100, 900 and 820 px in both themes, fixed with tests (the map lane `iteration-2026-11-16-screens-wave-2`);
  the stand's gate now fails a pill whose words overflow it (watched failing on «Нужны вы» at 1024 px).

## Open

- `serverFor` still registers 9 tools inline: the session's own reads (whoami, stage, agents, tasks list, memory,
  transcripts, heartbeat, leases); they stay with the surface that holds the session.
- The full tier (`scripts/ci.sh full`) was not run for these changes; the fast tier was, before each landing. Blocked on
  this machine on 2026-11-16: Docker's daemon is not running (`docker info`: no `/var/run/docker.sock`) and the data
  volume has 8.2 GB free of 460 GB (`df -h`), too little for a disposable stack; freeing space is Observatory's machine
  cleanup, not this task's.
- Found in wave 2 and left on the board: История's «Агент | агент …» (`96d4431c`), raw capability ids in an open
  thread (`b54734c6`), agent ids as Agent access headings (`cc6ce338`), the project's side column and the board's
  filters at narrow widths, and the stand's stub rail (`6f61f88f`).
- Older open items: the rest of W4 and W5 (the dispatcher), the 0.3.21 release close, 0.3.22.

## Decisions

- A moved symbol cited by an ADR's measurement keeps the record as written; the file it named names the symbol where it
  is used (`agentSurface.ts`, the moved groups' call sites).
- People's long text breaks with nothing added, reversing W6's hyphenation (a hyphen inside a broken address reads as
  part of it).
- The dispatcher and the comms IPC are not split further: both already are one factory or one line per call with tests.

## Traps met

- A landing guarded only by `merge-base --is-ancestor` pushed a head whose fast tier had failed (`c8217529`, the citation
  and surface-tool gates). Land only after reading the tier's exit code (`rc=$?` before any pipe).
- A gate that names the files it reads (`check-surface-tools.mjs`) does not follow code moved into a new file: after a
  move, run every `check-*.mjs` before committing, not only typecheck and tests.
- `test/audit_regressions/fix-pf-09.0{1,2}.py` read a tool's source as text: they now read `taskTools.ts`. A move of a
  tool's code is followed by `git grep` for its file name in `scripts/` and `test/`.
- `check-regions.mjs` reads tracked files only: a new file's regions count after `git add`.
- A private agent's name in a plan or a commit message is a P1 finding of `check-private`; describe the tool, not its
  name, and rewrite an unlanded commit message that carries one.
- `node … --refresh | tail -1` hides a refused refresh's exit code: use `set -o pipefail`.

## Checks actually run

`bash scripts/ci.sh fast` green on each landed head; the stand's gate (1 120 checks); the component tests of every
changed screen; `check-design`, `check-private`, `check-regions`, `check-test-chains`, `check-surface-tools`,
`check-registers`, `check-design-map`.

## Next task

Run `scripts/ci.sh full` once over the waves' changes (the stack-backed probes, `agent-surface.test.mjs` and
`work-claims-db.test.mjs` among them, exercise the moved tools against a database).
