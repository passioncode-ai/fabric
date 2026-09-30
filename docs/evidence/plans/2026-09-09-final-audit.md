# Final audit handoff — 2026-09-09

## Objective and entry point

Deeply audit what Fabric implements, reconcile the latest queue report and older
findings, and leave bounded plans another agent can execute without reconstructing chat.

Start at the [interactive audit](../../audit/2026-09-09-final/index.html),
[Markdown plan](../../audit/2026-09-09-final/index.md) and
[shared contracts/context](../../audit/2026-09-09-final/COMMON.md).
The [machine index](../../audit/2026-09-09-final/index.json) names all packets,
dependencies, decisions pending activation, source revisions and coverage.

## Completed

- Source snapshot: `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d`.
- All 80 baseline scenarios plus 9 later provider scenarios, 43 previous findings, 65 catalog nodes including four DONE,
  196 milestones and 111 baseline carry-over rows accounted for.
- 59 bounded remediation/activation packets plus 65 baseline catalog packets and M199 with its nine execution children.
  These overlap intentionally through explicit execution owners; they are not 124 independent projects.
- Current defects reproduced with isolated pure and actual React component probes.
  No runtime implementation or production data changed by this audit.
- Last-audit metadata and living map updated; remaining work filed as CO-113 under existing M/S owners.

## Decisions and limits

Keep repaired foundations; fix their consumer/integration deltas. Preserve Project,
authority, evidence and replaceable-agent boundaries. No new architecture ADR is
adopted by this planning snapshot. Auth provider, invite transport, effect provider,
paid runner resource/budget and brand scope remain explicit activation decisions;
each has a recommended path and offline work in the report's 17-question table.

The audit did not run the shared local DB full tier or start the native application
and its background routines. Native accessibility, real auth/restore, paid runner
and production-effect outcomes remain unverified. See the report's blind list.

## Exact next tasks

1. **Build agent:** [FA-01](../../audit/2026-09-09-final/packets/FA-01.md): reproduce
   fresh-checkout manifest ENOENT, make the manifest producer/order self-contained,
   and prove fresh build plus packaged identity. Do not change source receipt to bypass CI.
2. **Independent UI agent:** [UX28-01](../../audit/2026-09-09-final/packets/UX28-01.md):
   reproduce task A brief saved into B, bind drafts/requests/writes to task identity,
   and turn the captured counterexample into a regression test.
3. **Autonomy lane:** [FA-03](../../audit/2026-09-09-final/packets/FA-03.md) and
   [FA-04](../../audit/2026-09-09-final/packets/FA-04.md) feed the common admission
   work in [FA-02](../../audit/2026-09-09-final/packets/FA-02.md) and its AX-01 evidence.
   One owner integrates TaskRun/session/ack/exit, including upgrade from the old migration44.

## Checks actually run

The source audit's check receipts are in the [evidence index](../../audit/2026-09-09-final/index.md#что-действительно-проверено):
local fast passed; fresh worktree fast failed at manifest ENOENT; prepared worktree
fast passed after explicitly creating the ignored output directory. That preparation
is not a source fix. Remote baseline fast failed and full was skipped; workspace
CI failed on stale publication. Pure/component probes reproduced defects without
live agents, writes to product databases or external effects. `check.py` validates
artifact coverage/links only; map and final documentation gates are recorded in
the completion receipt beside the report after they run.

## Repository ownership and delivery

| Repository | Branch / inspected commit | Status / entry |
|---|---|---|
| `passioncode-ai/fabric` | `codex/final-audit-20260909`; source baseline above | This handoff is the entry; source audit and map committed/pushed on this branch. Exact delivery commit is the commit containing this file. |
| `passioncode-ai/fabric-agent-contract` | `1eeb5a302518a25af4c3ef82f1942aa3288bc9b9` | Read-only normative reference; no pending branch created by this audit. |
| `passioncode-ai/fabric-agent-adapter` | `5d2ccd7a124d7052f743529d8dcf0caf294bfdfd` | Read-only inspected dependency; no pending branch created by this audit. |
| `passioncode-ai/fabric-workspace` | Parent gitlink and `docs/workspace-receipt.json` | Generated publication only; inspect verified receipt, not a hand-written release claim. |

Fresh checkout: fetch this branch from the existing authorized origin, initialize
`workspace` at the recorded pin, run `python3 docs/audit/2026-09-09-final/check.py`
and `node scripts/workspace.mjs check --require-child`. A successful report publication
does not certify Fabric runtime delivery. Provider-account design `25026daef6dc1829581ca9fe1f68495761dfd1cf` is preserved by a merge into this audit branch so publication does not roll back the newer report. Its ADR-0051 remains proposed; runtime code is identical to the baseline. Read the [separate addendum](../../audit/2026-09-09-final/provider-addendum.md) for seven new scenarios and PA-01–06. The dated queue report deleted by that branch is retained as audit input. No integration branch or product runtime is changed.

## Coverage correction during review

The first split covered SCN-001–078. Heading-based validation found SCN-079/080 outside the table/split; they were audited before final delivery. `check.py` now compares audit IDs with every scenario heading at the source commit, so a fixed-number split cannot silently claim whole-source coverage. Baseline counts (111 CO / 196 M) stay historical; combined source contains 113 CO / 197 M.

## Final publication delta — source 8a0e9db

A concurrent verified workspace release added automatic switching after the first account design.
This handoff preserves source `8a0e9dbc17ac251e543b26653f64540a24ff0a8a` and its existing M199
work breakdown. Read [the latest delta audit](../../audit/2026-09-09-final/provider-auto-addendum.md)
before account work. ADR-0052 records the operator's inclusion of opt-in automatic switching;
policy defaults/details still require review. The earlier no-auto exclusion is superseded.
M199.probe is the first bounded account task. Nine M199 children use the existing admission,
quota, effect and read contracts; the aggregate is not a tenth independent implementation.
The source runtime remains unchanged; SCN088/089 are target-only paths. All 89 scenario
headings and 75 current catalog nodes are accounted for across explicitly pinned revisions.

## Fresh tooling prerequisites

Use the supported Node/runtime versions from the manifests; install the parent with
`pnpm install --frozen-lockfile` and the initialized workspace child with `npm ci`.
The first child publication attempt here stopped at missing `marked`; installing the
locked child dependencies made its 14 tests and content verification pass. No lockfile
or host code was changed. A concurrent publication then advanced origin/main; source
8a0e9db and its publication history were reviewed and preserved before a combined export.
Do not reset or force-push a competing report snapshot. Strict publication identity and
fresh-checkout results are reported only after verification.
