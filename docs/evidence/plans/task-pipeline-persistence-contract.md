# Task-pipeline persistence contract — a bounded decision, not an execution

**Status: DECIDED, NOT EXECUTED.** This artifact reserves identifiers and
records a decision (sherlock audit, FIX-PF-06.03). No migration has been run,
no ADR has been written, and nothing below claims otherwise — migration
execution is a future change with its own review, and this file is refused as
evidence of it.

## 1. Is new DB schema needed? — YES, and here is the gap measured

ADR-0009 ("the development pipeline is data the operator can edit") promises a
versioned pipeline, a pinned running graph and registry skills. What the
runtime paths actually touch today: `project_tasks`, `task_links`,
`task_handoffs`, session context and the runner registry. A search of
`supabase/migrations/` finds **no** pipeline definition storage,
**no** graph-version pinning, and **no** skill-provisioning tables. The promise
has no persistence to land on; new schema is required.

## 2. Reserved Create IDs — new artifacts only, old ones read-only

Existing migrations and ADRs are **read-only**: a reservation here creates NEW
identifiers and never renumbers, edits or reuses an applied artifact.

| Kind | Reserved ID | Purpose |
|---|---|---|
| migration | `20261003000073_pipeline_definitions.sql` | pipeline-as-data: definitions + versions, append-only |
| migration | `20261003000074_graph_version_pins.sql` | the running graph pinned to a pipeline version |
| ADR | `docs/adr/0104-task-pipeline-persistence-contract.md` | the contract itself, superseding nothing. Re-reserved from 0055 on 2026-09-10, from 0056 on 2026-09-12, from 0082 on 2026-09-29 (ADR-0084, releases, was written past it), from 0085 on 2026-09-29 (ADR-0086, positioning, was written past it), from 0087 on 2026-09-29 (ADR-0088, remote surfaces, was written past it), from 0089 on 2026-09-29 (ADR-0090, names, was written past it), from 0091 on 2026-09-30 (ADR-0092–0094, licence, knowledge base and MCP-first, were written past it), and from 0095 on 2026-09-30 (ADR-0096, publication redaction, was written past it): each time an ADR handed out by agent-sync passed this prose reservation (0055 was written; then ADR-0057 continued the sequence past 0056), because a reservation living in prose never reaches the register. The document's own collision rule owns both moves. Re-reserved again from 0099 on 2026-10-03 (ADR-0100 and ADR-0101, the start paths and the general plan, were written past it), and from 0102 later the same day (ADR-0103, the write-boundary rule, was written past it). |

**The collision this document predicted happened, and the rule was applied.**
The first reservation, written on `sherlock/impl-20260907`, took migrations
`…000052`/`…000053` and ADR `0051` against a branch whose latest migration was
`20260909000049_task_runs.sql`. While that branch sat unmerged, the main line
claimed all three: `20260909000052_membership_authority.sql` is the latest
migration, and `0051`/`0052` are ADRs
(`0051-provider-accounts-and-conversation-continuity.md`,
`0052-provider-account-automatic-switching.md`). Per the rule below, the
reservation moved to the NEXT free ids on the consolidated line rather than
renumbering anything applied. Nothing was renumbered, edited or reused.

**And it happened a SECOND time, on 2026-09-10, which is the rule working rather
than failing.** FA-04 needed a migration and an ADR and took the next free ids on
the main line — `20260910000053_link_tasks_command.sql` and
`0053-a-link-is-one-act-and-provenance-is-not-dependency.md` — while this
reservation still sat unexecuted. Per the rule below the reservation moved again,
inside that executing change, to `20260910000054`, `20260910000055` and ADR
`0054`. Nothing here was renumbered, edited or reused, and nothing applied was
touched. The register bumping to `ADR-0054` while this document still named
`0053` is exactly the state the rule exists for: a reservation is a claim on
ordering discipline, not a lock, and the executing change wins.

