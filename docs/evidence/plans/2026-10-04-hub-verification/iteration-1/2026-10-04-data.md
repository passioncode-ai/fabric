# Iteration 1 — Level 4 (data, memory, orchestration, harness) — DA findings

Reviewer: fresh independent verifier. Subject: squash 67a5dc42 "feat(hub): … (ADR-0115)".
Worktree: <worktrees>/hubv-data (detached at 67a5dc42). Nothing committed or pushed.
Protocol: docs/evidence/plans/2026-10-03-verification.md §Protocol only (earlier iterations not read).

Status: COMPLETE — 9 findings: high 1 (DA-2); medium 3 (DA-1 — the ADR-0103 class, DA-5, DA-6); low 5 (DA-3, DA-4, DA-7, DA-8, DA-9 test gap).

## Commands run
- `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin bash scripts/ci.sh full` in the worktree → **EXIT=0**,
  "full tier green. The live stack was not addressed". Disposable stack `fabric_test_3bb052e1` (API 55421,
  DB 55422; live 54321/54322 untouched), "migrations 76 + seed", removed on exit (0 fabric_test containers
  after). vitest 145 files / 1632 tests passed; owned-database step 4/4 runners PASS (hub-access-db 12/12,
  hub-door-db 15/15); 11 owned-cluster suites PASS; probe chains "104 suite(s) ran across 3 package(s); 104
  passed, 0 failed". NOT_RUN said out loud by the script: browser suites (no FABRIC_PLAYWRIGHT_MODULE /
  FABRIC_CHROME). Log: ci-full.log beside this file.
- `node probe-foreign.mjs` (owned cluster 58591) → probe-foreign.out; `node probe-restore.mjs` (58592) →
  probe-restore.out; `node --experimental-strip-types probe-pending.mjs` (58593) → probe-pending.out. All
  owned clusters removed on exit; no live database addressed.

## Findings
(appended below as they are confirmed)

Probe used for DA-1..DA-5: `probe-foreign.mjs` beside this file — an owned disposable cluster
(`withOwnedPostgres`, initdb + unix socket, port 58591, Supabase default privileges in force, whole chain
incl. 76), run as `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin node probe-foreign.mjs`; full output
in `probe-foreign.out`.

### DA-1 — MEDIUM (the ADR-0103 class that migrations 70/72/74 treated as blocking): migration 76's creates are not guarded at the door
- Evidence: `refuse_foreign_identity` (last defined in 20261003000073_session_owner_at_the_door.sql:149-168)
  lists every create keyed on a global id; migration 76 adds four tables keyed on a global `id`
  (20261003000076_hub_access.sql:48, 81, 104, 135) and does not extend it. Probe P1: estate B appends
  `access.requested@1` carrying estate A's request id → `ACCEPTED … -> 1`, "B journal rows 0 -> 1; B
  access_requests rows: 0" — the arm `on conflict (id) do nothing` (hub_access.sql:180) journals in B a
  fact no projection of B shows, exactly what migration 72's header (lines 31-37) refused for eleven arms.
  The other creates do refuse, but in the projector with a raw `unique_violation` that names the id:
  `duplicate key value violates unique constraint "product_connections_pkey" / DETAIL: Key (id)=(…a4)
  already exists` (same for `access_bindings_pkey` via `new_binding` and `access_grants_pkey` via
  `grants[].id`) — a yes/no read of another estate's row, the leak ADR-0103 says the door must not give.
  `asked_by_binding` has no FK and no door check: B's request naming A's binding is accepted
  (`asked_by_binding=…a2`); the later Allow is refused by the projector (sound), but the pending row stands.
- Sound in the same probe: B cannot decide, claim, revoke, clear or disconnect A's rows (all refused
  "…of this estate"), B's reconnect does not supersede A's connection, A's rows unchanged afterwards;
  a braced spelling is refused by `refuse_noncanonical_identity`.
