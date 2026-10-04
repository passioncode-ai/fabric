---
report:
  id: fabric/2026-10-04-hub-i3-data
  title: "Fabric hub iteration 3: independent data and authority review"
  kind: review
  project: fabric
  domains: [architecture, security]
  as_of: 2026-10-04
  status: draft
  valid_until: 2026-10-05
  summary: >-
    Frozen candidate 3b2878fc fails independent data acceptance: an actual SQL-exported
    schema-78 private archive is refused by the native codec, and a standing denial
    falls out of the capped lookup after 501 denials, allowing another prompt.
    Owned access, ACL, rebuild and seeded 75/77-to-78 upgrade checks pass within
    their bounded scopes; these passes do not make the full candidate green.
  sources:
    - {name: "Frozen candidate", url: "https://github.com/passioncode-ai/fabric/commit/3b2878fc9283db5fc9a81697ba8538a01630b8d9", read_at: 2026-10-04}
    - {name: "Original ADR-0115 before later amendments", url: "https://github.com/passioncode-ai/fabric/blob/67a5dc42/docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md", read_at: 2026-10-04}
    - {name: "Independent SQL export and native admission probe", path: "raw/independent-data-probe-3b.log", read_at: 2026-10-04}
    - {name: "Independent standing-denial probe", path: "raw/independent-denial-probe-3b.log", read_at: 2026-10-04}
  produced_by: {agent: codex, task: hub-i3-data-20261004}
  supersedes: []
  consumers: [fabric]
---

<sub>ssheleg skills — evidence-docs · project-reports · task-pipeline</sub>

# Fabric hub iteration 3: independent data and authority review

## Verdict and frozen source

**FAIL at `3b2878fc9283db5fc9a81697ba8538a01630b8d9`.** Two independently reproduced findings remain open. This draft is an exact-source review, not release, integration, hosted-CI or live-provider acceptance. A later candidate requires a new appended check receipt; it does not rewrite this verdict.

The assignment covers durable requests, grants, bindings and private polling; SQL CAS/idempotency, principal ACLs and projection rebuild; restored history versus authority; seeded migration counts 75/77→78 and SQL/native private archive compatibility. Runtime code, shared registers, native services, real accounts and paid providers were not edited or exercised.

## Findings

### DATA-I3-01 — blocking: SQL exports schema 78, native admission refuses it