The IDs continue the observed sequences on the consolidated line: the latest
migration is `20260910000059_project_configured.sql` and the latest ADR is
`0054`, both observed on 2026-09-10 after UX28-11 landed. The reservation has now
moved eight times, which is the rule working rather than failing: FA-03 took ADR `0054`,
FA-02 took migration `…000054`, AX-01 took `…000055` FA-06 took `…000056` and `…000057`, FA-07 took
`…000058`, and UX28-11 took `…000059` for the one settings event that replaced two, each while this
reservation still sat unexecuted, and each time it
moved to the next free ids inside the executing change. Nothing here has ever been renumbered, edited or
reused, and no applied artifact has been touched — which is exactly the rule
AX-01 found broken elsewhere: commit `242eeb8` edited migration 44 in place,
after it was deployed, and an estate that applied it earlier never received the
change.
A collision at execution time — someone else
claimed `…000054` first — re-reserves the NEXT free id in the executing change;
the reservation is a claim on ordering discipline, not a lock.

**2026-09-15 continuation:** ADR-0059 now exists for the personal Fabric/pulse design. The unexecuted reservation moves from 0058 to 0060 under the same collision rule. ADR-0060 was reserved through agent-sync with key `pipeline-persistence-after-pulse-20260915`; no ADR-0060 file or migration was executed. Earlier reservations above remain historical evidence, not active claims. The latest source ADR at this check is `0059-personal-fabric-and-evidence-backed-pulse.md`.

**2026-09-17 continuation:** ADR-0061 now records setup before managed activation. Under this document’s existing next-free ordering rule, the unexecuted pipeline reservation moves from 0060 to 0062, reserved through agent-sync by `fabric-adoption-build-20260917`. No pipeline ADR or migration was executed; historical reservations above remain evidence. The latest source ADR is `0061-project-setup-precedes-managed-activation.md`.

**2026-09-25 continuation:** ADR-0063 records the CEO-first target. The unexecuted pipeline reservation moves from 0062 to 0064 under the existing ordering rule; agent-sync returned ADR-0064 for key `pipeline-reservation-after-first-release-20260925`. No pipeline ADR or migration is executed. Earlier reservations remain historical.

## 3. Recovery approach

- Both new tables are **append-only**: a pipeline edit inserts a new version
  row, never updates one; the pin table records which version a graph run
  holds, so recovery after a crash is `select` the pin, never a reconstruction.
- `schema_version()` (migration `20260909000051_schema_version.sql`, on
  `main`) is the gate: the app refuses to
  start against a database older than the code expects, so a half-applied
  upgrade fails closed instead of running on missing tables.
- Rollback of an unexecuted reservation is deleting this file's rows from the
  table above — nothing else exists yet to roll back.

## 4. Upgrade criteria — when execution is justified

Execute the reserved migrations when ANY of:
1. a second consumer needs the pipeline definition (today the single desktop
   process holds it in memory);
2. a graph run must survive an app restart with its pipeline version proven
   (the pin has a reader);
3. skill provisioning becomes data the operator edits (ADR-0009's third
   promise gets a user).

Until one of these is true, the in-memory pipeline is the cheaper contract and
executing the migration would add schema nobody reads.

**2026-09-26 continuation:** ADR-0065 records conversation-led work. The unexecuted reservation moves from 0064 to 0066 under the same ordering rule; agent-sync returned ADR-0066 for key `pipeline-reservation-after-context-board-20260926`. No pipeline ADR or migration was executed.

**2026-09-26 chat continuation:** ADR-0067 records stable conversation identity and selectable knowledge. The unexecuted pipeline reservation moves from 0066 to 0068 under the existing ordering rule, reserved by agent-sync key `pipeline-reservation-after-chat-workspace-20260926`. No pipeline ADR or migration was executed.

**2026-09-26 toolkit continuation:** ADR-0070 records the PassionCode.ai toolkit and shared design-system direction. Under the same ordering rule, the unexecuted pipeline reservation moves from 0068 to 0071; agent-sync returned ADR-0071 for key `pipeline-reservation-after-toolkit-launch-20260926`. No pipeline ADR or migration was executed. Earlier reservations remain historical.


