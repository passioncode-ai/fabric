# Fabric 0.3.28 release review: the reviewers' brief

Every reviewer of every iteration gets this brief, its level's focus and the candidate. Kept in the release so the
reviews can be read against what was asked.

**Repository.** `passioncode-ai/fabric` (public). The candidate is checked out read-only at a worktree the release
session names, at the candidate commit. Baseline: `da6d6620` (tag `v0.3.27`, the 0.3.27 release commit). Read the
repository's `AGENTS.md` and `CLAUDE.md` first: they are the project's contract.

**What 0.3.28 carries.** The `## 0.3.28 (unreleased)` section of `CHANGELOG.md`, from the owner's order of 2026-11-21
(relayed by fabric-workspace's reconciler, A-3): «ты готовишь 0.3.28 одним поездом из готовых веток». Four branches
merged onto `v0.3.27`: `fix/memory-source-kinds` (Memory shows only Fabric's own projects), `audit/owner-hardcode`
(where «Нужны вы» goes in Telegram is chosen in Settings, Fabric names no organization of its own, the built app is
checked for anything of one machine), `feat/dock-icon-face` (the Dock icon is the CEO's face; the update installer stays
0.3.27's), `refactor/board-operator-door` (a module nothing starts yet). The last commit fixes what the merges broke.
Since iteration 2 it also carries what `main` took after the tag, the queue's order (`8cbf93ff`, ADR-0208, migration
131, schema 104: a database at 103 is refused until the runbook's manual step), iteration 1's fixes (the release ledger
`docs/evidence/plans/2026-11-21-release-0328-verification.md`), and, once their author hands them over,
`feat/approval-modes` and `feat/ceo-access` (ADR-0203, the CEO's account choice). The changed code:
`git diff v0.3.27 <candidate> -- apps scripts supabase`. Iteration 1's findings and their dispositions are in the ledger;
a reviewer of iteration 2 or 3 reads them first and does not report a finding already ruled there unless it is still
true on the new candidate.

**Rules.** Do not write in the checkout: record `git rev-parse HEAD` and `git status --short | wc -l` before and after
and put both in the report's header line. You may run single test files (`node --experimental-strip-types --test
apps/desktop/test/<file>.test.mjs`, `npx vitest run <file>` from `apps/desktop`); never `scripts/ci.sh`, never the
running Fabric app, its database, the network or a paid service.

**The report.** Return the whole report as Markdown, nothing else:

```
# Fabric 0.3.28 release review, iteration <N>: <level>
Level <level>, candidate <full sha>, baseline v0.3.27, reviewer <model>, read-only. HEAD before/after <sha>/<sha>, dirty files before/after <n>/<n>.

## Verdict
**<Ready | Not ready>. <n> blocking findings, <n> non-blocking.** Then what works, and each blocking finding in one line.

## Findings
| Id | Severity | Finding | Evidence | Suggested fix |
```

Ids are `<PREFIX>-<n>` (UX, ER, DO, DA, PL), numbered from the next free number the brief gives. Severity is
`Blocking` or `Non-blocking`. Blocking: something that would mislead or hurt the owner, break what worked in 0.3.27,
make a shipped claim false, leak private data or a secret, or a test red on the candidate. Evidence is a
`file#symbol` or `file:line` and, where it applies, a command with its output. Plain words, short sentences, no em
dash.

**Levels.**
- `ux` (UX-): what a person meets: Settings' «Куда уходят вопросы» and its texts in both locales, the Dock icon when the
  face changes and at the next start, Memory's map; the scenarios and flows that name them.
- `errors` (ER-): failure paths: an unreadable routes file, an agent that does not answer, a bad PNG or a full disk for
  the Dock icon, the operator door's refusals, the build check's false positives and negatives; every catch records or
  explains.
- `docs` (DO-): CHANGELOG, `docs/launch/release-mac.md`, AGENTS.md, the map, MERGES and the specs the branches touched
  say what the code does; citations resolve.
- `data` (DA-): what is stored and read: `people-ask-routes.json` kept as it was, `dock-icon.png` written atomically,
  Memory's node selection, `board-door.json` and its token (0600), nothing private in the bundle or the tracked tree.
- `plan` (PL-): the train against the owner's order and the system plan's SD-FAB-01; what was left out and why; the
  merges' conflict choices (`docs/MERGES.md`, `RELEASE-0328-TRAIN`); the gate and release receipts this release needs.

**Since iteration 2, each level also reads:** the queue's order (ux: «Очередь» on the Board, drag, «Выше», «Ниже», an
agent's proposed place; errors and data: migration 131, `task.ranked@1`, `task.rank.proposed@1`, `task.rank.declined@1`,
the projector's rank, `fabric_work_list`'s order; docs: ADR-0208, its spec, SCN-173, the runbook's schema-104 step), and
the approval modes and the CEO's account choice once merged (ADR-0203, `approvalMode.ts`, the behaviour journal).