- Fix: extend `refuse_foreign_identity` with `access.requested@1` → access_requests(`id`),
  `access.decided@1` → access_bindings(`binding_id` when `new_binding`) and access_grants(each `grants[].id`),
  `product.connected@1` → product_connections(`id`), and refuse an `access.requested@1` whose `binding_id`
  is not a live binding of this estate; keep the projector arms skipping a foreign row on replay
  (`where … estate_id = excluded.estate_id` / existence check by estate) per ADR-0103's two halves; add the
  four cases to estate-identity-db (it is the suite that enumerates the door).

### DA-2 — HIGH: a restored archive brings back live hub authority — a claimed credential, standing grants and a product connection — with nobody's consent in the target
- Evidence: probe P5 — `restore_estate(T, F, events)` of a synthetic archive from another machine
  (estate.created, access.requested, access.decided allow, access.credential.claimed, product.connected):
  `{"restored": true, "events": 5}`, then in T: "binding verifier set & live=t; live grants=1; live
  connection=1". `apply_hub_access` never consults `estate_restore_boundaries`, unlike the owner arm
  (migration 65 "restored history cannot appoint or reappoint an owner"; T memberships = 0 in the same run).
  The change's own coverage text says this must not happen: storageContract.ts NOT_MIRRORED
  `access_bindings: '…carrying one to another estate would admit a credential nobody there issued'`,
  `access_grants: '…with it they would widen another estate silently'` — but the tables are rebuilt from
  the journal, which backup.ts (`journal.ndjson`) and the private archive (privateHistory.ts:94,152) carry.
  On the restored estate the hub then authenticates the old credential (AccessService.authenticate reads
  the verifier by estate) and agent.call is allowed by the restored grants for a year; the restored
  connection names `fabric/local/FABRIC_INBOX_CLIENT_SECRET`, this machine's live slot (DA-6).
- Fix: in `apply_hub_access`, when the estate has an `estate_restore_boundaries` row and `e.seq <=
  watermark_seq`, project hub history as history only: requests/decisions keep their rows but a restored
  binding is projected revoked (`revoked_by 'restore-boundary'`), restored grants revoked, restored
  `product.connected@1` projected removed — so the operator re-consents and reconnects in the restored
  estate. Add a restore case to run-restore-authority-db.

### DA-3 — LOW: restoring a hub-using estate beside its source fails with a misleading reason
- Evidence: same-database restore replays `access.requested@1` (`on conflict (id) do nothing`, silent) and
  then `access.decided@1` raises "names no request of this estate" — not migration 65's designed
  "restore collided … Restore into a database that does not already hold this estate". (Measured in
  `probe-restore.out`, below.)
- Fix: falls out of DA-1's door/projector predicate only partly (restore bypasses append_event); add the
  four tables to `restore_estate_internal`'s landed check, or pre-check id collisions for hub event types
  and raise the "restore collided" sentence.

### DA-4 — LOW: "never the secret" and the expiry rules are the writer's promise, not the schema's
- Evidence: probe P7 — `product.connected@1` whose `secret_ref` carries `"value":"sk-live-secret"` →
  ACCEPTED (projected into product_connections.secret_ref and the journal); `secret_ref` is only checked
  `jsonb_typeof = 'object'` (hub_access.sql:146). A request expiring in 100 years and a grant expiring in
  100 years → ACCEPTED (only `expires_at > requested_at/decided_at`, lines 60, 123), while ADR-0115 and
  shared/access.ts fix 10 minutes / one year. `hub.call.forwarded@1` with raw `args` → ACCEPTED (no shape
  check; the writer hashes). The writer (productConnect.ts:279-282, accessService.ts:144-148/226) is
  correct today; nothing else holds the line.
- Fix: `check (secret_ref ?& array['project','env','name'] and (select count(*) from
  jsonb_object_keys(secret_ref)) = 3)` (or a projector check), refuse `expires_at > requested_at +
  interval '10 minutes' + skew` and grants beyond `decided_at + interval '366 days'` in the projector, and
  refuse `hub.call.forwarded@1` payload keys outside the documented span set.