**2026-09-26 memory continuation:** ADR-0069 records Project memory. The unexecuted pipeline reservation moves from 0068 to 0072, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-project-memory-20260926` for run `r-410f09da3`. No pipeline ADR or migration was executed. A local checkout cannot infer the next global ID from its latest ADR: concurrent branches reserve IDs in the shared Git authority. The regression check now preserves those issued gaps instead of requiring local maximum + 1.

Reserved elsewhere: ADR-0070 at `ae02e7b02b53451a48d0a76ce94fc4393398e26b` (key `PC-LAUNCH-20260926`); ADR-0071 at `66e163075fb81bdecf4fcd6caa90866759c82f28` (key `pipeline-reservation-after-toolkit-launch-20260926`). Evidence: `git log --format='%H %B' refs/agent-sync/fetched-id`, read 2026-09-26; these counter commits record `next: 71` and `next: 72` respectively for run `r-codexfabricn`. They are reservations, not ADRs applied in this checkout. Never reuse or fabricate their files.

**Integration continuation:** the toolkit branch at `820ee2538007c78f9e3467bee381a7d62ce5553a` is now integrated into the memory branch. ADR-0070 is therefore an applied direction here; the earlier paragraph above describes its reservation-time state. ADR-0071 was not executed and is superseded by reservation ADR-0072. Its issued number is not reused.

**2026-09-27 harness continuation:** the current latest migration is `20260927000060_continuation_dispatch.sql`. The two unexecuted pipeline reservations move to `20260927000063_pipeline_definitions.sql` and `20260927000064_graph_version_pins.sql` under the same collision rule. No pipeline persistence was executed; delivery fencing is a separate operational contract. Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-09-27 managed launch:** migration `20260927000061_managed_task_launch.sql` takes the next schema position. Unexecuted pipeline reservations are now `20260927000063_pipeline_definitions.sql` and `20260927000064_graph_version_pins.sql`; pipeline persistence itself remains unimplemented. The new launch protocol is described in [R0 checks](../../launch/harness-r0/checks.md).

**2026-09-27 observed Stop:** additive migration `20260927000062_managed_stop.sql` owns position 62. The still-unexecuted pipeline reservations move to 63/64; no pipeline implementation is implied. Trusted Stop and never-spawned receipts are operational authority, not projections or mirrored declarations. See [Stop contract](../../launch/harness-r0/stop.md).

**2026-09-27 capture recovery:** migration `20260927000063_transcript_recovery.sql` and ADR-0073 now own their positions. The unexecuted pipeline reservations move to migrations 64/65 and ADR-0074, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-transcript-recovery-20260927` for run `r-1d9cd5615`. Earlier issued numbers remain historical and are never reused. No pipeline migration or ADR has been implemented. Verification: `python3 test/audit_regressions/fix-pf-06.03.py`.


**2026-09-27 private CEO storage allocation:** ADR-0075 records the audience and opaque-receipt boundary. Migration position64 is allocated to the next bounded CEO storage packet, not yet applied. The unexecuted pipeline reservations move to65/66; ADR-0076 was reserved through agent-sync with key `pipeline-reservation-after-private-ceo-20260927`. No applied artifact is renumbered and no pipeline persistence is implemented. The explicit schema range remains63 until the reviewed migration/readers are integrated.

**2026-09-27 private CEO storage integration:** the reviewed source now includes
`20260927000064_private_ceo_conversations.sql` and ADR-0075. The current explicit
reader/writer contract is64–64 after an owned full-chain test; no live migration
has been applied here. The unexecuted pipeline reservations remain65/66 and
ADR-0076. The allocation paragraph above describes its earlier state, not the
current source. `python3 test/audit_regressions/fix-pf-06.03.py` checks this
continuation against the actual migration and ADR inventories.


