# CO-282 — owner integration packets

**PREPARED / NOT_SENT.** Fabric COM is unavailable in this session. These are
review inputs for existing owner work, not new canonical upstream task IDs.
A prepared packet, submission or acknowledgement does not establish behavioral
acceptance. [The plan](../../evidence/plans/2026-10-13-harness-waves.md) owns this
run's scope; N-009/N-010 retain the upstream acceptance obligations.

## Latest inspected owner source: 12:06 UTC

[The current bounded readback](../../reports/2026-10-13-resource-admission-contract/raw/owner-refresh-1206/receipt.json) supersedes the earlier state table below for dispatch preparation. Task-pipeline main is `540679ea7552f8a37e99560e287a69c23cbd3c4a` (source1.94.1); #112 merged as `4d750573ce53ea4c7ffa2bde192ee35b59acefa7`. Its selected graph, lessons and iteration bytes are identical to the09:19 readback: candidate/input/dispatch certification, idempotent rounds and authorized lesson adoption remain open. The new release-gap repair is a separate change. Latest published release is still1.93.3; installation was not refreshed here.

Hub main/release remain `a17f829e8d652ce7f68423b67e0de00fb89b3693` /1.62.2. Observatory service status returned `Transport closed`; no fresh runtime version or collector health follows. The [official Fabric probe](../../reports/2026-10-13-resource-admission-contract/raw/closing/board-official-1158.json) reports that the hub cannot check credentials. All packets remain PREPARED/NOT_SENT. Refresh current owner heads again before actual dispatch.

## Historical source pins

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

## Agent-sync — expired own Git lease reported as acquired

**Owner:** agent-sync. **Delivery:** PREPARED / NOT_SENT; Fabric project board is not admitted.
**Observed version:** 1.22.1, `scripts/agent_sync.py` SHA-256
`455d99c97894e4b5033399fac3fc5c638375dffae531982f22a8bd6899e56302`.

Source review: `_git_acquire` lines2213–2218 accepts its own run id before checking
expiry. It writes the old payload locally and touches the renewal throttle marker,
without refreshing the remote ref. `guard` lines4240–4250 trusts that result and
reports the resource claim taken. `held` lines3421–3423 correctly excludes expired
leases; `_refresh_lease` lines2799–2807 correctly refuses resurrection. Explicit
`acquire` calls the same defective path, so its success is not independent proof.

This run observed that discrepancy for its own plan, carry-over and retrospective
resource claims while the main task lease remained live. The tool allowed edits
under a false resource-success report. Recovery reaped only those provably owned,
expired refs, checked their removal, and acquired fresh refs. No foreign lease was
reaped or overwritten. Fresh currentness must be verified from the lease plane,
not the success wording. This is disclosed coordination debt, not retroactive proof
that the preceding resource claims were live. No foreign overlap was observed.

Proposed correction: expired-own acquisition follows strict remote read and SHA-fenced
CAS, creating a fresh payload or refusing. Re-acquiring a live own lease must not reset
the throttle unless it refreshes the authoritative lease. Regression: controlled clock,
expired same-run resource and live task lease; require fresh CAS or refusal. An owned
bare-repository fixture then checks a competing writer/CAS loss, malformed remote,
unreadable remote, and live-own timestamp behavior. Installed tool files are unchanged.
The [isolated executable regression](../../reports/2026-10-13-resource-admission-contract/raw/agent-sync-expired/receipt.json) now reproduces actual guard/acquire code reporting success with zero CAS and an expired resource. Git/clock/state are isolated; live remote competition tests and a released fix remain NOT_RUN / NOT_IMPLEMENTED. Exit0 explicitly means DEFECT_REPRODUCED.


## Latest skill-hub release reconciliation — 2026-10-13

