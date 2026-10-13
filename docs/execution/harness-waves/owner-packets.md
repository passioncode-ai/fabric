# CO-282 — owner integration packets

**PREPARED / NOT_SENT.** Fabric COM is unavailable in this session. These are
review inputs for existing owner work, not new canonical upstream task IDs.
A prepared packet, submission or acknowledgement does not establish behavioral
acceptance. [The plan](../../evidence/plans/2026-10-13-harness-waves.md) owns this
run's scope; N-009/N-010 retain the upstream acceptance obligations.

## Source pins

Remote states were read on 2026-10-13 with
`gh pr view <number> -R <owner/repo> --json state,headRefOid,mergeCommit`.

| Owner work | Inspected candidate or merge | Observed state |
|---|---|---|
| [task-pipeline #112](https://github.com/ssheleg/task-pipeline/pull/112) | `ad3d0894d070530c941b746b747c71333fe2bb77` | OPEN |
| [task-pipeline #114](https://github.com/ssheleg/task-pipeline/pull/114) | `e1d5b062ef830c0a2d7695bef7ea319d704639d8` | OPEN |
| [hub #208](https://github.com/ssheleg/sshlg-skills/pull/208) | `edc6b9c590bd86ff19cb5201f1d22114e6b3c5c3` | MERGED |
| [hub #209](https://github.com/ssheleg/sshlg-skills/pull/209) | `15341c0b8636e85f068299df0b573cdb6ac0b5bc` | MERGED |
| [hub #213, L1](https://github.com/ssheleg/sshlg-skills/pull/213) | `4bacda2082ccc9c4eccd67ddf8c7351773016ba2` | OPEN |
| [hub #214, L5](https://github.com/ssheleg/sshlg-skills/pull/214) | `e27a040b74e99358bfa8c965ae835acc31d9b50b` | OPEN |

Refresh heads before dispatch. Uncommitted owner changes are not covered by these
pins. Reconcile an existing fix before proposing duplicate work.

## Pipeline: artifact-bound asynchronous certification

**Owner:** task-pipeline, existing #112/#114. **Consumer seam:** Fabric execution
packet/result contracts. **Requested outcome:** preserve asynchronous review while
binding each report to the artifact and dispatch it examined.

Evidence at #112: [graph.py:1582–1648](https://github.com/ssheleg/task-pipeline/blob/ad3d0894d070530c941b746b747c71333fe2bb77/plugins/task-pipeline/skills/task-pipeline/scripts/graph.py#L1582)
validates report contents and stamps the collector's HEAD; lines 1638–1648 advance
history on each invocation. A temporary fixture importing this exact committed
source accepted reports without candidate fields (`tier_violations=[]`). Reusing
three unchanged reports for `blind`, `blind`, `adversarial` submissions produced
`round=3`, `R3_owed_shortfall=None`; certification used the collector's HEAD.
This was a local logic reproduction, not a native runtime test.

**Proposed fields, subject to the contract owner's review:** candidate SHA/tree,
input and contract digests, node/attempt/fence, dispatch ID, round ID, report
digest, actual review kind, reviewer identity and limitations. The collector
compares these to admitted work; its cwd or a CLI label cannot supply missing
review provenance. An identity field alone does not prove reviewer independence.

**Acceptance fixtures:**

1. Matching reports from one admitted candidate aggregate successfully.
2. Candidate A reports collected at B are rejected without advancing the round.
3. A changed dependency digest invalidates affected reports; unrelated evidence
   remains valid when its input closure is unchanged.
4. Identical submission is idempotent, including a retry after uncertain acknowledgement.
5. Relabeling ordinary reports adversarial cannot satisfy adversarial acceptance.
6. A superseded attempt remains historical evidence and cannot close current work.
7. A distinct admitted review round advances exactly once.

Use temporary repositories A/B, fixed reports and injected dispatch receipts;
no model calls are needed to exercise the aggregation boundary. Preserve the
negative failure output before the fix and its passing rejection afterward.

**Return receipt:** owner commit, fixture commands/exits, report digests, schema
version and consumer compatibility. Until behavioral evidence arrives, REQ-006
remains unresolved; preparing this packet is only N-005's document deliverable.

## Pipeline and Observatory: lessons remain evidence until adopted

**Owners:** task-pipeline consumer; Observatory lesson/search contract.
**Existing work:** #112 lesson adapter, #209 index ownership, owner lesson capability.

At #112, [iteration.md:284–298](https://github.com/ssheleg/task-pipeline/blob/ad3d0894d070530c941b746b747c71333fe2bb77/plugins/task-pipeline/skills/task-pipeline/references/iteration.md#L284)
infers filtering from a returned `kind` field and makes an observed lesson
binding. [lessons.py:747–769](https://github.com/ssheleg/task-pipeline/blob/ad3d0894d070530c941b746b747c71333fe2bb77/plugins/task-pipeline/skills/task-pipeline/scripts/lessons.py#L747)
emits generic `observatory_record` notes. Later adapter work must be reviewed at
its own committed head before it supersedes this observation.

**Requested review:** separate confidence, applicability and authorized adoption.
Negotiate a supported producer/search contract; validate returned kinds.
Filtering must precede the result limit. Record found, applied and helped
separately; agreement between copied notes is not independent corroboration.

**Acceptance fixtures:**

- A corroborated lesson cannot override a conflicting current ADR or grant.
- A result carrying `kind: note` is not accepted as a filtered lesson.
- Relevant lessons survive a candidate pool crowded by irrelevant history.
- Unsupported filtering, zero matches and unavailable service remain distinct.
- Emit → validate → store → retrieve preserves identity/revision and provenance.
- Repeated submission from one origin revises or deduplicates; it does not corroborate.
- Correction/supersession changes subsequent consumption while preserving history.
- An unavailable shared store explicitly uses the bounded local fallback.

**Return receipt:** producer/consumer schema pins, deterministic round-trip
fixtures, and separately labelled live acceptance. N-009/REQ-007 stay unresolved
until required consumer behavior is observed through the owner's admitted path.

## Hub, Observatory and Fabric: host-aware capability selection

**Owners:** hub #213/#214; Observatory PB-159; Fabric RM-23; Dashboards FD-61.
The lifecycle broker owner decides on-demand process lifetime. The accepted
[MCP loading design](https://github.com/ssheleg/sshlg-skills/blob/edc6b9c590bd86ff19cb5201f1d22114e6b3c5c3/docs/evidence/specs/2026-10-13-mcp-loading.md#L64)
records the ownership split and migration constraints.

Preserve that division: hub owns catalog/visibility metadata and non-Fabric host
fallback; RM-23 owns Fabric-started session visibility; Observatory owns private
MCP profiles/materialization; gateway configuration retains its generator;
service lifetime stays with the supervising owner.

For each host/version, record listing hiding, invocation denial, project scope,
instruction delivery, MCP selection, native identity, checkpoint hooks, resume
and receipt enforcement. Each cell is supported, unsupported or unverified,
with source and observed test level. The pinned #213
[hostvis.js](https://github.com/ssheleg/sshlg-skills/blob/4bacda2082ccc9c4eccd67ddf8c7351773016ba2/lib/hostvis.js#L7)
explicitly distinguishes unsupported hiding from a supported invocation denial.
Do not flatten that distinction into an all-host PASS.

**Negative acceptance:** missing host switch cannot become supported; invocation
denial cannot count as listing removal; configured MCP cannot count as healthy,
authorized or used; global fallback cannot overwrite Fabric session policy;
profile application preserves live sessions and never copies secret values.

**Return receipt:** effective-loader/configuration evidence at pinned versions,
then native probes where needed. N-010/REQ-008 remain unresolved for unsupported
or unverified required behavior. These packets do not authorize a new MCP writer.

## Dispatch and return

When COM is available, submit to the owning Project with the source-pinned
packet. Record board receipt, owner response and canonical task reference.
No session message, foreign HANDOFF edit or PR comment substitutes for this route.

Return states: prepared, submitted, acknowledged, accepted-for-work, implemented,
verified, rejected, superseded. Only verified behavior satisfies a behavioral
requirement. Board availability does not authorize consent, spending or secrets.

## Later owner-head reconciliation — 2026-10-13 01:38:45 UTC

A second read found four changed OPEN candidates. These do not replace the earlier
historical findings or inherit their runtime tests. [Machine receipt](../../reports/2026-10-13-harness-wave-review/raw/owner-head-refresh.json).

| Work | Newly inspected head | Source-level disposition |
|---|---|---|
| task-pipeline #112 | c8bed2a1022849b658080e3b941ae708c39e318d | lesson emitter added; certification and adoption gaps remain |
| task-pipeline #114 | 6875e04b1a5d4ec2c3ca599d8bbb61e480b401f3 | same graph/doctrine boundaries; no live store receipt |
| hub #213 | 18a2a7703b7926cdafd62dd6dd8a2d0067820503 | scoped consent and recoverable host writes improved |
| hub #214 | ff33a3b1ccac249077085785ec61f130d70ee355 | effective Claude settings and disabled-skill search improved |

Reviewer `/root/pipeline_research` read committed bytes without running tests.
Both pipeline heads share graph blob6507d0616c7cd6719593b9b96a87c3a65c3b2b0b and
iteration blob45b738ef4c5dab29c73200030adde9f8d10409e5.
[graph.py677–678 and1635–1653](https://github.com/ssheleg/task-pipeline/blob/c8bed2a1022849b658080e3b941ae708c39e318d/plugins/task-pipeline/skills/task-pipeline/scripts/graph.py#L1635)
still omit reviewed candidate/input/dispatch bindings, stamp the collector HEAD and
append round/history on each call; the old replay reproduction was not rerun.
[iteration.md283–297](https://github.com/ssheleg/task-pipeline/blob/c8bed2a1022849b658080e3b941ae708c39e318d/plugins/task-pipeline/skills/task-pipeline/references/iteration.md#L283)
still infers filter support from kind and promotes an observed lesson to a standing
instruction without an adoption record.

The earlier emitter gap is addressed in source:
[lessons.py895–928](https://github.com/ssheleg/task-pipeline/blob/c8bed2a1022849b658080e3b941ae708c39e318d/plugins/task-pipeline/skills/task-pipeline/scripts/lessons.py#L895)
supports `observatory_lesson`, with owner/classKey/title/trigger/check/nouns/origin;
argument-shape tests at test/lessons_test.py265–275 were added. These tests were NOT_RUN
in this refresh; schema compatibility and emit→store→retrieve remain unverified.
The index-ownership reference now cites merged hub#209. Do not ask an owner to rebuild
these completed source changes; test and integrate the current producer instead.

Reviewer `/root/mcp_research` inspected both hub heads without tests or config writes.
L1 now journals host writes and refuses ambiguous recovery while preserving bytes,
modes and symlinks ([visibility-state.js27–95](https://github.com/ssheleg/sshlg-skills/blob/18a2a7703b7926cdafd62dd6dd8a2d0067820503/lib/visibility-state.js#L27)).
L5 derives Claude user→project→local enablement, keeps disabled installed skills searchable,
and avoids arming absent/repeated routes ([enablement.js42–49](https://github.com/ssheleg/sshlg-skills/blob/ff33a3b1ccac249077085785ec61f130d70ee355/lib/enablement.js#L42),
[conflicts.js243–296](https://github.com/ssheleg/sshlg-skills/blob/ff33a3b1ccac249077085785ec61f130d70ee355/lib/conflicts.js#L243)).
Catalogue enumeration still uses Claude roots; this is not all-host discovery. L1 still
writes the normal Codex home, so Fabric's isolated CODEX_HOME remains an acceptance gap.
[hostvis.js118–125](https://github.com/ssheleg/sshlg-skills/blob/18a2a7703b7926cdafd62dd6dd8a2d0067820503/lib/hostvis.js#L118)
explicitly cannot hide Cursor/Kimi entries: invocation denial is not listing removal.

Neither hub head contains the other (both ancestry checks exit1); combined L1+L5 behavior,
installation and native-host readback remain unverified. MCP loading doctrine is unchanged:
these PRs do not implement the Observatory profile writer, gateway selection or Fabric
session policy. Their owner routes remain in force. No cross-project board packet was sent.
