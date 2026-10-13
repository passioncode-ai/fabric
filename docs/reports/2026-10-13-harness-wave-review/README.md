---
report:
  id: fabric/2026-10-13-harness-wave-review
  title: "CO-282: portable harness repair wave"
  kind: review
  project: fabric
  domains: [architecture]
  as_of: 2026-10-13
  status: draft
  valid_until: 2026-10-27
  summary: >-
    Detailed modular execution plan and first Fabric repair wave. Pending-session identity,
    whole-context budgets and ACP mode transport have distinct implementation and review
    receipts. All-agent compliance, owner delivery and scheduler enforcement remain open.
  sources:
    - name: Fabric baseline
      url: https://github.com/passioncode-ai/fabric/tree/a5b78e4919d82c6eae88bee72e59eba3e0c1fbae
      read_at: 2026-10-13
    - name: Wave execution plan
      path: docs/evidence/plans/2026-10-13-harness-waves.md
      read_at: 2026-10-13
  produced_by: {agent: codex, task: CO-282}
  supersedes: []
  consumers: [fabric]
---

# CO-282 — first portable harness repair wave

This is source-level delivery and review evidence. No installation, deployment, merge,
all-host instruction compliance or machine-wide resource enforcement is certified here.
The [plan](../../evidence/plans/2026-10-13-harness-waves.md) owns the decomposition;
[host matrix](../../execution/harness-waves/host-matrix.md) separates host capabilities;
[owner packets](../../execution/harness-waves/owner-packets.md) preserve upstream work.

## N-001 — enrollment identity and pending admission

Implementation: `9d53b8f1f139f45d6f98c17dfe717d4a398017b7`, integrated as
`0a4ae694` (same two-file patch). Before the fix, two newly added negative tests failed:
a second native runtime reused the first runtime's pending bearer, and a concurrent retry
could receive a bearer before authorization/journaling finished. Exact runtime matching
and per-binding admission serialization close those paths; other bindings remain parallel.

Builder `/root/observatory_research`: before repair 21/23 passed; frozen commit
`node --experimental-strip-types --test apps/desktop/test/session-enroll.test.mjs apps/desktop/test/session-enroll-request.test.mjs`
passed 35/35, no skips. Independent reviewer `/root/pipeline_research` reviewed the frozen
commit and ran enrollment alone: 25/25, no blockers. Checks include known/null identities,
rejoin, failure release, concurrent retries, unrelated bindings, revocation and session cap.
These are injected-boundary/source tests, not native provider execution.

## N-003 — exact context budget and refusal propagation

Implementation: `1ddf43fd`. Four new regression groups failed on the baseline, including
1104 UTF-16 code units emitted at a budget of 1000. The compiler now accounts for the
essential head, all separators, final newline and omission notice. It selects complete
facts with their safety fence. Oversized essential content refuses rather than clipping
instructions or falling through to a session without context. Compiler revision is 4.

Commands, each exit 0:

- `node --experimental-strip-types apps/desktop/test/context-mandatory.test.mjs`: 10 checks.
- `node --experimental-strip-types apps/desktop/test/context-privacy.test.mjs`: 8 checks,
  including real compiler → bundle refusal/revocation and verified packet identity.
- `node apps/desktop/node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.node.json`.

Independent reviewer `/root/observatory_research` found no blocker. Saved seeded check:
`node --experimental-strip-types docs/reports/2026-10-13-harness-wave-review/raw/context-budget-fuzz.mjs`.
Seed 7321: 500 cases, 471 valid packs and 29 explicit budget refusals; length, omission
conservation and agent-data fence invariants pass. This tests synthetic source combinations,
not 500 native agents. Its script digest is
`d9da0faa1ffa33e87482cc9c58ae8e0830d923b46ce78d0d588c3a75ebd8a4a7`.

Reviewed files match the committed source exactly:

| File | SHA-256 |
|---|---|
| `apps/desktop/src/main/contextPack.ts` | `14f86b2de0962331ec2df19c54420b7f19a3b6442ca94898c65982a8519eccf7` |
| `apps/desktop/test/context-mandatory.test.mjs` | `da0e197f75058361aab0a978e8e292a63e4868b8c4cf5fbf6dfec3ad235f62ca` |
| `apps/desktop/test/context-privacy.test.mjs` | `a69c0e0449b3cd2345bc1f40d4ab2f96aa9f4bc1137b4aed5ab7d54be1a383d4` |

Compatibility: an operator-started session with an oversized essential context is now
refused too. It cannot silently omit the task to fit. Normal-sized packs remain usable;
no source records are rewritten.

## N-002 — ACP mode and required surface

Original candidate `67b763586ddfdb34878b29a6fb6117a0cc90ec52` was rejected by independent review.
The builder's local no-model probe of Kimi 2.1.1 showed global flags are accepted but
`session/new` still reports default mode. `session/set_mode` acknowledges plan/default/yolo;
an unknown mode is refused. No model prompt/API invocation was issued by this probe. It did not instrument all network traffic or independently meter provider spend.
The implementation negotiates and acknowledges mode before the brief/prompt, and refuses
connected launches without their required Fabric surface. Reviewer's injected peer acknowledged plan/default while reporting yolo; the shell sent
its brief despite the contradiction. The original 32 passing tests did not cover this.
A separate repair `ce9090efaa8c8ddd4e505b56563189f3c79582b4` rejects a known
same-session contradiction before the prompt, while ignoring foreign-session updates.
Independent reviewer `/root/pipeline_research` reran the saved mismatch fixture and nine
mode tests on that SHA: both negative scenarios refuse, all nine tests pass, no remaining
blocker. Original patch plus correction integrate as `c70009e3` and `a2965695`.

