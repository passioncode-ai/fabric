# Release verification — Fabric 0.3.1, the hub (ADR-0115): three independent iterations

Run `2026-10-04-hub-verification`. The operator's rule (2026-10-03, plan row P-02, kept for every release
since): before the DMG and the release, three independent testing iterations across every level of the
project, every finding fixed, and only then the release. This file is the ledger for **Fabric 0.3.1**,
whose new content is the hub — [ADR-0115](../../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md),
squash `67a5dc42` (PR #7) on `main` — and the plan row is [P-08](../backlog.md#general-development-plan).
0.3.0 was cleared by its own ledger, [2026-10-03-verification.md](2026-10-03-verification.md); the release
gate now refuses a ledger whose title does not name the version it clears (V1-1 below), so 0.3.1 cannot be
released on 0.3.0's record.

## Protocol

- **Independent** means each iteration is read by fresh reviewer agents that have not seen an earlier
  iteration's findings or fixes. They read the product and the code first and form their own findings;
  only then is the ledger compared, and a finding an earlier iteration already closed is checked again
  rather than skipped.
- **Levels**, each with its own reviewer per iteration:
  1. *Scenarios, UX and UI* — every SCN/FLW/SCR of the change against the live app and the code;
     every state drawn; visual language, layout, noise; light and dark.
  2. *Errors and boundaries* — failure behaviour of every new path, the file-root boundary, retries,
     idempotency, cancellation, the main-process event loop.
  3. *Code ↔ documentation* — `#region … docs:` markers, ADRs, scenarios, CONTEXT terms, the design map,
     the knowledge base; every claim with its receipt.
  4. *Data, memory, orchestration, harness* — the whole project's stack-backed tier (`ci.sh full`),
     the journal and projections, memory, runs and the provider harness.
  5. *Plan and roadmap* — the general plan, the backlog, the workspace publication.
- **A finding** gets an id `V<iteration>-<n>`, its level, evidence (file:line, command and output, or a
  screenshot) and a disposition: **fixed** (with the commit and the test that now catches it),
  **ruled** (a register row id and the reason it is not a release blocker), or **not a defect** (with
  the measurement). A count is never a disposition (R-002).
- **Exit.** The release proceeds only after iteration 3 ends with zero open findings marked blocking.

## Iteration 1

Five fresh reviewers, 2026-10-04, against `67a5dc42` (the squash of PR #7 on `main`). Reports, kept as written
(machine worktree paths replaced by `<worktrees>/`; their reproduction scripts stayed outside the repository):
[scenarios/UX/UI](2026-10-04-hub-verification/iteration-1/2026-10-04-ux.md) (UX-n, screenshots in
[shots/](2026-10-04-hub-verification/iteration-1/shots/)), [errors and boundaries](2026-10-04-hub-verification/iteration-1/2026-10-04-errors.md) (ER-n),
[code ↔ documents](2026-10-04-hub-verification/iteration-1/2026-10-04-docs.md) (DO-n),
[data, memory, orchestration, harness](2026-10-04-hub-verification/iteration-1/2026-10-04-data.md) (DA-n),
[plan and workspace](2026-10-04-hub-verification/iteration-1/2026-10-04-plan.md) (PL-n). 64 findings, merged where two
reviewers found one thing, give 56 rows. Fixes landed on `agent/hub-0.3.1-verification` in `86bc3ccb` (release gate),
`59f43ab8` (plan, handoff, ADR amendments 6–10, CHANGELOG), `36395532` (migration 77), `bc8e6085` (hub core),
`6b180e8a` (operator surfaces), `6bd10d6a` (the tools' guard), `d74010ae` (ADR amendments 11–19, registry, map),
`7bb8bede` (mockup previews) and the commit that carries this section. "Watched" names what the new test reported
on the old code (R-006). **Blocking** marks the findings the release owner named blocking; none is ruled.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | PL-1 (blocking) | The release gate tied the gate file to the app version, not the ledger: 0.3.1 would have been cleared on 0.3.0's closed ledger | fixed `86bc3ccb`: the ledger's title must name the version exactly; this ledger is 0.3.1's; `release-gate.test.mjs` "the ledger must name the version it clears…" and "the real files…" (watched: the 0.3.0 ledger with a 0.3.1 gate returned no problem) |
| V1-2 | UX-1 (blocking) | The connected-product row collapsed into a one-word column in the side panel, worst in ru | fixed `6b180e8a`: a card per product, acts on their own line, the URL breaks anywhere; `AgentAccessPanel.test.tsx` "UX-1 … acts on their own line … in ru" (watched: expected null to be truthy) |
| V1-3 | UX-2 (blocking) | Consent facts, ask, grant and denial lines and the queue title were English sentences built in main, shown under ru chrome | fixed `6b180e8a`, `d74010ae`: main sends facts, the renderer phrases them from en/ru (`shared/accessWords.ts`), the native prompt follows the operator's language; the check that keeps it: `accessWords.test.ts` "UX-2 — in ru, nothing the operator consents on is English" plus ru scans of the panel and the queue row; `attention.test.ts` (watched: the old title "Example agent asks to use Fabric Inbox") |
| V1-4 | ER-1 (blocking) | A FIFO or a link to a device in `services/`/`providers/` froze the main process | fixed `bc8e6085`: lstat + regular files only, non-blocking open, bounded read; `agent-registry.test.mjs` "a FIFO, a link to /dev/zero and a directory…" (watched: did not return within 5 s) |
| V1-5 | ER-2 (blocking) | Any door-token holder could re-ask another agent's request, read its status and win its one-time credential | fixed `bc8e6085`, `36395532`: a per-request poll secret (RFC 8628) returned only to the creator, sha256 journalled (`poll_verifier`), required for door status reads; the dedupe answer carries none; `hub-access-service.test.mjs` ER-2 cases (watched: no poll secret in the creating answer) and `hub-door-db.test.mjs` (wrong or missing secret refused) |
| V1-6 | ER-6, DO-9 (blocking) | The connect callback had no deadline: a vault slower than the product's 10 s left Fabric "connected" to a revoked key | fixed `6b180e8a`: one 8 s deadline over body, vault and record; the secret first, the record only while the deadline holds and the product waits; otherwise non-2xx and nothing kept; ADR-0115 amendment 13 (`d74010ae`); `hub-products.test.mjs` "ER-6: a vault slower than the product's deadline…" (watched: answered 200) and three more ER-6 cases |
| V1-7 | DA-1 (blocking) | Migration 76's four tables were not guarded at the door; a foreign `binding_id` was accepted | fixed `36395532` (migration 77): `refuse_foreign_hub_identity` for request, binding, grant and connection ids and a live-binding check on `binding_id`; `estate-identity-db.test.mjs` "the hub's creates refuse another estate's id…" (watched: ACCEPTED) |
| V1-8 | DA-2 (blocking) | A restored archive brought back a claimed credential, standing grants and a product connection with nobody's consent | fixed `36395532`: at or below the restore watermark, bindings and grants project revoked and connections removed; `restore-authority-db.test.mjs` "restored hub history is history only…" (watched: a restored binding is live — actual '1', expected '0') |
| V1-9 | DA-6 (blocking) | A product connection is per estate but its secret slot was one per machine | fixed `6b180e8a`: slot `FABRIC_INBOX_CLIENT_SECRET_<ESTATE>_<CONNECTION>`, migration-free; `hub-products.test.mjs` "DA-6: two estates…" (watched: both estates got one slot) |
| V1-10 | UX-3 | A request opened as a sheet on a window the operator was not looking at, with no notification | fixed `6b180e8a`: on screen = visible and focused; queued prompts brought forward on focus; `consent-presenter.test.mjs` UX-3 (watched: a sheet opened on a window the operator is not looking at) |
| V1-11 | UX-4 | Allow in the queue and Settings did not say it also connects the product, nor the one-year line | fixed `6b180e8a`: "Allow and connect {product}" and the one-year line on every surface; `ObligationActs.test.tsx`, `AgentAccessPanel.test.tsx` UX-4 (watched) |
| V1-12 | UX-5 | An Allow that stood but could not open the product read as a failure and re-offered the buttons | fixed `6b180e8a`: its own outcome, settles as allowed with the problem beside it, a follow-up message in the prompt path; `consent-presenter.test.mjs` UX-5 (watched: the operator was told nothing), `ObligationActs.test.tsx` UX-5 |
| V1-13 | UX-6 | "Waiting for your answer in Fabric Inbox" never ended | fixed `6b180e8a`: waiting only while a connect state lives, then "no answer came" with Try again; `hub-products.test.mjs` UX-6 (watched) |
| V1-14 | UX-7 | Raw machine text reached the operator (IPC wrapper, env-var-only hub-off, product ids, "door token") | fixed `6b180e8a`, `bc8e6085`: the app's one error-text rule, products by name, hub-off ends "then quit and reopen Fabric", plain refusal codes; `hub-products.test.mjs` UX-7 (watched) |
| V1-15 | UX-8 | Queue row facts and buttons shared one wrapping flex row | fixed `6b180e8a`, `d74010ae`: facts as a block above, buttons apart (the rules sit outside launch.css's ported block); `ObligationActs.test.tsx` UX-8 (watched) |
| V1-16 | UX-9 | Requests ran together, showed no expiry, buttons named alike for assistive tech | fixed `6b180e8a`: a card per request with the agent's name, "expires in N min", aria-labels naming whose; `AgentAccessPanel.test.tsx` UX-9 (watched) |
| V1-17 | UX-10, DO-13 | Disconnect and Reconnect did not say the product's key stays valid; SCN-133 said Disconnect revokes it | fixed `6b180e8a`: the line after Disconnect/Reconnect, SCN-133 and SCR-76 say Fabric stops using it and it stays valid in the product until revoked there; ADR-0115 amendment 15; `AgentAccessPanel.test.tsx` UX-10 (watched) |
| V1-18 | UX-11 | "Connected products" listing an unconnected one, raw ISO dates, a doubled id, hidden empty denials, an untoned failed line, a question-typed error box | fixed `6b180e8a`: "Products", localised dates, no doubled id, empty denials said, warn tone, `warning` box; `AgentAccessPanel.test.tsx` UX-11, `consent-presenter.test.mjs` (watched) |
| V1-19 | UX-12 | SCR-76 had no preview and the Settings mockup no Agent access entry | fixed `6b180e8a`, `7bb8bede`: the `agent-access` view and its states in the product model, linked from Settings; previews rebuilt (`build-mockup-previews.mjs --check` PASS, 111 views) |
| V1-20 | UX-13 | Agent access stayed open beside Chat, Search or History | fixed `6b180e8a`: one side-panel state; `sidePanel.test.ts` (watched: the old App held separate open flags) |
| V1-21 | ER-3 | Each `agent.call` parked a libuv pool thread on a FIFO open, starving every fs and DNS operation | fixed `bc8e6085`: the FIFO is opened non-blocking (Observatory's `run` closes inherited fds, so a pipe on fd 3 cannot work); `hub-products.test.mjs` vault concurrency case (watched: an unrelated fs read took 726 ms while six key reads waited) |
| V1-22 | ER-4 | `vault.read` had no deadline when `run` exited 0 without writing | fixed `bc8e6085`: a deadline on the secret's arrival, refused "the vault handed nothing over"; `hub-products.test.mjs` (watched: the read never ended) |
| V1-23 | ER-5 | An idempotency key replayed the product's earlier answer after the grant was revoked or the product disconnected | fixed `bc8e6085`: every replay re-checks live grants and the live connection and spends the key otherwise; `hub-call.test.mjs` ER-5 ×3 (watched: a revoked grant still got the remembered answer) |
| V1-24 | ER-7 | One door budget for every agent; unknown bearers cost a database read unmetered | fixed `bc8e6085`: per-request / per-agent buckets under a door-wide ceiling, a budget for unknown bearers before any read; `hub-surface.test.mjs` ER-7 (watched: 429 !== 200; unknown bearers never refused 429) |
| V1-25 | ER-8 | Another program could take the hub port on `::1`/`0.0.0.0` and answer `localhost` | fixed `bc8e6085`: the hub port is held on `[::1]` too; every tool says to use hub.json's origin as written; AGENTS.md; `hub-surface.test.mjs` ER-8 (watched: another program took the port on [::1]) |
| V1-26 | ER-9 | Invisible characters were stripped from the prompt but kept in the granted resource | fixed `6b180e8a`: an account id that is not printable ASCII is refused; `access.test.ts` ER-9 (watched: a zero-width space accepted) |
| V1-27 | ER-10 | "Vault only" was checked with `where` and not enforced on `run` | fixed `bc8e6085`: `--vault-only` on both; `hub-products.test.mjs` (watched: run was called without --vault-only) |
| V1-28 | ER-11 | A throw inside `agent.call` wrote no span and handed the raw exception text to the agent | fixed `bc8e6085`, `6bd10d6a`: `canonical` bounded at depth 16, a failed span, a fixed sentence in the hop and in the tools' guard; `hub-call.test.mjs` ER-11 ×3 (watched: Maximum call stack size exceeded; the exception text reached the agent) |
| V1-29 | ER-12, DO-7 | The 10-minute collection window lived only in code, and an uncollectable binding was listed as live access | fixed `bc8e6085`: such a binding is not listed; the window is in ADR-0115 amendment 12, CONTEXT, SCN-132 and the status tool's description (`d74010ae`, `6b180e8a`); `hub-access-service.test.mjs` ER-12 (watched: listed as live access) |
| V1-30 | ER-13 | A caller that hung up mid-`agent.call` did not stop the forward | fixed `bc8e6085`: the caller's signal reaches the vault read and the forward; a `cancelled` span; retry with the same key; `hub-call.test.mjs` ER-13 ×2 (watched: the forward was given no signal) |
| V1-31 | DO-1 | ADR-0115 said `'gateway'` is retired and `'fabric'` implemented; the code keeps both, sessions refuse | fixed `59f43ab8`: amendment 6 states the real outcome (external agents only, CO-194) |
| V1-32 | DO-2, PL-5 | The handoff and plan rows described a pre-merge world and a done next task | fixed `59f43ab8`: merged as `67a5dc42` (PR #7), measured counts, a new next task; CO-195's trigger updated |
| V1-33 | DO-3, PL-6, PL-14 | Stale test counts in plan rows; CO-195's key names another subject | fixed `59f43ab8`: files cited without counts; CO-195 says the key was reused |
| V1-34 | DO-4 | ADR-0115 cited the parent-window lesson by a line number this change moved | fixed `59f43ab8`: amendment 8 cites it by its comment |
| V1-35 | DO-5 | Migration 76's note said `product.connected@1` follows the stored secret while the code recorded first | fixed `36395532`: migration 77 rewrites the note, and the code now does store first (V1-6) |
| V1-36 | DO-6 | A failed vault write on Reconnect left no live connection, said nowhere | fixed `6b180e8a`: a failed or slow vault keeps the previous connection live; only a late record on Reconnect loses it and says so (`previousLost`); ADR-0115 amendment 13, SCN-133 |
| V1-37 | DO-8 | The hub's wire contract (codes, `fabric.access.grants`, answer shapes, 401/429/503) lived only in code | fixed `d74010ae`: ADR-0115 amendment 19 lists the four tools, every refusal code with whether a retry can succeed, and the HTTP answers |
| V1-38 | DO-10 | SCR-41 lacked the access row; the ADR placed the request in SCR-24 | fixed `59f43ab8`, `6b180e8a`: amendment 8; SCR-41 gains FLW-75 and an `access request` state |
| V1-39 | DO-11 | Architecture pages and the living map still routed foreign servers through the gateway | fixed `59f43ab8`, `d74010ae`: marked superseded by ADR-0115; the map's session-launch step corrected |
| V1-40 | DO-12, PL-2 | The canonical module-status table (the backlog's source) still said AR-3 planned | fixed `59f43ab8`: AR-3 partial with its scope; AR-2's next prerequisite named; heading unchanged for `backlog-sources.json` |
| V1-41 | DO-14 | The map's last word on the hub was "remains: merge PR #7" | fixed `d74010ae`: a top lane records the merge and this iteration |
| V1-42 | DO-15 | Wording divergences (ingress slice, "resource pattern", put/rotate, failed deliveries, empty denials, "access credential") and 42 strings without registry rows | fixed `59f43ab8` (amendments 7, 9, 10), `6b180e8a` (empty denials said, "binding credential"), `d74010ae` (133 rows; the copy defects registering exposed fixed; brand lint 0 errors) |
| V1-43 | DA-3 | Restoring a hub-using estate beside its source failed with a misleading reason | fixed `36395532`: migration 65's "restore collided …"; `restore-authority-db.test.mjs` case |
| V1-44 | DA-4 | "Never the secret" and the expiry bounds were the writer's promise only | fixed `36395532`: `secret_ref` exactly {project, env, name}; request ≤ 10 min + 2 min skew; grant ≤ 366 days; span keys closed; `hub-access-db.test.mjs` three cases (watched: expected a refusal) |
| V1-45 | DA-5 | Expired requests stayed pending forever and reads took the 500 oldest; caps stopped holding after 500 | fixed `bc8e6085`: live and newest-first reads, count queries for caps, standing-denial filter in the query; `hub-door-db.test.mjs` 501 stale rows (watched: 5 of 5 asks let through) |
| V1-46 | DA-7 | The product's own Deny and failure were not in the journal | fixed `36395532`, `6b180e8a`: `product.connect.refused@1`; `hub-access-db.test.mjs`, `hub-products.test.mjs` DA-7 (watched: event type missing) |
| V1-47 | DA-8 | An incremental Allow moved a held grant to the new request; the first request's status under-reported | fixed `bc8e6085`: status lists the binding's live grants covering the request; `hub-access-service.test.mjs` DA-8 (watched: the first request stopped listing a grant it still holds) |
| V1-48 | DA-9 | The port-taken fallback in index.ts was driven by no test | fixed `bc8e6085`, `6b180e8a`: `startHub()` in hub.ts; `hub-door-db.test.mjs` blocked-port case |
| V1-49 | PL-3 | Lane 6's "AR-3 after AR-2" was crossed with no recorded decision | fixed `59f43ab8`: the entry rule records the hub slices went ahead under ADR-0115 |
| V1-50 | PL-4, PL-13 | No plan row for 0.3.1; P-03 and Now stale; the full tier never ran on the merged hub | fixed `59f43ab8`: P-03 in progress, P-08 for 0.3.1 requiring the full tier at the release commit; this iteration's full tier is recorded below |
| V1-51 | PL-7 | Fabric named no minimum Fabric Inbox; v0.9.0 lacks fabric-inbox#24 | fixed `59f43ab8`: CO-195 and the CHANGELOG name the server, Worker version `4fd02b75` or later, which carries #24; the 0.9.0 app only supplies the connect link |
| V1-52 | PL-8 | No knowledge-base page knows the hub, ADR-0115 or the Fabric Inbox server | ruled CO-196 — not a release blocker: the knowledge base is fabric-workspace's publication; its PR lands with the 0.3.1 release |
| V1-53 | PL-9 | CO-193's contract deviation has no row in fabric-agent-contract | ruled CO-193 — not a release blocker: Fabric validates its own schema today; the owner (fabric-agent-contract: `_` in `capabilityName` or a `toolName` field) acts before a second hub client validates against the published schema |
| V1-54 | PL-10 | CHANGELOG had no hub entry; its Unreleased bullet shipped in 0.3.0 | fixed `59f43ab8`: a retroactive `## 0.3.0` and a `## 0.3.1 (unreleased)` section (hub, schema 75 → 77, minimum server, what is not done) |
| V1-55 | PL-11 | The workspace publication is stale and the scheduled sync fails under load | ruled CO-197 — not a release blocker: publication follows the release; the next step is a publish from a clean main and the sync's vitest worker timeouts |
| V1-56 | PL-12 | The runbook's attestation command is the form the shared workflow says fails | fixed `59f43ab8`: `--owner passioncode-ai --signer-repo passioncode-ai/.github` |

Gates on the final tree of this iteration (the commit that carries this section; the tree run is that commit's
content less this paragraph and the map stamp): `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin bash scripts/ci.sh full`
→ **exit 0**, "full tier green. The live stack was not addressed" — the fast tier's steps first (types, design, docs,
vitest 147 files / 1648 tests, the hub pure suites, `run-hub-access-db` hub-access-db 17/17 and hub-door-db 17/17),
then the owned-cluster suites ("PASS full migration chain applied, schema_version 77") and the probe chains on the
disposable stack `fabric_test_9151909e` (API 55421, DB 55422): "104 suite(s) ran across 3 package(s); 104 passed, 0
failed". Said NOT_RUN by the script: the browser suites (no `FABRIC_PLAYWRIGHT_MODULE`/`FABRIC_CHROME` in that run)
and native end-to-end transport. Reaching green took seven earlier runs, each fixed in this commit unless noted:
stale generated projections after the docs changes (the adoption inventory lacked the new `agent-access` view;
mockup coverage, the plan projection and M131's backlog citation moved by one line), a probe template named
`script` (renamed), `claude-code` 2.1.289 installed on this Mac against a matrix pinned at 2.1.288 (re-pinned by
`repin-provider-builds.mjs`, version-only rows), and twice a timing assertion in an untouched measured-runtime suite
(`owned-backend-process-registry`, `backend-listener`) at load average ~80; both pass alone under Node and Electron
and in the green run.

Exit for iteration 1: every finding above is fixed or ruled with a register id. Blocking findings open: none.

Iteration1 landed on main as `2927a087cac61c02f16f41d9bebfdc7403fc577c` ([PR#8](https://github.com/passioncode-ai/fabric/pull/8)). Individual earlier hashes are historical PR#8 receipts (`refs/pull/8/head`); the main squash is the fresh-checkout source receipt.

## Iteration 2

Fresh independent reports formed at main `2927a087`, recovered from the interrupted Claude run.
[Archive and privacy manifest](../../reports/2026-10-04-hub-recovery/README.md) preserve56 findings:
UX11, errors11, docs14, data6, plan14. The linked reports' historical execution claims are not
new recovery executions. Current disposition table follows; root code/branch receipts remain
candidate evidence. Full convergence, seeded upgrade, remaining owning-repository corrections
and fresh independent iteration3 are still required. **Iteration2 has not exited.**

| ID | Source | Finding | Disposition |
|---|---|---|---|
| V2-1 | UX-1 | blocking — the queue's Allow/Deny answer leaks into the NEXT access request opened in the same detail pane | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-2 | UX-2 | blocking — Reconnect: no "waiting" state, and an immediate false claim that Fabric stopped using the live key | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-3 | UX-3 | blocking — a long mailbox runs out of the card on both Allow surfaces; the operator cannot read the whole resource being granted | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-4 | UX-4 | non-blocking — `.lp-facts` override flattens every fact grid in the launch screens | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-5 | UX-5 | non-blocking — English machine text inside Russian sentences on the connect/unreadable lines | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-6 | UX-6 | non-blocking — the late-record-not-withdrawn outcome contradicts itself and carries a Fabric-authored English instruction | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-7 | UX-7 | non-blocking (a11y) — focus is dropped to `<body>` on every act | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-8 | UX-8 | non-blocking (a11y) — "Allow and connect Fabric Inbox" is announced as "Allow Research desk" | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-9 | UX-9 | non-blocking — Connect stays enabled while the product is already waiting | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-10 | UX-10 | non-blocking — narrow window: product acts overflow the card | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-11 | UX-11 | non-blocking — copy | fixed `7f35c16c`: surface receipt; renderer/harness coverage only, native acceptance remains separate |
| V2-12 | ER-1 | `idempotencyKey` does not prevent a second send after a cancel or a timeout — high (blocking for the contract claim) | fixed `0a340e8a`: unknown-write tombstone; product failure/cancel/deadline regressions |
| V2-13 | ER-2 | two connect attempts begun before the first lands both succeed; the first admin key is orphaned and stays valid — medium-high | fixed `d29bcf98`, `7f35c16c`: DB predecessorCAS plus connector serialization; changed-state race root regression51pass |
| V2-14 | ER-3 | no Host/Origin check on the hub port: a web page (DNS rebinding) or any process can lock binding credentials out — medium | fixed `56032339`: preloaded verifier hints/live authentication; root exact Host/Origin ingress |
| V2-15 | ER-4 | every `agent.call` spawns five processes on the main thread, unbounded: measured 0.34 s / 0.83 s event-loop stalls — medium | fixed `e607596a`: vault4running/64waiting, queued/running cancellation and launcher single-flight |
| V2-16 | ER-5 | a JSON-RPC batch spends one budget call for any number of tool calls: the external budget is bypassed — medium-high | fixed `e607596a`: JSON-RPC batch refusal before admitted callbacks |
| V2-17 | ER-6 | Fabric never checks that the product honours `X-Fabric-Accounts`; against a Fabric Inbox server before 0.9.0 the narrowing is void and one mailbox's grant reads every mailbox — medium-high | fixed `d29bcf98`: per-call initialized server identity/version compatibility; live source attestation remains CO-195 |
| V2-18 | ER-7 | prototype-named capabilities throw inside the access rules and come back as a retryable `hub-unavailable` — low | fixed `d29bcf98`: own-property input/capability reads, access regression28pass |
| V2-19 | ER-8 | the grant reads are capped at the 1 000 OLDEST rows, and dead grants never leave them: a live grant can be invisible in Settings and refused by Revoke — medium | fixed `73e8995e`: complete live grant/binding paging and direct grant-id revocation |
| V2-20 | ER-9 | a callback refused before its state is read leaves the attempt "waiting" for 10 minutes — low | fixed `7f35c16c`: invalidcallback settles only its waiting attempt |
| V2-21 | ER-10 | the contract's pid check cannot tell Fabric from a reused pid — info | ruled AR-3.1 / ADR-0115 amendment26: PIDliveness is no identity proof; no authority from discovery |
| V2-22 | ER-11 | the product's error text reaches the agent, client id included — info | fixed `0a340e8a`: product error client-id/secret stripped, fixed agent-facing failure |
| V2-23 | DO-1 | MEDIUM — Reconnect tells the operator "Fabric no longer uses the previous key" before anything changed | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-24 | DO-2 | MEDIUM — ADR-0115 amendment 19 (the agent-facing wire contract) misdescribes `agent.call`'s answer | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-25 | DO-3 | LOW/MEDIUM — CO-197 (and CHANGELOG 0.3.1 "the workspace publication is stale") are false at the candidate | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-26 | DO-4 | LOW — ADR-0105 hands the gateway.ts removal to AR-3.1; ADR-0115 keeps gateway; nobody tracks it | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-27 | DO-5 | LOW — ADR-0034 itself carries no supersede mark; the index carries two different supersede claims | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-28 | DO-6 | LOW — "an agent's call was passed to a product" has no string-registry row (the hub's only one) | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-29 | DO-7 | LOW — "record-failed" copy is false in the one path where the record DID land | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-30 | DO-8 | LOW — ru term for "binding credential" is not one term | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-31 | DO-9 | LOW/MEDIUM — the 2026-10-03 hub handoff still orders inheritors to keep "record before secret" | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-32 | DO-10 | LOW — the 2026-10-04 handoff and plan P-08 describe the pre-merge state; P-08 names schema 76 | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-33 | DO-11 | LOW — three region markers point at a section that does not describe their code | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-34 | DO-12 | LOW — "Worker version 4fd02b75 … carries fabric-inbox#24" rests on timing, and that is not said | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-35 | DO-13 | LOW — agent-composition.md still says Fabric's MCP transport is a client of the running agentgateway | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-36 | DO-14 | LOW — two consent/status lines say less, or other, than the code does | candidate correction present; pending converged docs gate and owning-source disposition |
| V2-37 | DA-1 | BLOCKING — live grants and live credentials the operator cannot see or revoke (capped, oldest-first reads) | fixed `d29bcf98`: authority boundary and complete-read tests in core receipt |
| V2-38 | DA-2 | MEDIUM (non-blocking) — a restored pending request is still decidable, and the SOURCE's poll secret collects the credential in the target | fixed `d29bcf98`: authority boundary and complete-read tests in core receipt |
| V2-39 | DA-3 | MEDIUM (non-blocking) — the agent.call idempotency memory keeps product answers whole, unbounded in size, and past revocation | fixed `d29bcf98`: authority boundary and complete-read tests in core receipt |
| V2-40 | DA-4 | LOW — migration 74's one-spelling rule does not reach the hub keys the door now reads | fixed `d29bcf98`: authority boundary and complete-read tests in core receipt |
| V2-41 | DA-5 | LOW — the hub's own refusals of an ask leave no trace | fixed `d29bcf98`: authority boundary and complete-read tests in core receipt |
| V2-42 | DA-6 | LOW — hash-only storage is the writer's promise, not the schema's, for three hub events | fixed `d29bcf98`: authority boundary and complete-read tests in core receipt |
| V2-43 | PL-1 | P-08 names the wrong schema target for the live database (migration 76; the build needs 77) | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-44 | PL-2 | The live-database upgrade order the plan cites is not in the runbook it cites, and the app does not give the command the runbook promises | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-45 | PL-3 | The release notes extractor publishes an "(unreleased)" section, and nothing refuses a release whose CHANGELOG was not renamed | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-46 | PL-4 | CO-197's evidence and next step describe a state main had already left before the squash landed | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-47 | PL-5 | CO-196's evidence is stale against fabric-workspace origin/main | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-48 | PL-6 | Fabric Inbox 0.9.0 is published but its owning page still lists 0.8.2, and CO-196 gates that on Fabric's release | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-49 | PL-7 | "Worker version 4fd02b75 carries fabric-inbox#24" has no commit receipt in any repository | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-50 | PL-8 | P-08 and the Now line still place iteration 1 "on `agent/hub-0.3.1-verification`", a branch that no longer exists | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-51 | PL-9 | Lane 2's entry rule still describes 0.3.0's entry, not P-08's | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-52 | PL-10 | The release-gate test's "real files" guard is now permanently skipped, and the replacement assertion is weaker than its message | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-53 | PL-11 | The gate does not bind the ledger to the commits it verified | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-54 | PL-12 | The iteration-1 handoff's status and next task are false on `main` | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-55 | PL-13 | The 0.3.1 ledger's "fixed" receipts cite pre-squash commits that are not on `main` | open: owning-source/action receipt required; see exact DO/PL disposition |
| V2-56 | PL-14 | Re-check of iteration 1's PL-9 (ruled CO-193): the owning repository still has nothing | open: owning-source/action receipt required; see exact DO/PL disposition |

See [all DO/PL dispositions](../../handoffs/2026-10-04-hub-docs-plan-dispositions.md) and
[core](../../handoffs/core-resume.md) / [surface](../../handoffs/surface-resume.md) source receipts.


## Iteration 3

_Not started._
