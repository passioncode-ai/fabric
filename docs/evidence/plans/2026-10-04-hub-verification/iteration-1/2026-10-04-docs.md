# Iteration 1 — Level 3: Code ↔ documentation — squash 67a5dc42 (ADR-0115)

Reviewer: fresh, independent; read-only in `<worktrees>/hubv-read` at `67a5dc42`.
Protocol read: `docs/evidence/plans/2026-10-03-verification.md` §Protocol only (lines 8–29).
Written incrementally — findings first as found, then the "sound" list and gate outcomes.

## Findings

### DO-1 · Medium · ADR-0115 Consequences says `'gateway'` is retired and `'fabric'` becomes the implemented route; the code keeps both as before
- Evidence: ADR-0115:160-161 — "`ServerSource 'fabric'` becomes the implemented route … `'gateway'` is retired with this record."
  Code: `apps/desktop/src/shared/servers.ts:33` still `export type ServerSource = 'gateway' | 'fabric' | 'direct'`;
  `planServers` still plans a gateway route (`servers.ts:116-140`), and its header (`servers.ts:22-`) still presents GATEWAY as
  the working route ("already holds upstream keys at mode 600"). `'fabric'` for a session still REFUSES (`servers.ts:108-113`, CO-194).
  The Amendments section (ADR-0115:197-221) does not correct this consequence.
- Fix: append an amendment to ADR-0115 stating the actual outcome — `'fabric'` is implemented for EXTERNAL registered agents only
  (sessions refuse, CO-194) and `'gateway'` stays in code, unreachable since 2026-09-14 — or retire `'gateway'` in `servers.ts`
  with a test; and mark the GATEWAY bullet in the `servers.ts` header as switched off.

