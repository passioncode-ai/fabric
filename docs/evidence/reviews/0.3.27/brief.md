# Fabric 0.3.27 release review: the reviewers' brief

Every reviewer of every iteration gets this brief, its level's focus and the candidate. Kept in the release so the
reviews can be read against what was asked.

**Repository.** `passioncode-ai/fabric` (public). The candidate is checked out read-only at a worktree the release
session names, at the candidate commit. Baseline: `44cd80ca731446f57dc2eab65eb5cdee034daf24` (0.3.26's release close on
`main`). Read the repository's `AGENTS.md` and `CLAUDE.md` first: they are the project's contract.

**What 0.3.27 carries.** The `## 0.3.27 (unreleased)` section of `CHANGELOG.md`, from two orders of the owner on
2026-11-20: «first fix what gets in the way of work» (`docs/evidence/plans/2026-11-20-ceo-board-ux/owner-words.md`,
part 4) and the voice CEO retro (`docs/reports/2026-11-20-voice-ceo-retro/README.md`, its ledger `fixes.md`). The
changed code: `git diff 44cd80ca <candidate> -- apps scripts`. No schema step.

**Rules.** Do not write in the checkout: record `git rev-parse HEAD` and `git status --short | wc -l` before and after
and put both in the report's header line. You may run single test files (`node --experimental-strip-types --test
apps/desktop/test/<file>.test.mjs`, `npx vitest run <file>` from `apps/desktop`); never `scripts/ci.sh`, never the
running Fabric app, its database, the network or a paid service.

**The report.** Return the whole report as Markdown, nothing else:

```
# Fabric 0.3.27 release review, iteration <N>: <level>
Level <level>, candidate <full sha>, baseline 44cd80ca, reviewer <model>, read-only. HEAD before/after <sha>/<sha>, dirty files before/after <n>/<n>.

## Verdict
**<Ready | Not ready>. <n> blocking findings, <n> non-blocking.** Then what works, and each blocking finding in one line.

## Findings
| Id | Severity | Finding | Evidence | Suggested fix |
```

Ids are `<PREFIX>-<n>` (UX, ER, DO, DA, PL), numbered from the next free number the brief gives. Severity is
`Blocking` or `Non-blocking`. Blocking: something that would mislead or hurt the owner, break what worked in 0.3.26,
make a shipped claim false, leak private data or a secret, or a test red on the candidate. Evidence is a
`file#symbol` or `file:line` and, where it applies, a command with its output. Plain words, short sentences, no em
dash.
