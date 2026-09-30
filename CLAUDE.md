@AGENTS.md

# CLAUDE.md — Fabric / PassionCode.ai

Kernel of PassionCode.ai: Electron 44 + electron-vite + React 19 + TypeScript,
pnpm workspace, local Supabase stack, journal-as-spine (ADR-0014). The shared rules
for every org repository (branches, landing, CI, leases, secrets, handoffs) are
[org-index RULES.md](https://github.com/passioncode-ai/org-index/blob/main/RULES.md);
`AGENTS.md`, imported above, is this repository's contract. The operator's machine
also loads a private `~/.claude/CLAUDE.md` (language, quality bar, evidence rules);
nothing here depends on it, so a contributor without that file loses no rule this
repository needs. This file holds only what is true of THIS repository.

## Iteration delivery and priority

Read and follow the shared [iteration contract](AGENTS.md#iteration-contract),
including the design-map gate and precise final review links. The same rule applies
in Claude Code, Codex and other agents; it is not duplicated here.
Current delivery order lives in [the backlog](docs/evidence/backlog.md#build-order-by-layer).

## What is load-bearing here

- **Gates before commit**: `bash scripts/ci.sh fast` (no DB) or `full` (with
  stack); `node scripts/check-registers.mjs`; `bash scripts/check-docs.sh`.
  A gate's exit code is read directly — never piped through `tail`/`grep` in the
  same command that depends on it.
- **Registers recompute**: numerators in `docs/evidence/backlog.md` are checked
  by the gate against the tables; update both or the gate fails.
- **Guarded files**: `docs/architecture/*.md`, `docs/adr/**`, `CONTEXT.md`,
  `docs/vision.md`, `docs/evidence/backlog.md` — agent-sync lease required
  (`agent_sync.py acquire <path>`), ADR ids reserved via `agent_sync.py reserve ADR`.
- **Migrations**: the projector is a thin dispatcher calling per-concern
  functions (`apply_questions`, `apply_priority`, …) — extend by ADDING a
  function, never by rewriting the monolith. New tables need grants + RLS in
  migration 4's shape (P21: a missing grant looks exactly like an empty table).
  New event types need `event_types` rows `(type, projects, note)` AND a feed
  sentence `event.<type>` in `i18n/en.ts` (the narrative gate refuses machine
  ids reaching the feed).
- **Tests**: TDD; planted defects must be WATCHED being caught (valid code that
  behaves like the old defect — a file that fails to compile proves the plant,
  not the test). Probe scripts never use bare backticks inside template
  literals (`check-probes.mjs`).
- **Dated documents** (`docs/audit/`, `docs/evidence/plans/YYYY-MM-DD-*`,
  `docs/reports/YYYY-MM-DD-*`) are records of a moment — never rewritten to
  match today's tree (the one exception is privacy: ADR-0096, redaction for publication). Living documents cite symbols (`File.ts#name`), never
  bare line numbers; the citation gate enforces both.
