---
report:
  id: fabric/2026-10-05-hub-i3-data-130b5510
  title: "Fabric 0.3.1 · iteration 3 · data review at 130b5510"
  kind: review
  project: fabric
  domains: [architecture, reliability]
  as_of: 2026-10-05
  status: active
  valid_until: 2026-10-19
  summary: >-
    Independent iteration-3 data review of the converged 0.3.1 candidate 130b5510: verdict approve,
    5 findings, 0 blocking. Dispositions live in the hub verification ledger.
  sources:
    - name: "Candidate source"
      url: "https://github.com/passioncode-ai/fabric/tree/130b5510011a0f15858642838fc906ad4af4bf67"
      read_at: 2026-10-05
  produced_by:
    agent: "independent reviewer subagent (fresh context), saved by the coordinator"
    task: "p08-i3-review-130b5510"
  supersedes: []
  consumers: [fabric]
---

# Fabric 0.3.1 · iteration 3 · data review at 130b5510

This is an independent reviewer run in a fresh context. The coordinator saved it verbatim from the reviewer's final message, because the reviewer's harness refused writes. Structured findings are in `findings.json`; the probe and its output are in `probe.mjs` and `probe.out`.

## Candidate and scope

- **Candidate:** `130b5510011a0f15858642838fc906ad4af4bf67`.
- **v0.3.0:** `d2ed94cc…`, which requires schema 75.
- **Diff since v0.3.0:** 22 files under `supabase` and `apps/desktop/src/main` (+5462/−42).
- **New migrations:**
  - `…076_hub_access.sql`;
  - `…077_hub_access_at_the_door.sql`;
  - `…080_hub_authority_boundaries.sql`, which is migration 78 by count, as its own header says.
- **Schema contract:** moved from 75–75 to 78–78; there are 78 migration files.

## Method

- **Migrations.** I read 76, 77 and 80 in full, plus everything they redefine or depend on: `append_event` and the canonical-id rules (74), `refuse_foreign_identity` (73), the restore functions (65, 66), `rebuild_estate_projections` (5), `schema_version()` (51) and the truncate revocation (17).
- **Writers and readers.** I checked every hub write payload against migration 80's allowed keys and migration 77's projector refusals. I also checked:
  - that `accessStore.ts` reads are scoped to one estate;
  - the schema-readiness check;
  - how the bundled stack is copied;
  - the private-archive schema list;
  - the changed provider-control and executor-auth paths.
- **Probe.** I wrote and ran my own probe on an owned PostgreSQL 17 cluster: temporary directory, unix socket, port 58993, Supabase default privileges, all 78 migrations, removed afterwards.

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `git diff --stat v0.3.0 130b5510 -- supabase apps/desktop/src/main` | 0 | 22 files |
| Migration file count, candidate / v0.3.0 | 0 | 78 / 75 |
| Search of every ref in `~/DATA/fabric` for files with suffix 78 or 79 | 0 | none |
| zod 4.5.4 `z.string().uuid()` on an upper-case UUID | 0 | accepted |
| `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin node scratchpad/i3/data/probe.mjs` | 0 | pass=37, fail=0 |

The first probe run had one false failure: my "upper-case id" test value had no hex letters, so upper-casing it changed nothing. I fixed the value and reran.

## Probe results (owned cluster, schema 78)

- **Rebuild:** rebuilding over existing rows is byte-identical, and replaying into emptied hub tables reproduces the live projection exactly. This held for a full hub history (allow, claim, grant extension, revoke, deny and clear, reconnect with `supersedes`, a span) and for a restored estate.
- **Cross-estate writes:** estate B made 10 attempts against estate A's request, binding, grant and connection ids, and against A's decisions and revocations. All were refused. B's journal and A stayed unchanged, and no refusal text contained one of A's ids.
- **Payload guards:** the database refused each of the following:
  - a secret value inside `secret_ref`;
  - undocumented keys;
  - raw call arguments in a span;
  - a credential key in a claim;
  - a request living more than 12 minutes;
  - a grant lasting more than 366 days;
  - an upper-case id.