**2026-09-27 restore authority allocation:** ADR-0077 records the durable archive
authority boundary. Position65 is allocated to A0
`20260927000065_restore_authority_boundary.sql` (not yet integrated/applied in this
host/view iteration). The unexecuted pipeline reservations move to66/67 and
ADR-0078, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-restore-boundary-20260927`
for run `r-1d9cd5615`. Applied migrations remain unchanged and the current explicit
schema range stays64 until the separately reviewed A0 integration.


**2026-09-27 restore authority integration:** migration
`20260927000065_restore_authority_boundary.sql` is present in the source;
explicit runtime schema admission is65–65. Unexecuted pipeline reservations
remain66/67/ADR78. This does not migrate an operator database or implement
pipeline persistence. [Integration evidence](../../launch/harness-r0/checks.md#restore-boundary-and-native-pty--2026-09-27).


**2026-09-27 private archive allocation:** [ADR-0079](../../adr/0079-private-conversation-archives-preserve-history-not-authority.md)
accepts the bounded private format and independently authorized atomic destination.
Slot 66 is allocated to `20260927000066_ceo_private_archive.sql`; the actual latest
migration remains `20260927000065_restore_authority_boundary.sql` until integration.
Unexecuted pipeline reservations move to 67/68/ADR0080, returned by agent-sync key
`pipeline-reservation-after-private-archive-20260927`, run `r-1d9cd5615`.
This allocation does not apply any schema or implement pipeline persistence.

**2026-09-27 Codex topology collision:** agent-sync returned ADR-0081 to
[the loopback topology decision](../../adr/0081-codex-execution-uses-an-owned-authenticated-loopback-backend.md),
so the unexecuted pipeline ADR reservation moves from 0080 to **0082** under this document's
collision rule — key `pipeline-reservation-after-codex-topology-20260927`, run `r-7746d4d1c`.
Migrations 67/68 are unchanged. ADR-0080 is superseded, never reused.

**2026-09-28 backend exit receipt:** slot 67 is taken by the executed migration
`20260928000067_backend_exit_receipt.sql` ([first-slice plan B3](2026-09-27-first-slice-plan.md#b3--backend-exit-receipt-and-stop)),
so the unexecuted pipeline migration reservations move from 67/68 to **68/69** under the same
ordering rule; the reserved ADR stays 0082. No pipeline file existed at either number, and no
branch or commit carried one (`git log --all -S pipeline_definitions` names only this document's
history).

**2026-09-29 board deferral and topics:** slot 68 is taken by the executed migration
`20260929000068_board_deferral_and_topics.sql` ([launch UI plan L3b](2026-09-29-launch-ui-plan.md)),
so the unexecuted pipeline migration reservations move from 68/69 to **69/70** under the same
ordering rule; the reserved ADR stays 0082. No pipeline file existed at either number
(`ls supabase/migrations | grep -i pipeline` is empty, and `git log --all -S pipeline_definitions -- supabase`
names no commit).

**2026-09-29 releases:** slot 69 is taken by the executed migration
`20260929000069_releases.sql` ([launch UI plan L8](2026-09-29-launch-ui-plan.md), ADR-0084),
so the unexecuted pipeline migration reservations move from 69/70 to **70/71** under the same
ordering rule. The ADR written for releases, ADR-0084, passed the prose reservation 0082, so the
reserved ADR moves to **0085**, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-releases-20260929`;
0082 is superseded and never reused. No pipeline file existed at any of these numbers
(`ls supabase/migrations | grep -i pipeline` is empty). Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-09-29 positioning:** agent-sync returned ADR-0086 (key `brand-teams-positioning-20260929`) to
[the positioning and licence-wording decision](../../adr/0086-positioning-names-teams-and-the-public-tools-are-source-available.md),
which was written past the prose reservation 0085. Under the same collision rule the reserved ADR
moves to **0087**, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-brand-teams-20260929`;
0085 is superseded and never reused. Migrations 70/71 are unchanged; no pipeline file exists at
0087 (`ls docs/adr | grep 0087` is empty).

**2026-09-29 remote surfaces:** agent-sync returned ADR-0088 (key `fabric-surfaces-relay-20260929`) to
[the remote-surfaces decision](../../adr/0088-fabric-reaches-the-operator-on-three-surfaces-through-one-relay.md),
which was written past the prose reservation 0087. Under the same collision rule the reserved ADR
moves to **0089**, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-fabric-surfaces-20260929`;
0087 is superseded and never reused. Migrations 70/71 are unchanged; no pipeline file exists at
0089 (`ls docs/adr | grep 0089` is empty).