The earlier snapshots above remain historical. Published hub `v1.62.1` resolves to
`ae1b415bc79a3d89ca97199299e0e00a2a5e7674`; the [durable native visibility
report](https://github.com/ssheleg/sshlg-skills/blob/b6e8bb4bb7cc76ada212f8d0078ec94cfe20adb5/docs/reports/2026-10-13-native-visibility-rollout/README.md)
is committed at`b6e8bb4bb7cc76ada212f8d0078ec94cfe20adb5` on verified remote
`waves/2026-10-13-installed`. This run read its sanitized committed evidence, not
private logs or current machine configuration.

Do not request rebuilding completed work: multi-host catalogue discovery and isolated
CODEX_HOME/profile-aware writer ownership are implemented in the published source
(`lib/catalogue.js`, `bin/sshlg-skills.js`). Release and listed installed-byte readback
also have owner receipts; plain-host update remains `DEFERRED_B186`. Local later
installer work is not silently treated as released.

The report records Pi loaded skills499→178 with all39 family entries retained; Gemini
179 enabled/320 disabled; Hermes228/321 with full family identity unproven; OpenCode
321 denies while inventory536 is not active prompt proof. Pi's controlled loader
comparison reduces prompt UTF-16 text308638→144221 (53.2718%). These are the owner's
bounded snapshot measurements, not measured model tokens, money savings, routing
quality or task success. Claude/Codex fresh native discovery remains NOT_RUN; Cursor
and Kimi listing hiding is unsupported.

Remaining acceptance: Fabric-isolated Codex sessions and Claude discovery; complete
Hermes identity readback; OpenCode per-agent override boundary and Gemini warnings;
pending plain-host installer bytes. Search hidden-status annotation still reads a
hard-coded Claude settings path in published CLI around1865: this static finding
is not a rerun regression. MCP profile/runtime ownership remains separate with
Observatory writers, Fabric RM-23 visibility and lifecycle decisions. All new owner
requests remain PREPARED / NOT_SENT at the project-access consent gate.


## Incoming integration reconciliation — ac874946

Before owner delivery, reconcile the deferred COM03 wave2 SQL filename107 with the
resource preparation107, and the unapplied COM03 carryover patch's unrelated CO282
with this plan's canonical CO282. Do not apply the patch, renumber historical receipts
or interpret pending filenames as active reservations. See [N021 evidence](../../reports/2026-10-13-resource-admission-contract/raw/n021/README.md).
Requests remain NOT_SENT: project consent was not granted to this session.


## Agent-sync installed refresh — 1.22.2

The installed script changed during this run; the earlier1.22.1 snapshot remains
historical. Current1.22.2 `agent_sync.py` SHA-256 is
`fba3e2d99cad3982b3d81cab9c2ae7a255265ddddcd249aee81dca866e457ee1`.
Source inspection of `_git_acquire` still finds the same-run return before expiry
and remote CAS. The update does not resolve the owner packet above. N023's
producer-boundary fixture reads the current producer expression and records its
one-second `ts`/`since` boundary; this supports reader compatibility, not a fix to
agent-sync. Owner delivery remains PREPARED / NOT_SENT.


## Prepared owner packet refresh — 2026-10-13T05:23:13.800678+00:00

Read-only source refresh. No tests, installation, owner message, or board submission ran. Delivery remains **PREPARED / NOT_SENT**. Preserve the existing dated snapshots and append a new reconciliation rather than rewriting their evidence.

| Work | Current source | Remote disposition |
|---|---|---|
| task-pipeline #112 | `25dc4f898c143d410cb8cc0b8f17e4edd73da6eb` | OPEN |
| task-pipeline #114 | head `6e0e57e607db0a61226b9b5427bf0d74ba93c66d`; merge `25dc4f898c143d410cb8cc0b8f17e4edd73da6eb` | MERGED into #112's branch; not released main |
| hub #213 | `18a2a7703b7926cdafd62dd6dd8a2d0067820503` | CLOSED, no merge commit |
| hub #214 | `ff33a3b1ccac249077085785ec61f130d70ee355` | CLOSED, no merge commit |
| hub v1.62.2 | `a17f829e8d652ce7f68423b67e0de00fb89b3693` | GitHub release published 2026-10-13T04:59:54Z |
| task-pipeline v1.93.3 / main | `52fa75dbe1a3d169c02c612516b30028929559f9` | latest GitHub release remains v1.93.3; #112 changes not released there |

### Exact corrections for the next owner packets

1. Target current task-pipeline #112 for integration; #114 is no longer a pending independent candidate. Its [committed test receipt](https://github.com/ssheleg/task-pipeline/blob/25dc4f898c143d410cb8cc0b8f17e4edd73da6eb/docs/evidence/runs/2026-10-13-pr114-current.json#L2) names source `31e0f5ae…`, so do not attach that PASS automatically to final head `25dc4f89…`.
2. Keep candidate-bound certification/idempotent-round acceptance open. [graph.py677–678 and1635–1653](https://github.com/ssheleg/task-pipeline/blob/25dc4f898c143d410cb8cc0b8f17e4edd73da6eb/plugins/task-pipeline/skills/task-pipeline/scripts/graph.py#L1635) is byte-identical to the earlier inspection (blob `6507d0616c7cd6719593b9b96a87c3a65c3b2b0b`). No new runtime regression was run.
3. Keep kind-filter validation and authorized lesson adoption open: [iteration.md308–322](https://github.com/ssheleg/task-pipeline/blob/25dc4f898c143d410cb8cc0b8f17e4edd73da6eb/plugins/task-pipeline/skills/task-pipeline/references/iteration.md#L308) retains both earlier boundaries. Credit the new [promotion follow-up rule351–353](https://github.com/ssheleg/task-pipeline/blob/25dc4f898c143d410cb8cc0b8f17e4edd73da6eb/plugins/task-pipeline/skills/task-pipeline/references/iteration.md#L347); it improves ownership tracking but does not make observed evidence an authorized instruction.
4. Do not request another lesson emitter. The dedicated tool route and newer redaction-compatible `commit:<12hex>` origin are [implemented965–998](https://github.com/ssheleg/task-pipeline/blob/25dc4f898c143d410cb8cc0b8f17e4edd73da6eb/plugins/task-pipeline/skills/task-pipeline/scripts/lessons.py#L965). Ask for source-pinned producer/store/search round-trip acceptance. Also credit the distinct [release authority locator work](https://github.com/ssheleg/task-pipeline/blob/25dc4f898c143d410cb8cc0b8f17e4edd73da6eb/docs/evidence/runs/2026-10-13-l3-authority-record.md#L12), without calling it an executable grant.
5. Replace the stale blanket B186 implementation deferral with **implemented in published hub v1.62.2 source; installed payload/native acceptance not established here**. The [production entry](https://github.com/ssheleg/sshlg-skills/blob/a17f829e8d652ce7f68423b67e0de00fb89b3693/bin/sshlg-skills.js#L371) now uses the [immutable member plan24–45](https://github.com/ssheleg/sshlg-skills/blob/a17f829e8d652ce7f68423b67e0de00fb89b3693/lib/installer-pins.js#L24). The committed pre-release handoff's publication wording is superseded by GitHub release metadata only; do not infer host refresh from publication.
6. Reference current published hub source instead of treating closed #213/#214 as pending branches. Preserve existing bounded native visibility receipts and their limits. The [hard-coded Claude search-visibility lookup1871](https://github.com/ssheleg/sshlg-skills/blob/a17f829e8d652ce7f68423b67e0de00fb89b3693/bin/sshlg-skills.js#L1867) remains a source-level follow-up. Fabric-isolated Codex/native Claude acceptance is not established by this refresh.
7. Reuse the existing [PB159 consumer preparation](https://github.com/ssheleg/sshlg-skills/blob/a17f829e8d652ce7f68423b67e0de00fb89b3693/docs/evidence/completion-1013/mcp-profile-consumer/README.md#L15); it is a semantic fixture and bounded owner ask, not an Observatory profile writer or accepted wire schema. Its [next request50–57](https://github.com/ssheleg/sshlg-skills/blob/a17f829e8d652ce7f68423b67e0de00fb89b3693/docs/evidence/completion-1013/mcp-profile-consumer/README.md#L50) stays NOT_SENT until a genuine project-board receipt exists.

REQ-006/007/008 and N-009/N-010 do not become complete from these source improvements. Installed agent-sync1.22.2's expired-own finding was not retested in this bounded remote refresh; its already recorded source snapshot remains separate evidence.


## Owner refresh — 2026-10-13T07:38:32Z

[Read-only remote receipt](../../reports/2026-10-13-resource-admission-contract/raw/closing/owner-refresh-0738/receipt.json)
updates the05:23 snapshot. Pipeline#112 advances to
`9fb9cfb34d83a1395d1d18dbe191d4135395b986`, still OPEN. Its three new commits
add explicit wait identity, wait/resume transitions, next exit6 for watched dependency
leaves, and refusal when graph file locking fails. A recorded watcher locator is data;
the graph does not execute it or prove its process exists.

The [candidate collector and round update](https://github.com/ssheleg/task-pipeline/blob/9fb9cfb34d83a1395d1d18dbe191d4135395b986/plugins/task-pipeline/skills/task-pipeline/scripts/graph.py#L1734)
remains byte-identical at the inspected boundary; candidate-bound/idempotent acceptance
is still open. The delta does not change iteration.md or lessons.py. Preserve credit
for the previously implemented emitter and published hubB186; do not request duplicates.
Other dispositions and released main hashes match05:23: #114 merged into#112's branch,
hub208/209 merged,213/214 closed without merge. No new main release or native evidence
was inferred. N009/N010 remain PREPARED / NOT_SENT while the official board is unavailable.


## Owner refresh —09:19UTC and Observatory10:04UTC

The [source/install refresh](../../reports/2026-10-13-resource-admission-contract/raw/owner-refresh-0919/receipt.json) supersedes the earlier OPEN disposition: pipeline#112 merged at08:03UTC, merge4d750573; inspected main78c42124db910c56e74c8fbd524bdc9a4f8fb6c9 declares1.94.0. Latest release and inspected installed Codex/Claude payloads remain1.93.3; installed lessons.py is absent. Graph/lesson/iteration bytes at the inspected boundaries retain the candidate provenance and kind-filter findings. Request the missing acceptance and correction, not duplicate emitter implementation. Published hub remains1.62.2 at a17f829e. Gateway inventory17declared/14enabled/3disabled/7roles is configuration evidence, not proof every upstream is healthy or running.

The [specific Observatory service readback](../../reports/2026-10-13-resource-admission-contract/raw/closing/observatory-readback-1004.json) reports degraded0.24.4 and10consecutive collector tick timeouts. Registry freshness must remain explicit: current HTTP/service status cannot update observation timestamps or transform missing/incomplete collectors into zero. Owner follow-up should cover bounded collector scheduling/backpressure and freshness metadata without resetting foreign services, dropping sources or treating old Heroku load diagnostics as current host measurements. This run invoked no collector or doctor.

Delivery remains **PREPARED / NOT_SENT**. Official project-access consent was still waiting on the bounded watcher; MCP registration does not authorize the binding. Source snapshots above are dated, not substituted for owner acknowledgement, installed adoption or native positive/negative acceptance.