### DA-5 — MEDIUM: expired requests stay `pending` forever, and every pending read is the 500 OLDEST rows — after 500 unanswered asks the caps stop holding and the operator's list and queue go blank
- Evidence: expiry is "read from expires_at, never written" (hub_access.sql:7-8), so an unanswered request
  is `status='pending'` for ever; `AccessStore.requests` reads `.order('requested_at', ascending).limit(500)`
  (accessStore.ts:110) and every consumer filters expiry client-side: AccessService.request's dedupe and
  caps (accessService.ts:135-141), `overview()` (285-297) and the attention queue (index.ts, hub branch of
  the obligations read). Probe `probe-pending.mjs` (owned cluster 58593, real AccessService + store over
  psql-rest): 500 unanswered requests appended, clock one hour later →
  `rows still status=pending (all expired): 500`; five new asks from ONE agent →
  `pending | pending | pending | pending | pending`, `prompts presented: 5 (maxPendingPerAgent default 3)`;
  `overview().pending (what Settings and the queue show): 0 of 5 live`. One agent re-asking while the
  operator is away reaches 500 in ~28 h at the cap's own rate (3 per 10 min). The same window shape applies
  to the denial lookup (`status: 'denied'`, cleared denials stay `denied`).
- Fix: read live pending requests with `expires_at > now` in the query (`.gt('expires_at', iso)`), order
  newest first, and count caps with a `count` query rather than a capped page; same for the denial lookup
  (`is('denial_cleared_at', null)`). Add a probe with >500 stale rows to hub-door-db.

### DA-6 — MEDIUM: a product connection is per estate, its secret slot is per machine
- Evidence: `product_connections_live` is unique on `(estate_id, product)` (hub_access.sql:156) and probe
  P3 shows estate A and estate B each holding a live fabric-inbox connection at once; both rows name the
  same vault slot, the constant `{project:'fabric', env:'local', name:'FABRIC_INBOX_CLIENT_SECRET'}`
  (productConnect.ts:58), and `vault.put` overwrites it (productConnect.ts:290). activeEstate.ts makes a
  second estate on one machine an ordinary state (the operator opens a restored estate). Connecting in B
  replaces A's secret while A's row keeps A's client id, so A's calls pair client id A with secret B and are
  refused by the product until A reconnects — which then breaks B; a Disconnect in one estate leaves the
  secret the other is using. With DA-2, a restored estate's connection row points at this same live slot.
- Fix: put the estate in the slot name recorded in `secret_ref` (e.g. `FABRIC_INBOX_CLIENT_SECRET_<estate
  short id>`), or make the connection machine-level and say so in the ADR; either way add a two-estate case.

### DA-7 — LOW: the product's own Allow/Deny and the connect attempt are not in the journal
- Evidence: `ProductConnector.callback` records `denied` / `failed` only in `this.last` (an in-memory map,
  productConnect.ts:141, 238-253) and the operations log; `begin` journals nothing (171-203). Only a
  successful delivery is journalled (`product.connected@1`). A restart loses the outcome Settings shows,
  and the estate's history has no trace that the operator refused the connection in the product.
- Fix: register `product.connect.requested@1` / `product.connect.refused@1` (projects nothing, or the
  "last attempt" column) and append them; read `lastOutcome` from the projection.

### DA-8 — LOW: an incremental Allow that re-grants a held capability moves the grant to the new request
- Evidence: the `on conflict … do update set request_id = excluded.request_id` (hub_access.sql:234-236)
  re-points the held grant; `AccessService.status` lists a request's grants by `g.request_id === row.id`
  (accessService.ts:182), so the FIRST request's status stops listing a grant it still holds.
  hub-access-db asserts the re-point (`${G4}|${R5}|true`), so it is intended at the row level; the status
  read then under-reports. Fix: list the binding's live grants for an allowed first request, or keep the
  originating request id in its own column.