- **Restore:**
  - A restore beside its still-present source is refused with the designed "restore collided" sentence.
  - A restore into a fresh estate leaves no live binding, verifier, grant, connection or poll verifier.
  - A restored pending request can be neither allowed nor denied.
  - A restored binding can neither ask for more access nor be claimed.
  - A new connection cannot replace a restored one, but a fresh connect works.
- **Permissions:** `anon` and `authenticated` have no access to the four hub tables; `service_role` can only read them. No API role can execute the projector or guard functions.
- **Private archive:** export names schema 78, and import accepts it.

## Upgrade 75 → 78 (code reading only)

- The three migrations only create objects; nothing collides with a 0.3.0 database.
- `schema_version()` counts applied migrations, so it reads 78 after the upgrade.
- The bundled stack is copied before the readiness check, which refuses an old database and names the upgrade section of `release-mac.md`.

## Harness

- The provider stop controls now return a stored or in-flight result before checking the deadline. That is correct: a retry can no longer be told "refused" after a write may already have happened.
- `executorAuth.ts` is bounded, kills its process group, and never shows raw vendor output.
- If the hub cannot start, the agent surface still starts on its own port.

## Findings

| id | Blocking | Finding | Evidence | Fix |
|---|---|---|---|---|
| A-1 | no | Migration 80 now requires lower-case ids in `supersedes`, `request_id`, `binding_id` and `grant_id` for every event type. An agent's memory correction that names an upper-case fact id, accepted by 0.3.0, now fails with a raw database error. | `20261004000080_hub_authority_boundaries.sql:18`; `agentSurface.ts:1288-1291` validates with `z.string().uuid()`, which accepts upper case; `agentSurface.ts:1320` passes it through unchanged; probe P6 shows the refusal | Lower-case the id at the tool, or refuse it there with the tool's own `invalid_identifier`, and add a test |
| A-2 | no (a hazard for the next migration) | Filename suffix 80 sits above the reserved 78 and 79. When those land, existing databases will see them as out of order, and Supabase will need `--include-all`. They would then run after 80 on upgraded databases but before 80 on fresh installs, so shared functions would differ while `schema_version()` reports the same number. | `20261004000080_hub_authority_boundaries.sql:2`; `docs/launch/release-mac.md:127-131`; `schema_version()` counts rows; the CLI behaviour was not run | Give the other workstream suffixes above 80, and add a gate that refuses a migration filename sorting below the newest |
| A-3 | no (capacity) | Every hub call, refusals included, writes one journal event, bounded only by 120 calls a minute per credential. The private-history export and verified restore refuse journals over 65,536 events, so one looping agent can disable private export in about 9 hours. | `hubCall.ts:205-207, 267, 302-320`; `agentSurface.ts:211-212`; migration 66 line 149; `ceoPrivateArchive.ts:26`; the ordinary backup has no cap | Don't journal each refused call (count or sample them), or bound spans per credential; document the ceiling |
| A-4 | no (no released database has hub tables) | The 77/80 rules (request and grant lifetimes, `secret_ref` shape, span keys, restored-request authority) run inside the projector, so they also run on replay. A development database at 76/77 holding such an event would make rebuild fail permanently. Migration 80's header claims "New write guards are outside replay", which is true only for the door checks. | migration 77 lines 288-291, 356-359, 441-451, 499-504; migration 80 lines 3 and 182-185 | Correct the header claim; add a read-only journal scan to the upgrade procedure for 76/77 databases |
| A-5 | no | A restored standing denial keeps auto-refusing the same request in the restored estate. Every other piece of restored hub state is history only. | probe P4; `accessService.ts:171-176` | Decide this in ADR-0115: ignore denials at or below the restore watermark, or document the behaviour |

## NOT_RUN

- The repository's own owned-database suites (hub access, hub upgrade, restore authority, function privileges), left to the coordinator's full tier.
- `supabase migration up` on a real stack: forbidden here, and the live stack was not touched.
- The Supabase CLI out-of-order behaviour behind A-2.
- A real agent calling `memory.record` end to end for A-1.
- A span-storm timing test for A-3 (computed from the budget, not measured).
- The `scripts/ci.sh full` result was still pending when the review ended. The partial log showed no failing suite.

## Verdict

**Approve**, with 0 blocking and 5 non-blocking findings. A-2's renumbering must happen before any migration with suffix 78 or 79 is merged.