Builder's frozen original candidate passed bundle, 32 ACP, PTY launch-failure and PTY
smoke tests, containment (12 modes) and region gates. Final correction passed nine affected
ACP tests. See [native receipt](raw/n002-native-acp-receipt.json),
[original test receipt](raw/n002-test-receipt.json), [review-fix receipt](raw/n002-review-fix-receipt.json)
and [independent negative fixture](raw/acp-mode-mismatch.mjs). Native reproduction script
is explicitly labelled reconstructed and not rerun; its digest is not original-run proof.
All these scopes concern launch/protocol behavior, not model obedience or continuous mode enforcement.

## Plan and scope review

`graph.py validate` and `plan_audit.py` pass for the ten-node queue. Independent plan review
caught and fixed: an artificial matrix barrier, missing N-009/N-010 task descriptions,
NOT_SENT incorrectly eligible to count as owner acceptance, and unnamed repair checks.
N-009/N-010 remain blocked on actual owner admission and behavior acceptance. Completing
packets or this report does not complete REQ-006…009. No external owner status was edited. N-004…006 independently reviewed by `/root/observatory_research` at 4808f83b; the exact document digests and contribution disclosure are in [review rounds](../../execution/harness-waves/review.md).

## Combined gate

Initial planning attempt: `bash scripts/ci.sh fast` stopped at a missing local journal
TypeScript dependency. Existing dependencies were then exposed through ignored worktree
links, with pnpm dependency repair disabled (`pnpm_config_verify_deps_before_run=warn`);
no dependency installation was attempted. A development-tree run passed types/design and
many documentation checks, then correctly refused a changed map source stamp while work
was in progress. Neither run certifies the final candidate. A frozen run at 4808f83b then caught four errors in this change’s carry-over registration: a blank line split the table, the status vocabulary was invalid, and the asserted count was stale. The row is now parseable with `partially` status, counted and assigned to lane 6; focused register and plan-ID checks pass. Final frozen-candidate receipt follows the corrected run.

## Resource implementation decomposition

[Six bounded packets](../../execution/harness-waves/resource-implementation.md) extend the
existing managed admission/launch/stop/outbox seams. Quota checks and the eight-process
backend cap are not a common builder/reviewer pool. The packets separate atomic reservation,
all-entry enforcement, observed release, durable waits and attributed feedback. Every proposed
acceptance is NOT_RUN. Protocol schemas remain with their existing owner.

## Local stack incident

The operator reported failed journal replay and project registration with `fetch failed`.
Read-only diagnostics found a running OrbStack marker alongside an unresponsive Docker API
and HTTP 503 from the Fabric REST endpoint. Later checks returned Docker `OK`, REST 200
and `running healthy` for the database; no restart or data mutation was performed by this
run. Recovery cause remains unconfirmed. The official MCP then returned `no-project`, so
API health did not complete the user's project-binding flow.
[Timestamped sanitized observations](raw/local-stack-receipt.json) preserve that distinction.

## Open acceptance and continuation

The Fabric project board is unavailable to this session; owner packets are PREPARED / NOT_SENT.
After explicit operator approval, Codex MCP registration succeeded. The official registered
`fabric-mcp` was called through the adapter skill’s stdio client and `fabric_whoami` returned
`no-project`. Project binding is the remaining human step; registration alone is not enrollment. Existing pipeline/hub work is preserved with pinned source
and negative acceptance. Do not substitute messages to sessions or edits to foreign repos.

Native host rule consumption, isolated Codex home discovery, MCP overlay isolation,
non-Claude hooks/recovery, multi-instance gateway support and shared resource admission
remain explicit follow-ups in the matrix and admission specification. Cline plain launch
and shell are not promoted to autonomous executors. The remaining protocol/scheduler and
lesson changes require owning-project work; this Fabric repair wave cannot certify them.

## Retrospective

Actual transport probes prevented a false Kimi fix based only on accepted command flags.
Negative concurrency tests found a second enrollment defect adjacent to the first.
The context compiler's old counters omitted overhead despite apparently bounded selection.
Source hashes made independent review transferable across the integration commit.
The global gate should start after a frozen snapshot, while module reviews can start early.
Sequential mutation/check scripts must use fail-fast shell execution: an ENOSPC failure in
`git add` otherwise lets a later check run against an unintended candidate. The failed add
was retried only after verifying preserved edits and available space; no files were discarded.

## Skills used

<sub>ssheleg skills — task-pipeline · agent-sync · agent-harness · agent-orchestrator · make-skill · working-with-fabric · evidence-docs · project-reports · maintaining-fabric-workspace · skill-search</sub>

- task-pipeline: decomposition, packets, review/fix waves and acceptance.
- agent-sync: shared-register lease and CO reservation.
- agent-harness and agent-orchestrator: context, host capabilities and admission design.
- make-skill and skill-search: skill/hub ownership and semantic discovery.
- working-with-fabric: project board and service authority boundaries.
- evidence-docs and project-reports: source receipts, durable report and indexing.
- maintaining-fabric-workspace: distinction between source delivery and publication.

The three project-specific skills are not family-pack replacements; they own Fabric,
reporting and publication respectively. No product UX/design route was needed for these
repairs to existing internal contracts. Signature generated by `sshlg-skills signature`.