**2026-09-29 names:** agent-sync returned ADR-0090 (key `agent-registry-naming-20260929`) to
[the naming decision](../../adr/0090-names-passioncode-is-the-organization-fabric-is-the-ceo-and-its-tools-carry-its-name.md),
which was written past the prose reservation 0089. Under the same collision rule the reserved ADR
moves to **0091**, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-names-20260929`;
0089 is superseded and never reused. Migrations 70/71 are unchanged; no pipeline file exists at
0091 (`ls docs/adr | grep 0091` is empty).

**2026-09-30 knowledge base:** agent-sync returned ADR-0092, ADR-0093 and ADR-0094 (keys
`license-agpl-commercial-20260930`, `workspace-knowledge-base-20260930`, `mcp-first-20260930`),
written past the prose reservation 0091. Under the same collision rule the reserved ADR moves to
**0095**, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-knowledge-base-20260930`;
0091 is superseded and never reused. Migrations 70/71 are unchanged; no pipeline file exists at
0095 (`ls docs/adr | grep 0095` is empty).

**2026-09-30 publication redaction:** agent-sync returned ADR-0096 (key `public-release-redaction-20260930`) to
[the publication-redaction decision](../../adr/0096-dated-records-are-redacted-for-publication.md),
which was written past the prose reservation 0095. Under the same collision rule the reserved ADR
moves to **0097**, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-public-redaction-20260930`;
0095 is superseded and never reused. Migrations 70/71 are unchanged; no pipeline file exists at
0097 (`ls docs/adr | grep 0097` is empty).

**2026-10-01 common backlog:** agent-sync returned ADR-0098 to
[the workspace backlog decision](../../adr/0098-workspace-federates-repository-backlogs.md),
which passed reservation 0097. Under this document's existing collision rule the reserved ADR
moves to **0099**, returned by `agent_sync.py reserve ADR --key pipeline-reservation-after-common-backlog-20261001`.
0097 is superseded and never reused. Migrations 70/71 remain unchanged; no pipeline ADR file
exists at 0099. `python3 test/audit_regressions/fix-pf-06.03.py` checks the sequence.

**2026-10-03 start paths and general plan:** agent-sync returned ADR-0100 and ADR-0101 to
[the first run and start paths](../../adr/0100-first-run-and-start-paths.md) and
[the general development plan](../../adr/0101-the-general-development-plan.md), which passed
reservation 0099. Under the same collision rule the reserved ADR moves to **0102**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-start-paths-20261003`. 0099 is superseded
and never reused. Migrations 70/71 remain unchanged; no pipeline ADR file exists at 0102.

**2026-10-03 release review:** slots 70 and 71 are taken by the executed migrations
`20261003000070_estate_owned_identity.sql` (an id names one estate's row; release review data
finding 1) and `20261003000071_append_event_boundary_restored.sql` (the write boundary migrations
63/64 had dropped), so the unexecuted pipeline migration reservations move from 70/71 to **72/73**
under the same ordering rule. The reserved ADR stays 0102. No pipeline file exists at either number
(`ls supabase/migrations | grep -i pipeline` is empty). Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03 release review, iteration 2:** slot 72 is taken by the executed migration
`20261003000072_handoff_heartbeat_estate.sql` (hand-offs, heartbeats and every create keyed on a
global id belong to one estate at the write boundary; release review iteration 2, data findings 1, 5,
6 and 8), so the unexecuted pipeline migration reservations move from 72/73 to **73/74** under the
same ordering rule. The reserved ADR stays 0102. No pipeline file exists at either number
(`ls supabase/migrations | grep -i pipeline` is empty). Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03 write boundary:** agent-sync returned ADR-0103 (key `estate-owned-identity-20261003`) to
[the write-boundary decision](../../adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md),
which passed reservation 0102. Under the same collision rule the reserved ADR moves to **0104**, returned
by `agent_sync.py reserve ADR --key pipeline-reservation-after-estate-identity-20261003`. 0102 is
superseded and never reused. The migration reservations stay at 73/74; no pipeline ADR file exists at
0104. Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.