### DA-9 — LOW (test gap): the port-taken fallback in index.ts is driven by no test
- Evidence: hub-door-db 'a port in use is an error naming it' covers `AgentSurface.start({port})` throwing;
  nothing drives index.ts's `catch` → `surface.start()` on an ephemeral port → a session minted there
  still initialises while the door stays closed. By reading it is sound (`this.http` is assigned only after
  `listen` succeeds, agentSurface.ts:327-341, so the second `start()` really listens; the door is closed
  because `doorToken` stays null, agentSurface.ts:414). Fix: extract the start-or-fallback block into a
  function and drive it with a blocked port in hub-door-db.

## Checked and found sound (with the receipt)
- **Hub db suites**, inside `ci.sh full`'s owned-database step: `run-hub-access-db` → hub-access-db
  `{"status":"PASS","cases":12}`, hub-door-db `{"status":"PASS","cases":15}`, "PASS full migration chain,
  the hub access projection refuses impossible transitions on isolated PostgreSQL"; run-function-privileges-db
  PASS (no projector executable by an API role), run-estate-identity-db "all green".
- **Estate isolation on the decision/hop path** (probe P2/P3): another estate cannot decide, claim, revoke,
  clear or disconnect A's rows; B's reconnect does not supersede A; A's rows unchanged. Every arm filters
  `estate_id = e.estate_id`; FKs are composite `(estate_id, id)`. Main-process reads go through the scoped
  store (ci: "scope: 7 raw queries … and 63 projector statements, every one narrowed to an estate").
- **Rebuild equality** (probe P4): live, replay-over-existing and FROM-EMPTY rebuild of an estate with an
  extension, a revoke, a deny+clear, a reconnect and a disconnect hash identically
  (`e287ea4e…` ×3). The suite's own case only replays over existing rows; from-empty now measured.
- **Replay safety**: every arm returns on its own `*_seq = e.seq`; refusals use `occurred_at`, never `now()`.
- **Constraints**: expiry required on grants (`not null`, `> decided_at`) and requests; verifier is 64 hex,
  unique, set once (`(verifier is null) = (claimed_seq is null)`); one live grant per (binding, callee,
  capability, resource); one live connection per (estate, product); binding revoke cascades to its grants in
  the same event. (Upper bounds and `secret_ref` shape: DA-4.)
- **RLS / grants vs neighbours** (probe P6, Supabase defaults in force): RLS on, zero policies, anon and
  authenticated have nothing, service_role select only, truncate=f; trigger=t matches `releases`. The
  hub tables deliberately give `authenticated` no read (releases does) — consistent with the verifier rule.
- **Journal**: every operator decision (`access.decided@1`, grant/binding revoke, denial clear, connect,
  disconnect) and every credential claim is an event; `hub.call.forwarded@1` per hop including refusals,
  `parent_span_id` = the caller's span (hub-products asserts `b7ad6b7169203331`), `trace_incomplete` when
  none, and the forwarded `_meta.traceparent` is the hop's own span (productForwarder.ts:107). Arguments
  are hashed. (Connect attempts/product Deny: DA-7. A hop that fails on Fabric's own store read throws
  before any span — no span, by design of "a hop"; noted, not filed.)
- **Main-process wiring**: registry watched and stopped on quit; hub.json + door token 0600, atomic,
  withdrawn on quit only by the writing pid; a hub with no door token is closed (callback and external
  door both refused — hub-products 'a closed hub …'); session bearers (24 random bytes, 32 chars) cannot
  match the credential pattern (43 chars) and are looked up first; one-shot preserved (hub-door-db case).
- **Memory bounds**: idempotency ≤256 keys per binding, external budget per principal, ≤3 pending connect
  states per product, per-request MCP server/transport closed on response close.