### DO-2 · Medium · The handoff is not current: it says the branch is not on `main`, and its receipts are older than the merged code
- Evidence: `docs/handoffs/2026-10-03-hub-consent.md:3` — "Branch `agent/ar-3-hub-consent` (pushed; not on `main`)"; but
  `git branch -r --contains 67a5dc42` → `origin/main` (the squash IS main's head). Its "Checks run" (lines 41-45) state
  `hub-door-db` 14/14, `hub-access-db` 11/11, `agent-registry` 10, `hub-products` 14, `shared/access.test.ts` 17,
  `AgentAccessPanel.test.tsx` 6, vitest 1617/1617. Measured at 67a5dc42 (this review):
  `node test/run-hub-access-db.mjs` → `{"status":"PASS","cases":12}` (hub-access-db) and `{"status":"PASS","cases":15}` (hub-door-db);
  `node --experimental-strip-types test/agent-registry.test.mjs` → `ℹ tests 11`; `hub-products.test.mjs` → `ℹ tests 25`;
  `hub-files` 5, `consent-presenter` 5 (match); `npx vitest run src/shared/access.test.ts` → 30; `AgentAccessPanel.test.tsx` → 7;
  `npx vitest run` → `Tests 1632 passed (1632)`, 145 files. Line 46 gives no `ci.sh fast` outcome at all ("see the pull request").
  The "Done" list omits the security-review behaviours an inheritor must know (Reconnect only by the operator, record-before-secret,
  one live grant, idempotency per binding, `create_address` extras) — they exist only in ADR-0115's Amendments.
- Fix: rewrite the header as merged (`main` @ 67a5dc42, PR #7), replace the counts with the measured ones (and the commands),
  record the `ci.sh fast` outcome or say it was not run, and add one line pointing at ADR-0115 Amendments 1-5.

### DO-3 · Low · Plan rows AR-2.2 / AR-3.1 and the CO-195 row carry stale case counts and "on branch" wording
- Evidence: `docs/evidence/plans/2026-09-29-agent-registry-plan.md` AR-2.2 — "`agent-registry.test.mjs`, 9 cases" (measured 11);
  AR-3.1 — "`hub-door-db.test.mjs` 14, `hub-products.test.mjs` 13, `hub-access-db.test.mjs` 11" (measured 15, 25, 12);
  AR-3.4 — `AgentAccessPanel.test.tsx` 6 (measured 7). All three rows say "Landed 2026-10-03 on branch `agent/ar-3-hub-consent`";
  the change is on `main` as 67a5dc42 (PR #7).
  CO-195's reservation key is `hub-port-collision-sessions-20261003`, which names a different subject from the row
  ("No live end-to-end run with the Fabric Inbox desktop app") — a reader looking the key up finds the wrong topic.
- Fix: update the counts and say "merged to main in 67a5dc42 (PR #7)"; note in CO-195 that the key was reused (or why).

### DO-4 · Low · ADR-0115 §2.3 cites `index.ts:4100-4108` for the parent-window lesson; this change moved it to ~4291-4298
- Evidence: ADR-0115:66 "(lesson at `index.ts:4100-4108`)". At 67a5dc42^ those lines are the lesson; at 67a5dc42 they are
  `createWindow`/`fileWindows` code (`sed -n 4095,4112p`), and the lesson is at `index.ts:4291-4298` (the ~190 lines of hub
  wiring/IPC this very change added pushed it down). `consentPresenter.ts:4-6` cites it by name ("`index.ts`'s startup dialog"), which holds.
- Fix: cite by symbol, not line (e.g. "the startup-failure dialog in `index.ts`, 'A PARENT WINDOW' comment"), via an amendment line.

### DO-5 · Low · Migration 76 describes `product.connected@1` as written after the secret is stored; amendment 4 reversed that order
- Evidence: `supabase/migrations/20261003000076_hub_access.sql:42` event-type note — "a cloud product was connected by its own consent;
  its secret was stored in the vault and only its metadata is here". Code (`productConnect.ts:277-304`) appends `product.connected@1`
  FIRST, then `vault.put`; a refused put appends `product.disconnected@1`. ADR-0115 Amendment 4 states record-first. So a
  `product.connected@1` row can exist whose secret was never stored (and was then withdrawn). The `event_types.note` is the
  catalogue a reader of the journal trusts.
- Fix: reword the note ("…its metadata and the vault slot the secret goes to; a secret the vault refused is followed by
  product.disconnected@1"). Migration 76 is now on `main` but in no release yet (the commit message: "applied nowhere shared");
  edit it before the release applies it, or correct the note with an `update event_types` in the next migration.

### DO-6 · Low · A failed vault write during Reconnect leaves NO live connection; no document says so
- Evidence: projector `product.connected@1` first removes the previous live connection (`20261003000076_hub_access.sql:284-287`,
  "a reconnect supersedes the previous one"); `productConnect.ts:290-303` then withdraws the NEW record on a vault refusal. Net:
  after Reconnect + vault refusal the product is disconnected (old secret still in the vault slot). `productConnect.ts:21-25`
  speaks only of "a failed record leaves the old pair whole" and of the window "until the vault answers"; SCN-133 Errors &
  recovery and FLW-76 (`K -->|vault missing| F[Record withdrawn…]`) do not say the previous connection is gone too.
- Fix: say it in SCN-133 Errors & recovery / SCR-76 `failed` ("a Reconnect the vault refused leaves the product disconnected;
  Connect again") and in the `productConnect.ts` header — or restore the superseded row (behaviour change; level 2's call).

### DO-7 · Medium · The 10-minute credential-collection window exists only in code; ADR, CONTEXT, SCN-132, migration 76 and the agent-facing tool text all say "the first status read after Allow" without it
- Evidence: `shared/access.ts:20-21` `CREDENTIAL_CLAIM_WINDOW_MS = 10 min`; `accessService.ts:191-193` — after it, status answers
  "Allowed, but the credential was not collected within 10 minutes of the decision. Ask again." and a binding principal is told
  "collect the credential with the door token". `git grep CREDENTIAL_CLAIM_WINDOW|within 10 minutes of the decision -- docs CONTEXT.md AGENTS.md`
  → nothing outside code. ADR-0115:74-75 ("On Allow, the first status read returns the binding credential exactly once"),
  CONTEXT "Binding credential", SCN-132 step 4, migration 76 header ("a restart between Allow and that read loses nothing" —
  false past 10 minutes) and the `fabric.access.status` description (`hubTools.ts:117`) omit it.
  Consequence nobody documents: an Allow never collected leaves a binding with live grants and `verifier` null, and
  `AccessService.overview` (`accessService.ts:299-301`, filter `revoked_at === null` only) lists it in SCR-76 "Agents with access";
  "Ask again" then creates a second binding beside it.
- Fix: state the window in ADR (amendment), CONTEXT, SCN-132 (alt path), the status tool description and the migration header;
  and either hide unclaimed bindings from "Agents with access" or say "allowed, credential not collected" in SCR-76.

### DO-8 · Medium · The hub's external contract (`fabric-hub/0.1`) is documented only partly: refusal codes, `fabric.access.grants` and answer shapes live only in code
- Evidence: codes returned to agents — `refused`, `unknown-request`, `hub-unavailable` (`hubTools.ts:92,109,123,158`),
  `unknown-callee`, `invalid-arguments`, `access-required`, `product-not-connected`, `product-credential-unavailable`,
  `idempotency-conflict` (`hubCall.ts:129,134,140,147,155,190`), `product-unreachable|product-refused|product-error`
  (`productForwarder.ts:46`). `git grep` over `docs/ AGENTS.md CONTEXT.md README.md`: only `access-required` appears (ADR-0115 §6).
  The tool `fabric.access.grants` (`hubTools.ts:131-146`) is in no ADR/CONTEXT/AGENTS text (only the handoff names it); the
  status answer's `bindingId`/`grants`/`note` fields and the 429 per-principal budget (`agentSurface.ts` `externalBudget`) are
  likewise undocumented. CO-195 says S5 (the first consumer) is built in another repository — it can only code against this.
- Fix: add a short "Contract on the wire" section (ADR amendment, or `docs/architecture/` page linked from ADR-0115 and
  AGENTS.md) listing the four tools, their inputs/answers, every refusal code with when it is returned and whether a retry
  can succeed, and the 401/429/503 HTTP answers.

### DO-9 · Medium · The connect callback's "2xx within 10 s" contract is stated as honoured, but Fabric's own worst-case path is ~26 s
- Evidence: ADR-0115:113 and `productConnect.ts:11` — "a 2xx within 10 s keeps the key; anything else makes the product revoke it".
  Before answering, `callback` reads the body (deadline 5 s, `productConnect.ts:148`), appends the journal event, then
  `vault.put`, which runs `project-observatory full-path` (`execFile` timeout 5000, `observatoryVault.ts:102`), `/usr/bin/which`
  (2000, :116), `use_secret.py where` (7000, :136) and `vault.py put|rotate` (7000, :154): up to 21 s after the body, 26 s total.
  Past 10 s the product has revoked the key and given up, yet Fabric can still store the secret and keep `product.connected@1`
  live — a connection SCR-76 shows as connected whose key is dead. No document mentions this window. (Behaviour belongs to
  level 2; the doc divergence is that the 10 s contract is presented as met.)
- Fix: give the callback one overall budget under 10 s (e.g. 8 s across body + record + vault, aborting and withdrawing past it),
  or document that a slow vault can leave a dead key recorded and how SCR-76 shows it.

### DO-10 · Low · SCR-41 is not updated for the new `access` row, and ADR-0115 places the request in SCR-24
- Evidence: FLW-75 (`docs/ux/flows.md`) traverses "SCR-41 … access row with the prompt's facts, Allow and Deny"; the code adds
  attention kind `access` (`shared/attention.ts`, `RANK.access = 0`) and `AccessActs` in `ObligationActs.tsx`. SCR-41
  (`docs/ux/screens.md:853-866`) still says "Used by: FLW-25…FLW-29" and its "derived obligation" state lists
  "Review/refusal/lease/proposal" — no access row, no Allow/Deny. ADR-0115:67 says "placed in the attention queue (SCR-24)";
  SCR-24 is the designed-only "Approval queue" (`screens.md:40`, "none yet"). `consentPresenter.ts:7` hedges "SCR-24/SCR-41".
- Fix: add FLW-75 to SCR-41 "Used by" and an `access request` state (prompt's facts, Deny/Allow, leaves on answer/expiry);
  correct the ADR reference to SCR-41 by amendment, and drop "SCR-24/" in the presenter comment.

### DO-11 · Low · Documents still present the machine gateway as the route ADR-0115 supersedes
- Evidence: `docs/architecture/agent-composition.md:139` (`mcp` → "through the gateway, role key per node");
  `docs/architecture/agent-system-map.md:103` (M2 "Per-hop credential scoping through the gateway (ADR-0034)" — "keep | measured");
  `docs/architecture/telegram-surface.md:286` ("Reaching an external tool | ✅ | the machine gateway, ADR-0034");
  living map `docs/reports/map.html:2267` ("чужие серверы — через шлюз"). The ADR index marks ADR-0034's route superseded
  (and the gateway has been off since 2026-09-14), but these were not touched.
- Fix: mark each as superseded by ADR-0115 (or "gateway off since 2026-09-14; external agents via the hub; session servers: CO-194").

### DO-12 · Medium · The plan's canonical module-status table — which "owns module status for the common backlog" — still says AR-3 is "planned"
- Evidence: `docs/evidence/plans/2026-09-29-agent-registry-plan.md:14-26` — "This table owns module status for the common backlog";
  row AR-3 "planned | requires AR-2 and its walking-skeleton acceptance"; row AR-2 "Fabric consumption, registry and SCR-66 remain".
  The same file's task rows now say AR-2.2, AR-3.1 and AR-3.4 are partial with code on main. The published backlog is derived from
  this table (AGENTS "Shared backlog"), so it under-reports. The knowledge base on fabric-workspace `origin/main` (a4c91d5) also still
  lists Fabric's northbound MCP as an "MCP gap" (`knowledge/products.md:77`) and AR-3 "after AR-2" (`knowledge/plans.md:75`).
- Fix: set AR-3 to partial (and AR-2's next-prerequisite text) with receipts; decide whether the KB changes at merge or at release
  and record that decision (AGENTS "After work").

### DO-13 · Low · "Disconnect" is described as if the key were revoked; Fabric neither revokes it nor removes the vault secret
- Evidence: SCN-133 Alt paths — "Disconnect → Fabric stops forwarding to the product; the key itself is revoked in the product's
  Agent access"; `productConnect.ts:310` "the key itself is revoked in the product". `disconnect()` (`productConnect.ts:311-317`)
  only appends `product.disconnected@1`; nothing calls the product and `VaultPort` has no remove — the secret stays in
  `fabric/local/FABRIC_INBOX_CLIENT_SECRET`. SCR-76 shows no follow-up instruction.
- Fix: say it as an instruction ("revoke the key in Fabric Inbox → Agent access; its secret stays in the vault until reconnect or
  `vault.py remove`") in SCN-133 and on the Disconnect outcome in SCR-76 — or remove the slot on Disconnect.

### DO-14 · Low · The living map's last word on the hub is "Осталось: слияние PR #7", and no entry records the merge
- Evidence: lane `iteration-2026-10-03-hub-security-review` ends "**Осталось:** слияние PR #7"; the newest lane
  `iteration-2026-10-04-hub-merge-main` records main merged INTO the branch, not the branch into main; the source stamp names
  that lane. 67a5dc42 is `origin/main`'s head.
- Fix: a lane for the squash-merge (67a5dc42, PR #7), and the security-review lane's "remains" pointed at it (lanes are
  append-only; the new lane can say it supersedes that line).

### DO-15 · Low · Wording divergences, bundled
- ADR-0115:39 "The ingress is AR-2.2, the reader only" — AR-2.2 is the registry READER (S1); the ingress is AR-3.1 (S2, Slices table :188-189).
- ADR-0115 §3/§5 say "resource pattern" / "fit the grant's resource pattern"; code matches normalised ids exactly
  (`shared/access.ts` `coverage`, `held.has(r)`), CONTEXT says "one resource". No pattern syntax exists.
- ADR-0115 §4.5 names only `vault.py put`; code uses `rotate` when the slot exists (`observatoryVault.ts:153`).
- ADR-0115 §4.4 lists `connected`/`denied` deliveries only; code and SCN-133 also handle `{outcome:"failed", error}`
  (`productConnect.ts:243-253`, `no_server|sign_in_required|mint_failed`).
- SCR-76 `read` state says "an empty list says so in words"; the denials list is omitted entirely when empty
  (`AgentAccessPanel.tsx:126`).
- UI feed sentence `event.access.credential.claimed@1` says "access credential" (`i18n/en.ts`) where CONTEXT's term is
  "binding credential"; `access.agents.noGrants` says "the credential". Agent-facing tool text uses "binding credential" consistently.
- Brand string registry: 42 of the 44 new `en.ts` strings raise `B022 … no registry row` in `pnpm gates:docs` (warnings, not
  failures; the repository already carries ~1500 such warnings).

## Checked and found sound (with the receipt)

- **Region markers.** 16 new `#region … docs:` opens in code (hub-consent, hub-access-store, agent-registry, hub-consent-prompt,
  hub-discovery, hub-call, hub-tools, hub-wiring, hub-ipc, product-secret-vault, product-connect, product-forward, hub-access,
  hub-access-schema, plus test-side and the migration's private-archive-source-schema → ADR-0079#decision). Each anchor resolves
  (`node scripts/check-regions.mjs` → `PASS code regions: 96 marker(s), every one closed and every docs reference resolves`) and
  each section read describes the fenced code: §1 → hub.ts / agentRegistry; §2 → accessService / consentPresenter / hubTools;
  §3 → accessStore / access.ts / migration; §4 → productConnect / observatoryVault; §5 → hubCall / productForwarder;
  `#decision` → index.ts wiring; `scn-132-…` → hub IPC. (Coarse but true: hub-tools also serves §5's `agent.call`; hub-ipc also serves SCN-133.)
- **hub.json** fields `{protocol "fabric-hub/0.1", origin, mcp "/mcp", doorTokenFile, pid, startedAt}`, mode 0600, removed on quit by
  the writer only — ADR-0115:49-53 = `hub.ts:28-121`; path `~/Library/Application Support/ai.passioncode.fabric/hub.json` =
  `registryDirs()` darwin root (`agentRegistry.ts:117-120`) = AGENTS.md:147.
- **Door token**: 32 random bytes base64url, 0600 file named by hub.json, rotated per start, two tools only (`HUB_TOOLS.door`,
  `hubTools.ts:57-60`; hub-door-db "the door token reaches exactly the two asking tools" PASS) = CONTEXT "Door token" = ADR §2.1.
- **Tool names and inputs**: `fabric.access.request {agentId, callee, capabilities[], resources[], reason}` (`.strict()`),
  `fabric.access.status {requestId}`, `agent.call {agentId, capability, input, idempotencyKey?}` = ADR §2.1/§2.4/§5 and the
  contract's `interop-agent-call.schema.json` (fabric-agent-contract origin/main) except the capability pattern — which is CO-193,
  and CO-193's quoted contract pattern `^[a-z][a-z0-9.-]{1,127}$` is exact (`schemas/common.schema.json:144-147`).
- **Connect link + callback**: `fabric-inbox://connect?client=Fabric&client_id=fabric&level=admin&callback=…&state=…`
  (`productConnect.ts:161-165`, URL-encoded), state 32 bytes (43 chars, within ADR's 22–128), single use, 10 min; body
  `{state, outcome, server, mcpUrl, key:{id, clientId, level, send, expiresAt}, clientSecret}` validated field by field = ADR §4.4.
- **Narrowing header** `X-Fabric-Accounts` (comma list), refused on `, \r \n \0` (`productForwarder.ts:49-65`); workspace setup sent
  without it = ADR §5.3 and Amendment 5. Credential in headers only (`CF-Access-Client-Id/Secret`); redirects refused on every request.
- **Credential issue-once**: minted at the first door-token status read after Allow, sha256 kept, projector refuses a second claim
  (hub-door-db "Allow: the first status read carries the credential once; the second does not" PASS) — apart from DO-7's window.
- **Port 47070 / FABRIC_HUB_PORT**: `DEFAULT_HUB_PORT = 47070`, `^\d{4,5}$` within 1024–65535, refused when claimed by a registered
  agent, `HubPortUnavailable` on EADDRINUSE/EACCES with no fallback for the hub, sessions on an ephemeral port with ingress closed
  (`agentSurface.ts` `handle`: hub null when no door token) = AGENTS.md:146-149, handoff, SCN-132 Errors, SCR-76 hub-off.
- **Amendments 1–5** each enforced and tested: VERIFY_HUB in all three `fabric.access.*` descriptions (`hubTools.ts:15-16,102-117`);
  `oneLine` / `consentFacts` used by prompt, queue (`index.ts` attention) and SCR-76; `access_grants_one_live` index + projector
  extend; record-then-secret with withdraw; account rule `[^@\s/:%,]+@…\.…`; extras `create_address.forward_to|reply_agent`;
  idempotency per binding, 256 keys, product answers only.
- **ADR-0034 supersede marking** follows the index's append-only rule (old file unedited, index row "route superseded by ADR-0115",
  same pattern as ADR-0038/0039). ADR index row for ADR-0115 present; "Next free ID ADR-0117" with 0116 reserved; pipeline
  reservations moved to migrations 77/78 and ADR-0116 (`python3 test/audit_regressions/fix-pf-06.03.py` → all green).
- **CONTEXT terms** (Hub, Door token, Binding credential, Access grant, Product connection) agree with code, AGENTS.md and the
  agent-facing tool descriptions (except DO-7's window and DO-15's "access credential" in UI copy).
- **AGENTS.md claims**: "listens on one loopback port" (one surface; callback is a route on it); "creates no Keychain item" — true:
  Fabric writes no Keychain item and Observatory's vault is a 0700/0600 file store (`vault.py` docstring, "WHERE VALUES LIVE");
  "value on stdin" (`observatoryVault.ts:154`); "read for one call at a time" (fifo, `hubCall.ts:149`); pid check paragraph = Amendment 1.
- **SCN-132/133, FLW-75/76, SCR-76 vs code**: prompt text and example ("list and search mail and read mail in news@example.com" =
  `describeAsk`), Deny default/cancel, notification click → same prompt, one prompt at a time, expiry skip, Allow-and-connect,
  standing denial + Clear, Revoke/Revoke all, Reconnect-only replacement, hub-off disables Connect/Reconnect, unreadable list with
  Try again — all as written (exceptions: DO-6, DO-10, DO-13, DO-15).
- **CO-193/194/195 rows**: CO-193 and CO-194 accurate (`servers.ts:108-113` refusal names ADR-0115 and CO-194); CO-195 accurate
  in substance (DO-3 for its key); all three cited in backlog lane 6.
- **README**: "Fifteen owned-cluster runners", four in the fast tier = `ls apps/desktop/test/run-*-db.mjs run-ceo-host-sql.mjs | wc -l` → 15,
  and `scripts/ci.sh` fast loop lists the four.

## Gates and runs (this review, worktree at 67a5dc42)

| Command | Outcome |
|---|---|
| `pnpm gates:docs` | exit 0 (product model, system map, design map, check-docs, narrative, ux lint "OK — docs/ux is consistent", brand lint warnings only, vocabulary, registers, plan ids "PASS general plan") |
| `pnpm gates:design` | exit 0 — "PASS: interface tokens and strings", "all 71 event types the code appends are registered", ru covers 1528/1528 keys, 15 icons, 27 raster assets |
| `node scripts/check-regions.mjs` | exit 0 — "PASS code regions: 96 marker(s), every one closed and every docs reference resolves" |
| `node test/run-hub-access-db.mjs` | exit 0 — hub-access-db 12 PASS, hub-door-db 15 PASS |
| `node --experimental-strip-types test/{agent-registry,hub-files,hub-products,consent-presenter}.test.mjs` | 11 / 5 / 25 / 5, all pass |
| `npx vitest run` (apps/desktop) | 145 files, 1632/1632 pass |
| `python3 test/audit_regressions/fix-pf-06.03.py` | all green |

## Summary

15 findings: 0 High, 6 Medium (DO-1, DO-2, DO-7, DO-8, DO-9, DO-12), 9 Low (DO-3, DO-4, DO-5, DO-6, DO-10, DO-11, DO-13, DO-14, DO-15).
None is a code defect found by reading code against code; DO-9 and DO-7 carry behaviour consequences that level 2 should weigh.
