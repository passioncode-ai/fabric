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
| migration | `20261021000121_pipeline_definitions.sql` (was 117, moved 2026-10-21) | pipeline-as-data: definitions + versions, append-only |
| migration | `20261021000122_graph_version_pins.sql` (was 118, moved 2026-10-21) | the running graph pinned to a pipeline version |
| ADR | `docs/adr/0175-task-pipeline-persistence-contract.md` | the contract itself, superseding nothing. Re-reserved from 0173 on 2026-10-23 (ADR-0174, the working language's switch, was written past it), from 0171 on 2026-10-22 (ADR-0172, the working language, was written past it), and from 0167 on 2026-10-19 (ADR-0168, ADR-0169 and ADR-0170, the final pass F3 to F5, were written past it; 0171 issued by agent-sync to run `r-8db0598178fb`). Re-reserved from 0165 on 2026-10-19 (ADR-0166, one attribution of folders to projects, was written past it; 0167 issued by agent-sync to run `r-8db0598178fb`). Re-reserved from 0163 on 2026-10-18 (ADR-0164, a folder with no project is attributed by Fabric, was written past it; 0165 issued by key `pipeline-reservation-after-auto-registration-20261018`). Re-reserved from 0161 on 2026-10-17 (ADR-0162, RM-21's D3, was written past it; 0163 issued by key `pipeline-reservation-after-d3-20261017`). Re-reserved from 0159 on 2026-10-15 (ADR-0160, act-log-undo, was written past it; 0161 issued by key `pipeline-reservation-after-act-log-undo-20261015`). Re-reserved from 0157 on 2026-10-14 (ADR-0158, RM-29's specification flow and timeline, was written past it; 0159 issued by key `pipeline-reservation-after-rm29-adr-20261014`); earlier re-reserved from 0150 on 2026-10-13 (ADR-0156, the estate owner's pause and listing controls on the project board, was written past it, and ADR-0152…ADR-0155 were issued to another run; 0157 issued by key `pipeline-reservation-after-operator-holds-20261013`); earlier re-reserved from 0148 on 2026-10-12 (ADR-0149, the board's lifecycle and responders, was written past it; 0150 issued by key `pipeline-reservation-after-board-responders-20261012`); earlier re-reserved from 0146 on 2026-10-11 (ADR-0147, runner and model profiles, was written past it; 0148 issued by key `pipeline-reservation-after-runner-profiles-20261011`); earlier re-reserved from 0143 (wave branch) and 0141 (main) on 2026-10-11 (ADR-0145, Fabric releases are approved by checks, was written past both, and 0142…0144 are taken by the 0.4.0 wave branch; 0146 issued by key `pipeline-reservation-after-release-guard-20261011`); earlier re-reserved from 0132 on 2026-10-11 (ADR-0133…ADR-0140, the 0.4.0 agents-first records, were written past it; 0141 issued by key `pipeline-reservation-after-release-040-20261011`); earlier re-reserved from 0130 on 2026-10-10 (ADR-0131, a database only the old seed has touched is given to the local operator, was written past it; 0132 issued by key `pipeline-reservation-after-fresh-install-20261010`); earlier re-reserved from 0128 on 2026-10-08 (ADR-0129, onboarding is four actions, was written past it; 0130 issued by key `pipeline-reservation-after-four-actions-20261008`); earlier re-reserved from 0126 on 2026-10-08 (ADR-0127, no usage count leaves before the person has answered the switch, was written past it; 0128 issued by key `pipeline-reservation-after-analytics-disclosure-20261008`); earlier re-reserved from 0124 on 2026-10-07 (ADR-0125, an agent launch may follow the operator's fallback order, was written past it; 0126 issued by key `pipeline-reservation-after-route-resolution-20261007`), from 0122 on 2026-10-06 (ADR-0123, the conversation is the runtime's console, was written past it; 0124 issued by key `pipeline-reservation-after-no-own-chat-20261006`), from 0120 on 2026-10-06 (ADR-0121, Fabric updates itself, was written past it; 0122 issued by key `pipeline-reservation-after-self-update-20261006`), from 0118 on 2026-10-06 (ADR-0119, the ACP runner drive, was written past it; 0120 issued by key `pipeline-reservation-after-acp-runners-20261006`), from 0116 on 2026-10-05 (ADR-0117, the project board, was written past it), from 0055 on 2026-09-10, from 0056 on 2026-09-12, from 0082 on 2026-09-29 (ADR-0084, releases, was written past it), from 0085 on 2026-09-29 (ADR-0086, positioning, was written past it), from 0087 on 2026-09-29 (ADR-0088, remote surfaces, was written past it), from 0089 on 2026-09-29 (ADR-0090, names, was written past it), from 0091 on 2026-09-30 (ADR-0092–0094, licence, knowledge base and MCP-first, were written past it), and from 0095 on 2026-09-30 (ADR-0096, publication redaction, was written past it): each time an ADR handed out by agent-sync passed this prose reservation (0055 was written; then ADR-0057 continued the sequence past 0056), because a reservation living in prose never reaches the register. The document's own collision rule owns both moves. Re-reserved again from 0099 on 2026-10-03 (ADR-0100 and ADR-0101, the start paths and the general plan, were written past it), from 0102 later the same day (ADR-0103, the write-boundary rule, was written past it), and from 0104 later still (ADR-0105, agent memory, and ADR-0106, the lifecycle contract, were written past it; 0107 was returned by key `pipeline-reservation-after-agent-memory-20261003`), and from 0107 the same evening (ADR-0109, the agent learning loop, was written past it; 0110 returned by key `pipeline-reservation-after-learning-loop-20261003`), and from 0110 later that day (ADR-0111, Fabric released from CI, was written past it; 0112 returned by key `pipeline-reservation-after-release-in-ci-20261003`), and from 0112 the same day (ADR-0113, the amended release approval, was written past it; 0114 returned by key `pipeline-reservation-after-release-approval-20261003`), and from 0114 the same day (ADR-0115, a local agent reaches a cloud product through Fabric, was written past it; 0116 returned by key `pipeline-reservation-after-hub-consent-20261003`). |

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

**2026-10-03 release review, iteration 3:** slot 73 is taken by the executed migration
`20261003000073_session_owner_at_the_door.sql` (a session belongs to the estate that holds it in any
session-keyed table, two estates cannot race one new id past the door, a declared import keeps its
case-duplicate agents, moved heartbeats are repaired, and the agent-name rule folds case beyond ASCII;
release review iteration 3, data findings 1, 2, 3 and 7), so the unexecuted pipeline migration
reservations move from 73/74 to **74/75** under the same ordering rule. The reserved ADR stays 0104. No
pipeline file exists at either number (`ls supabase/migrations | grep -i pipeline` is empty). Checked by
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03, confirmation pass after release review iteration 3:** slot 74 is taken by the executed
migration `20261003000074_canonical_ids_at_the_door.sql` (the write boundary compares the id exactly as the
projector's `::uuid` cast reads it, `append_event` refuses a non-canonical spelling of every payload id the
door reads, and the agent-name rule trims the whitespace JavaScript's `String#trim` trims), so the
unexecuted pipeline migration reservations move from 74/75 to **75/76** under the same ordering rule. The
reserved ADR stays 0104. No pipeline file exists at either number (`ls supabase/migrations | grep -i
pipeline` is empty). Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03, confirmation pass after release review iteration 3 (verifier finding):** slot 75 is taken by
the executed migration `20261003000075_projectors_are_not_public.sql` (no `apply_*` projector is executable
by public, anon, authenticated or the service role, and `decide_proposal`, `release_grant_reservation` and
`import_declared_snapshot` are closed to authenticated, which Supabase's default privileges had granted), so
the unexecuted pipeline migration reservations move from 75/76 to **76/77** under the same ordering rule.
The reserved ADR stays 0104. No pipeline file exists at either number (`ls supabase/migrations | grep -i
pipeline` is empty). Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03 agent memory and the lifecycle contract (merge):** two branches moved this reservation
independently on one day. On `main`, agent-sync returned ADR-0105 (key `adr-0105-agent-memory`) to
[the agent-memory decision](../../adr/0105-agent-memory-lives-in-project-observatory.md), and the
reservation moved to **0107** (key `pipeline-reservation-after-agent-memory-20261003`); on the
onboarding branch, ADR-0106 (key `adr-0106-lifecycle`) went to
[the lifecycle contract](../../adr/0106-fabric-adopts-the-product-lifecycle-contract.md) while the
reservation still read 0104. Both passed 0104, so 0104 is superseded and never reused; the reserved ADR
is **0107**, which continues past both. ADR-0108 (key `pipeline-reservation-after-lifecycle-20261003`)
was returned to the lifecycle run before the merge showed 0107 already covering it; it is superseded
and never reused. The migration reservations stay at 76/77, after the executed migrations 70–75 of this
branch (main's text still read 70/71 because it predates them). No pipeline file exists at 0107 or at
either migration number. Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03 the agent learning loop:** agent-sync returned ADR-0109 (key `agent-feedback-loop-20261003`) to
[the learning-loop decision](../../adr/0109-agent-learning-lives-in-fabric-and-problems-become-proposals.md),
which passed reservation 0107. Under the same collision rule the reserved ADR moves to **0110**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-learning-loop-20261003`; 0107 is superseded and
never reused. The migration reservations stay at 76/77; no pipeline file exists at 0110 or at either
migration number. Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03 release from CI:** agent-sync returned ADR-0111 (key `release-in-ci-20261003`) to
[the release decision](../../adr/0111-fabric-is-released-from-ci.md), which passed reservation 0110. Under
the same collision rule the reserved ADR moves to **0112**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-release-in-ci-20261003`; 0110 is superseded and
never reused. The migration reservations stay at 76/77; no pipeline file exists at 0112 or at either
migration number. Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03 release approval amended:** agent-sync returned ADR-0113 (key `release-approval-amended-20261003`)
to [the amended approval rule](../../adr/0113-any-release-approver-may-approve-the-tag-pusher-included.md), which
passed reservation 0112. Under the same collision rule the reserved ADR moves to **0114**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-release-approval-20261003`; 0112 is superseded and
never reused. The migration reservations stay at 76/77; no pipeline file exists at 0114 or at either
migration number. Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-03 the hub's standing access (ADR-0115):** slot 76 is taken by the executed migration
`20261003000076_hub_access.sql` (access requests, bindings, grants and product connections, each a
projection of the journal), so the unexecuted pipeline migration reservations move from 76/77 to **77/78**
under the same ordering rule. ADR-0115 (the hub decision) was written past reservation 0114, so under the
same collision rule the reserved ADR moves to **0116**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-hub-consent-20261003`; 0114 is superseded and
never reused. No pipeline file exists at 0116 or at either migration number (`ls supabase/migrations |
grep -i pipeline` is empty). Checked by `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-04 the hub at the door (verification of Fabric 0.3.1, iteration 1):** slot 77 is taken by the
executed migration `20261004000077_hub_access_at_the_door.sql` (the hub's four creates at the write
boundary, restored hub history projected revoked, the writer's expiry and secret-slot rules in the
projector, the poll verifier, `product.connect.refused@1`), so the unexecuted pipeline migration
reservations move from 77/78 to **78/79** (`20261004000078_pipeline_definitions.sql`,
`20261004000079_graph_version_pins.sql`) under the same ordering rule. No ADR was written past 0116, so the
reserved ADR stays at **0116**. No pipeline file exists at 0116 or at either migration number
(`ls supabase/migrations | grep -i pipeline` is empty). Checked by
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-04 hub convergence:** the latest candidate migration is
`20261004000080_hub_authority_boundaries.sql`; its filename passed the unexecuted
78/79 prose reservation while preserving those slots at creation time. Under the same
next-free ordering rule the active pipeline reservations now move to **81/82**,
`20261004000081_pipeline_definitions.sql` and `20261004000082_graph_version_pins.sql`.
Earlier 78/79 addresses above remain historical evidence. No pipeline file has been
created or executed; no applied migration was changed by this reservation update.
The reserved ADR remains **0116**. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`
checks latest migration, absent future files and continued ADR ordering on this candidate.

**2026-10-05 the project board (ADR-0117):** ADR-0117, Fabric hosting `fabric-project-comms/0.1`
(COM-01), was written past reservation 0116, so under the same collision rule the reserved ADR moves
to **0118**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-project-board-20261005`. 0116 is
superseded and never reused. The migration reservations stay at **81/82** in that step. No pipeline file exists at 0118 or at either migration number. Receipt:
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-05 the project board's core (COM-02.1):** slot 81 is taken by the executed migration
`20261005000081_project_board.sql`, which is migration 79 by count. Under the same ordering rule the
unexecuted pipeline migration reservations move from 81/82 to **82/83**:
`20261011000092_pipeline_definitions.sql` and `20261011000093_graph_version_pins.sql`. The reserved ADR
stays at **0118**. No pipeline file exists at either number. Receipt:
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-06 the ACP runner drive (ADR-0119):** ADR-0119, ACP as the generic runner drive, was written
past reservation 0118, so under the same collision rule the reserved ADR moves to **0120**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-acp-runners-20261006`. 0118 is superseded and
never reused. The migration reservations stay at **82/83**. No pipeline file exists at 0120 or at either
migration number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py` (all green on 2026-10-06).

**2026-10-06 Fabric updates itself (ADR-0121):** ADR-0121 was written past reservation 0120, so under the same
collision rule the reserved ADR moves to **0122**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-self-update-20261006`. 0120 is superseded and never
reused. The migration reservations stay at **82/83**. No pipeline file exists at 0122 or at either migration
number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py` (all green on 2026-10-06).

**2026-10-06 the conversation is the runtime's console (ADR-0123):** ADR-0123 was written past reservation 0122,
so the reserved ADR moves to **0124**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-no-own-chat-20261006`. 0122 is superseded and never
reused. The migration reservations stay at **82/83**. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-07 an agent launch may follow the operator's fallback order (ADR-0125):** ADR-0125 was written
past reservation 0124, so under the same collision rule the reserved ADR moves to **0126**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-route-resolution-20261007` (the remote id
counter reads next 127). 0124 is superseded and never reused. The migration reservations stay at
**82/83**. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-08 no usage count leaves before the person has answered the switch (ADR-0127):** ADR-0127 was
written past reservation 0126, so under the same collision rule the reserved ADR moves to **0128**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-analytics-disclosure-20261008`. 0126 is superseded and
never reused. The migration reservations stay at **82/83**. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-08 onboarding is four actions (ADR-0129):** ADR-0129 was written past reservation 0128, so under the same
collision rule the reserved ADR moves to **0130**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-four-actions-20261008`. 0128 is superseded and never
reused. The migration reservations stay at **82/83**. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-10 a fresh install starts (ADR-0131):** ADR-0131 was written past reservation 0130, so under the same
collision rule the reserved ADR moves to **0132**, returned by
`agent_sync.py reserve ADR --key pipeline-reservation-after-fresh-install-20261010`. 0130 is superseded and never
reused. The migration reservations stay at **82/83**. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-11 the write rules at the door, and the session enrollment (Fabric 0.4.0 wave 1):** slot 82 is taken by the executed migration `20261011000082_write_rules_at_the_door.sql` (CO-200, CO-201), and slot 90 by `20261011000090_session_enrollment.sql` (ADR-0134, the event type of an enrolled session), the latest migration now; schema count 81. Under the same ordering rule the unexecuted pipeline migration reservations move from 82/83 to **91/92**: `20261011000092_pipeline_definitions.sql` and `20261011000093_graph_version_pins.sql`, and the reserved ADR to **0143**. No pipeline file exists at either number. From this wave a migration filename is also held by `supabase/migration-ledger.json` and `scripts/check-migration-order.mjs` (CO-199): a file that sorts below the newest recorded one is refused, so a reservation in prose can no longer land below an applied migration. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-11, later the same wave:** slot 91 is taken by the executed migration `20261011000091_grants_from_the_journal.sql` (the 0.3.2 audit's grant findings A2-015, A7-014, A7-015, A7-020, A7-022; schema count 82). The unexecuted pipeline migration reservations move again, from 91/92 to **92/93**: `20261011000092_pipeline_definitions.sql` and `20261011000093_graph_version_pins.sql`; the reserved ADR stays at 0143. No pipeline file exists at either number.

**2026-10-11 the board's operator read (COM-06/COM-07):** slot 94 is taken by the executed migration
`20261011000094_project_board_operator_read.sql`, which is migration 83 by count. Under the same ordering
rule the unexecuted pipeline migration reservations move from 92/93 to **95/96**:
`20261011000095_pipeline_definitions.sql` and `20261011000096_graph_version_pins.sql`. The reserved ADR
stays at **0146**. No pipeline file exists at either number. Receipt:
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-11, 0.4.0 wave 2 (claims):** slot 95 is taken by the executed migration `20261011000095_work_claims.sql` (REQ-38, REQ-08: `work_claims` and `task_sources`, projected from the journal; migration 84 by count) — written as 92, it was renumbered at the merge with main because main had recorded 94 first and no new file may sort below the newest recorded. Under the same collision rule the unexecuted pipeline migration reservations move from 95/96 to **96/97**: `20261011000096_pipeline_definitions.sql` and `20261011000097_graph_version_pins.sql`. The reserved ADR moves to **0148** (ADR-0147 was written past 0146). No pipeline file exists at either number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-11, the same day (the board's thread aggregates, SCN-143's filter slice, COM-07):** slot 100 is
taken by the executed migration `20261011000100_project_board_thread_aggregates.sql` — migration 85 by count
(`kinds` and `openRequests` on the operator's thread list, so the filters narrow the answered list and never
re-query the board); written as 97, it was renumbered at this merge because wave 2 had reserved 96/97 in
prose. Under the same collision rule the unexecuted pipeline migration reservations move from 96/97 to
**101/102**: `20261011000101_pipeline_definitions.sql` and `20261011000102_graph_version_pins.sql`. The
reserved ADR stays at **0148**. No pipeline file exists at either number. Receipt:
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-12, the board's lifecycle (COM-02.3):** slot 103 is taken by the executed migration
`20261012000103_project_board_lifecycle.sql` — migration 86 by count (epochs, reply, cancel, expiry, deliveries, the
outbox and the board's history in the archive; ADR-0149) — and slot 104 is the responders' migration that follows it
(COM-03). Under the same collision rule the unexecuted pipeline migration reservations move from 101/102 to
**105/106**: `20261012000105_pipeline_definitions.sql` and `20261012000106_graph_version_pins.sql`. The reserved ADR
moves to **0150** (ADR-0149 was written past 0148; 0150 issued by key
`pipeline-reservation-after-board-responders-20261012`). No pipeline file exists at either number. Receipt:
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-13, the board's responders (COM-03):** slot 104 is taken, as reserved above, by the executed migration
`20261012000104_project_board_responders.sql` — migration 87 by count (responder slots, enrollments, attempts, the
fence, release and the project directory; ADR-0149 Amendment 1). The unexecuted pipeline migration reservations stay
at **105/106** (`20261012000105_pipeline_definitions.sql`, `20261012000106_graph_version_pins.sql`) and the reserved
ADR at **0150**: COM-03 wrote no ADR (it amends ADR-0149, ADR-0117 and ADR-0134). No pipeline file exists at either
number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-13, the board's wave-2 fix round and wave 4 (COM-03, COM-07, COM-06):** slot 107 is taken by the executed
migration `20261013000107_project_board_w2_fixes.sql` — migration 88 by count (the wave-2 fix round's SQL half;
ADR-0149 Amendment 2) — and slots 108 and 109 are wave 4's: its reads migration (suffix 108, schema 89; COM-07 and
COM-05) and its controls migration (suffix 109, schema 90; COM-06, ADR-0156). Under the same collision rule the
unexecuted pipeline migration reservations move from 105/106 to **110/111**: `20261013000110_pipeline_definitions.sql`
and `20261013000111_graph_version_pins.sql`. Migration 88 landed without moving them, so from that landing until this
paragraph the prose reservation sat below the newest recorded migration and could not have been applied; this receipt
went red on it (`does not cite the actual latest migration`) and green with this paragraph. The reserved ADR moves to
**0157**: ADR-0156 (key `com-w4-docs-operator-holds-adr`, the owner's pause and listing controls) was written past 0150,
and ADR-0152…ADR-0155 were issued to another run (0155 its own pipeline reservation); agent-sync issued 0157 by key
`pipeline-reservation-after-operator-holds-20261013` (recorded in `docs/adr/README.md`, whose next free id is 0158). 0150
is superseded and never reused. A wave-4 migration that lands on a later date than this paragraph's must still sort
below the reservation or move it again, by the same rule. No pipeline file exists at 0157 or at either migration number.
Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-13, wave 4's reads (W4-1):** slot 108 is taken, as recorded above, by the executed migration
`20261013000108_project_board_operator_reads.sql` — migration 89 by count (the operator's reads of the project board:
the bounded thread page, heads, message facts, the request timeline, related threads, history search, what waits for a
project, and `settledBy` on the journal's complete and reconcile transitions; ADR-0156 §8). The unexecuted pipeline
migration reservations stay at **110/111** (`20261013000110_pipeline_definitions.sql`,
`20261013000111_graph_version_pins.sql`) and the reserved ADR at **0157**: W4-1 wrote no ADR. Slot 109 stays wave 4's
controls migration. No pipeline file exists at either number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-14, the founders' call (run `r-44ae60a75316`):** ADR-0158 (RM-29 — the specification flow and the project
timeline are built in Fabric after it starts stably) was written past the reserved 0157, so by the collision rule the
reserved ADR moves to **0159**, issued by agent-sync under key `pipeline-reservation-after-rm29-adr-20261014`; 0157 is
superseded and never reused. The unexecuted migration reservations stay at **110/111**: no migration landed. No pipeline
file exists at 0159 or at either migration number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-15, the 0.3.7 canvas (run `r-44ae60a75316`):** ADR-0160 (on the operator's machine an act happens at once,
is recorded and can be undone) was written past the reserved 0159, so by the collision rule the reserved ADR moves to
**0161**, issued by agent-sync under key `pipeline-reservation-after-act-log-undo-20261015`; 0159 is superseded and
never reused. The unexecuted migration reservations stay at **110/111**. No pipeline file exists at 0161 or at either
migration number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-17, RM-21 P1 (run `r-44ae60a75316`):** ADR-0162 (the passkey signs the network, the hub on the always-on
machine) was written past the reserved 0161, so by the collision rule the reserved ADR moves to **0163**, issued by
agent-sync under key `pipeline-reservation-after-d3-20261017`; 0161 is superseded and never reused. The unexecuted
migration reservations stay at **110/111**. No pipeline file exists at 0163 or at either migration number. Receipt:
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-18, wave 2 and the automatic project registration (run `r-44ae60a75316`):** three migrations were executed
past the reserved 110/111: `20261017000112_acts_and_reopened_answers.sql` (0.3.7 wave 2, schema 90),
`20261018000113_project_repo_identity.sql` (91) and `20261018000114_private_archive_source.sql` (92, the latest). By the
collision rule the unexecuted pipeline reservations move to **115/116**, and ADR-0164 (a folder with no project is
attributed by Fabric) was written past the reserved 0163, so the reserved ADR moves to **0165**, issued by agent-sync
under key `pipeline-reservation-after-auto-registration-20261018`; 0163, 110 and 111 are superseded and never reused.
No pipeline file exists at 0165 or at either migration number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-19, the unified attribution (run `r-8db0598178fb`):** ADR-0166 (one attribution of folders to projects across
Fabric, Switchboard and Observatory) was written past the reserved 0165, so by the collision rule the reserved ADR moves
to **0167**, issued by agent-sync; 0165 is superseded and never reused. No migration was executed past 114, so the
migration reservations stay at **115/116**. No pipeline file exists at 0167 or at either migration number. Receipt:
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-19, the final pass F3 to F5 (run `r-8db0598178fb`):** ADR-0168 (every catalogue agent starts as a console),
ADR-0169 (a console runs with the operator's own setup) and ADR-0170 (the person says an ended run's work is over) were
written past the reserved 0167, and migration 115 was executed as `20261019000115_run_over_attestation.sql`, the
latest migration now. By the collision rule the reserved ADR moves to **0171**, issued by agent-sync, and the migration
reservations to **116/117**; 0167 and the old 115/116 names are superseded and never reused. No pipeline file exists at
0171 or at either migration number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-20, the 0.3.7 release review fixes (iteration 1, finding DA-1):** migration 116 was executed as
`20261020000116_withdrawn_answer_closes_decision.sql` (schema 94, a withdrawn answer closes the decision it recorded),
the latest migration now, past the reserved 116. By the collision rule the unexecuted pipeline migration reservations
move to **117/118** (`20261020000117_pipeline_definitions.sql`, `20261020000118_graph_version_pins.sql`); the old
116/117 names are superseded and never reused. No ADR was written past 0171, so the reserved ADR stays at **0171**. No
pipeline file exists at 0171 or at either migration number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-22, P-24 (the working language):** ADR-0172 (the interface's language is the agents' working language) was
written past the reserved 0171. By the collision rule the reserved ADR moves to **0173**, issued by agent-sync; 0171 is
superseded and never reused. The migration reservations stay at **117/118**. No pipeline file exists at 0173 or at
either migration number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-23, OF-38 (the working language's switch):** ADR-0174 was written past the reserved 0173. By the collision
rule the reserved ADR moves to **0175**, issued by agent-sync; 0173 is superseded and never reused. The migration
reservations stay at **117/118**. No pipeline file exists at 0175 or at either migration number. Receipt:
`python3 test/audit_regressions/fix-pf-06.03.py`.

**2026-10-21, Fabric 0.3.9 (the core holds, the board part):** migration 120 was executed as
`20261021000120_board_core_holds.sql` (schema 95, a reply answers a request, the board's cursor key), the latest
migration now, past the reserved 117/118. By the collision rule the unexecuted pipeline migration reservations move to
**121/122** (`20261021000121_pipeline_definitions.sql`, `20261021000122_graph_version_pins.sql`); the 117/118 names
are superseded and never reused. No ADR was written past 0171, so the reserved ADR stays at **0171**. No pipeline file
exists at 0171 or at either migration number. Receipt: `python3 test/audit_regressions/fix-pf-06.03.py`.