Migration suffix 80 is migration **count 78**, not schema 80. SQL canonical admission now includes 78 at [migration 80:403](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/supabase/migrations/20261004000080_hub_authority_boundaries.sql#L403), and the actual exporter writes `schema_version()` at [line 494](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/supabase/migrations/20261004000080_hub_authority_boundaries.sql#L494). Native `PRIVATE_ARCHIVE_LIMITS.sourceSchemas` and its type stop at 77 ([codec:24](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/ceoPrivateArchive.ts#L24), [codec:116](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/ceoPrivateArchive.ts#L116)).

The [independent probe](raw/independent-data-probe.mjs) creates only owned fixture identity/membership, asks the actual SQL `ceo_export_private_archive` for an empty private history, verifies `ok:true` and source 78, and hands the actual returned bytes to `decodePrivateArchive`. [Measured receipt](raw/independent-data-probe-3b.log): SQL accepts; native returns `unsupported_schema`. This is not a hand-written schema-78 archive. The smaller probe contains zero conversations/messages and establishes export/admission incompatibility; it does not claim full private-history import coverage.

The existing codec test intentionally refuses 78 and passes. The private archive DB test also expects SQL to refuse 78 although migration 80 admits it. The owned runner fails at `ceo-private-archive-db.test.mjs:131` with `companion unqualified later source schema: "accepted" is not in ARCHIVE_REASON_CODES`; [sanitized receipt](raw/private-archive-3b-public.log) preserves the assertion and original-byte hash. Later restore/private-history/native-roundtrip files in that runner are NOT_RUN because it stops at this failure. Correct the qualified native schemas/type and stale refusal vectors together, then run a real SQL export→native admission→restore/import roundtrip with hub events and private messages.

### DATA-I3-02 — high: standing denial can prompt again after the capped lookup loses it

Original ADR-0115 §3 says the same denied request remains denied until the operator clears it. [AccessService:171](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/accessService.ts#L171) reads standing denials for the agent/callee and searches for the exact request signature. [AccessStore:163](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/accessStore.ts#L163) returns only the newest 500 rows. Unlike pending requests, standing denials have no admission ceiling or expiry filter.

The [independent probe](raw/independent-denial-probe.mjs) invokes actual `AccessService.request` and `decide` 501 times for distinct resources, then repeats the oldest exact request. [Measured receipt](raw/independent-denial-probe-3b.log): 501 standing denials exist; the lookup returns 500; the old exact denial returns `pending` and presents **one new prompt**. The newest denied request remains `denied`, providing a positive control. The probe uses the repository's cap-faithful in-memory store and actual service, not a live gateway; the real capped query was independently read. The same capped overview read hides old denials from the operator's list.

Use a complete estate-scoped denial lookup (or an exact signature lookup enforced before a bounded display page). Preserve explicit failed-read behavior and stable paging. Check at least 501 denials per agent/callee and across multiple agents, repeat an old denial without a prompt, then clear it and prove one fresh request may prompt.

## Checks actually run

| Check at frozen 3b | Observed result | Scope |
|---|---|---|
| Independent data probe | Exit 0; records native `unsupported_schema` | Owned PG17 chain, schema78 export, SQL/native mismatch, ACL matrix, atomic second-claim refusal, byte-equivalent live projection rebuild |
| Independent denial probe | Exit 0; records old denial becoming pending | 501 real service request/deny calls using cap-faithful memory store; no actual window/gateway |
| `node apps/desktop/test/run-hub-access-db.mjs` | Exit 0 | 17 SQL cases, 18 real hub-door cases, 6 authority-boundary cases; [receipt](raw/hub-access-3b.log) |
| `node apps/desktop/test/run-hub-upgrade-db.mjs` | Exit 0 | Seeded 75→78 and 77→78, exact count ledger, live history/authority preservation, restored pending refusal, physical dump/restore, ACLs/replay, concurrent reconnect CAS; [receipt](raw/hub-upgrade-3b.log) |
| `node apps/desktop/test/run-ceo-private-archive-db.mjs` | Exit 1 | Stale SQL78 refusal assertion fails; later 3 files NOT_RUN; [sanitized receipt](raw/private-archive-3b-public.log) |
| Three focused native test files | Exit 0, 10 tests | Hub access service/refusals and codec vectors; [receipt](raw/focused-native-3b.log); includes stale schema78 refusal |

The independent probe's exit 0 means its measurement completed, not that native admission met the required result. PostgreSQL fixtures used the repository's owned-cluster helpers/default PG17 binaries with `listen_addresses=''`; each runner stopped and removed its own socket/data directory. No live 54321/54322 database was targeted. Tests were bounded by caller timeouts.

**NOT_RUN here:** the complete repository `ci.sh full`/hosted CI, production database upgrade, real vault/provider credentials, product installation, physical/native UX acceptance and deployment. Coordinator reported a failed full candidate run before this review; the passing focused/upgrade checks above do not supersede that failed run. Shared map, ledger and one wiki index are the coordinator's convergence work; this report branch does not claim them current.

## Method and independence

Toolbox measurement reported 584 reachable skills. Read actual Fabric `AGENTS.md`, `docs/AGENT_SYNC.md`, org contribution guide and knowledge README/vision/principles/how-to-work/rules; read original ADR-0115 from its introduction commit before later amendment sections, then actual SQL, access store/service and native codec. Own findings/probes were formed before the author recovery report was opened. Only afterward were the current amendments and recovery summary inspected; their statements are not used as proof of passing checks. The observatory update check ran at task start and printed no update.

The selected skills were evidence-docs (source/receipt precision), project-reports (skeleton/metadata checks) and task-pipeline (bounded report handoff). Project-audit was not the route: this is one bounded deliverable review. Maintaining-fabric-workspace was read because AGENTS requires it before report work; publication remains centrally coordinated.

## Handoff and exact next task

The objective is an independent I3 DATA verdict on the frozen source. Completed: original-decision/source review, two independent reproductions, owned access/upgrade checks and focused native checks. Open: corrected frozen-source recheck, full SQL/native private history roundtrip, coordinator acceptance/convergence and publication. The report lives on `codex/hub-i3-data-20261004`; it changes report files only.

**Next:** coordinator fixes DATA-I3-01 and DATA-I3-02 in the owning implementation branch, freezes the exact replacement SHA and sends it to this reviewer. Re-run both independent probes, the updated codec/private archive runner and focused denial/real-store coverage; append replacement source, outputs and dispositions here. Keep original 3b observations intact. Root then owns the single shared ledger/map/wiki update and final full-candidate gate. Review choice: complete denial reads versus a bounded exact-signature RPC, with no silent partial answer.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — bound findings to exact source and probes
- `project-reports` — created durable report skeleton — not a skill this family ships
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded report handoff

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
