---
report:
  id: fabric/2026-10-04-hub-recovery
  title: "Interrupted hub recovery and iteration-2 disposition"
  kind: review
  project: fabric
  domains: [ai-agent, mcp, orchestrator]
  as_of: 2026-10-04
  status: draft
  valid_until: 2026-11-03
  summary: >-
    Original independent iteration2 reports recovered at2927a087 contain56 findings.
    Core and surface fixes converged on an isolated candidate; remaining review,
    seeded upgrade, final-source publication and human release approval are open.
    Historical reviewer tests are separated from new recovery executions.
  sources:
    - name: "Main squash under original review"
      url: "https://github.com/passioncode-ai/fabric/commit/2927a087cac61c02f16f41d9bebfdc7403fc577c"
      read_at: 2026-10-04
    - name: "Owner-specific docs and planning disposition"
      url: "https://github.com/passioncode-ai/fabric/blob/53adddb57a43c44f8f82840d0e6c1e6ac0af7132/docs/handoffs/2026-10-04-hub-docs-plan-dispositions.md"
      read_at: 2026-10-04
  produced_by:
    agent: "Codex"
    task: "Recover interrupted Claude hub verification"
  supersedes: []
  consumers: [fabric, fabric-agent-contract, fabric-inbox, fabric-workspace]
---

<sub>ssheleg skills — task-pipeline · agent-sync · project-reports · agent-interop · agent-orchestrator · telegram-bots · claude-history-ingest · copywriting</sub>

# Interrupted hub recovery

This dated snapshot preserves the original five independent reports. Their execution claims
belong to the original reviewed source `2927a087`; reading them is not rerunning those checks.
Original bytes remain in the local Claude archive; [hash/redaction manifest](raw/archive-manifest.json)
records original and published hashes. Machine-specific paths and private consumer names were
replaced; findings, baseline and historical test claims are retained. The public consumer is
`example-agent` only. No raw conversation, credentials or machine configuration is published.

## Original independent reports

- [UX and interface](raw/iteration-2/2026-10-04-ux.md):11 findings.
- [Errors and boundaries](raw/iteration-2/2026-10-04-errors.md):11 findings.
- [Code and documentation](raw/iteration-2/2026-10-04-docs.md):14 findings.
- [Data and authority](raw/iteration-2/2026-10-04-data.md):6 findings.
- [Plan and roadmap](raw/iteration-2/2026-10-04-plan.md):14 findings.

## Recovery source and executed checks

The [canonical verification ledger](../../evidence/plans/2026-10-04-hub-verification.md)
owns current finding status. Source packets: [core](../../handoffs/core-resume.md),
[surface](../../handoffs/surface-resume.md), [all28 DO/PL dispositions](../../handoffs/2026-10-04-hub-docs-plan-dispositions.md).
Root integrated core paging/replay/authority and renderer fixes, preserved the original dirty
worktrees, and added ingress, bounded vault reads and release preflight guards.

Root focused checks (2026-10-04): hub-products51pass/0fail after the changed-state regression;
release-input/gate21pass/0fail/0skip. The reconnect race regression first failed with
`already-connected`, then passed with `connection-changed`; no connection was written in
that race. Schema behind startup supplies the actual migration command and recovery procedure.
Fast convergence first stopped at stale documentation/prototype receipts and an unlogged
callback read failure; those source defects are corrected. A later native-view failure was
installation preparation: this isolated install used --ignore-scripts and skipped the existing
root postinstall chmod for node-pty1.1.0 spawn-helper. Its mode644 and actual posix_spawnp
refusal were reproduced, then the existing `pnpm run postinstall` was run. Both real Node
and Electron backend-view suites pass8groups each; no ownership/deadline rule was weakened.
Upstream context: [node-pty#850](https://github.com/microsoft/node-pty/issues/850),
[stable-channel#919](https://github.com/microsoft/node-pty/issues/919). Fast rerun remains pending.
The [seeded upgrade packet](../../handoffs/2026-10-04-hub-upgrade-rehearsal.md) passed
owned75/77→78, physicaldump/restore, replay/ACL/CAS plus two semantic mutants; fresh
remote checkout repeated it without node_modules. Complete full tier and independentI3 are
**NOT_RUN** at this snapshot. Native app, VoiceOver, live connected product and signed release
acceptance are not inferred from renderer harnesses or owned database fixtures.

## Decisions and next task

Fabric owns the project communication board; [COM source](../../evidence/plans/2026-10-04-project-communications.md)
and [architecture](../2026-10-04-project-communications/README.md) are design/implementation
packets, not released capability. Telegram research [source packet](../2026-10-04-telegram-board-transport/README.md)
provides the optional transport. Contract ownerPR9 landed asdf55c8c5 after independent root fullgate258tests;
consumer adoption remains tracked separately. Exact next task: finish the remaining owning-source corrections,
run fast/full and seeded upgrade on the converged candidate; then five freshI3 reviewers form
findings before comparing earlier reports. Do not tag from this report.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded the recovery and COM task packets
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — protected shared registers with Git leases
- `project-reports` — created versioned research reports — not a skill this family ships
- [`agent-interop`](https://github.com/ssheleg/agent-stack) — defined protocol and authority boundaries
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — separated orchestration ownership
- [`telegram-bots`](https://github.com/ssheleg/telegram-dev) — checked current bot transport semantics
- `claude-history-ingest` — recovered the interrupted Claude context — not a skill this family ships
- [`copywriting`](https://github.com/ssheleg/super-ux) — reviewed schema recovery and connection messages

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

