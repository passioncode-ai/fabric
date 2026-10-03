# Iteration 1 — Level 2: errors and boundaries (security emphasis)

Change under review: `67a5dc42` "feat(hub): local agents reach cloud products through Fabric on consent (ADR-0115) (#7)"
Worktree: `<worktrees>/hubv-read` (read-only). Reproductions: `../repro/*.mjs` beside this file,
run with `node --experimental-strip-types` from `apps/desktop` against the real modules.
Reviewer: fresh, independent; earlier iterations' findings not read.

Status: COMPLETE — see the end of the file.

## Findings

### ER-1 — A FIFO or device file in `services/`/`providers/` freezes the main process (registry read is synchronous and unguarded)
- **Severity:** Medium (main-process event loop blocked indefinitely; at launch Fabric never finishes bootstrap). Proposed blocking: yes — cheap fix, the loop rule is explicit.
- **Evidence:** `apps/desktop/src/main/agentRegistry.ts:269-273` — `statSync(file).size > MAX_FILE_BYTES` then `readFileSync(file)`; `statSync` follows symlinks and reports size 0 for a FIFO and for `/dev/zero`, so both pass the size gate and `readFileSync` blocks the thread. `refresh()` runs synchronously in `bootstrapReady` (`index.ts` hub-wiring: `registry.refresh()` before the surface starts), in every `fabric.access.request` (`accessService.ts:116`), and from the watcher.
- **Reproduction:** `repro/r1-fifo.mjs` (real `AgentRegistry`): `mkfifo services/evil.json` → `refresh()` never returns, its own 1 s timer never fires, process still running after 5 s. Same with `ln -s /dev/zero services/evil.json`.
- **Scenario:** any installer or same-user process leaves a FIFO/symlink-to-device named `*.json` in `~/Library/Application Support/ai.passioncode.fabric/services/`; the next Fabric start hangs before a window appears, and a running Fabric hangs on the next access request (the watcher fires first). Recovery requires finding and deleting the file by hand.
- **Fix:** `lstatSync` and require `isFile()` (refuse symlinks or re-`stat` the target and require a regular file), open with `O_RDONLY|O_NONBLOCK` (`fs.openSync(file, constants.O_RDONLY | constants.O_NONBLOCK)`) and read at most `MAX_FILE_BYTES + 1` bytes from the fd; record anything else as a `unreadable` problem. Add the FIFO and `/dev/zero` cases to `agent-registry.test.mjs`.

### ER-2 — Any door-token holder obtains another agent's pending `requestId` and can win its one-time credential
- **Severity:** Medium (security). Defeats "the first status read returns the binding credential exactly once" *to the asker*; the theft rides on the legitimate agent's prompt and reason, so the operator sees exactly one prompt and allows the legitimate request. Proposed blocking: yes (release owner's "race to read the credential twice").
- **Evidence:** `accessService.ts:136-137` — a pending request with the same signature and `asked_by_binding === null` is returned to ANY door caller (`requestSignature` excludes `reason`); `accessService.ts:171` — `mine` is `true` for every door principal, so any door holder may read any request's status; `accessService.ts:191-201` — the first door read after Allow mints and returns the credential.
- **Reproduction:** `repro/r2-hijack.mjs` (real `AccessService`, in-memory store applying migration 76's transitions): legit asks → thief asks the identical capabilities/resources with a different reason → *same requestId, 1 prompt shown*; operator allows the legit request; thief reads status first → `credential: true`, `authenticate()` resolves it as `example-agent`'s binding; legit then reads `"Allowed. The credential was handed over once…"`.
- **Scenario:** a second process on the Mac (a compromised tool, another agent) watches for a known agent's routine request (agentId, mailbox and tool names are in that agent's own config), re-asks the same thing, and polls. It receives a year-long binding credential the operator granted to the real agent; the real agent is locked out until the operator re-prompts. The same-user floor admits impersonation by *asking*, but not silent capture of a decision made on someone else's prompt.
- **Fix:** RFC 8628 shape — return a per-request poll secret (`deviceCode`, 32 random bytes, store its sha256 on the request) only in the answer that CREATED the request; `fabric.access.status` requires it (door principal) and compares in constant time. The dedupe answer for an identical pending request must not hand out the poll secret (return `pending` with no handle, or refuse with "already asked"). Test: second asker cannot read status / claim.

### ER-3 — Each `agent.call` parks a libuv threadpool thread on a FIFO open; four concurrent calls starve every fs/DNS operation of the main process
- **Severity:** Medium (main-process degradation under ordinary load; the event loop itself keeps turning, but every `fs.promises`, `dns.lookup` — including the forwarder's own fetch to the product — and async crypto waits).
- **Evidence:** `observatoryVault.ts:174-205` — `createReadStream(fifo)` opens the FIFO through the threadpool; `open(2)` on a FIFO blocks until a writer opens it, i.e. for the whole `use_secret.py run` (real engine measured here: ~0.3 s per Python start; `run` has a 7 s timeout). `hubCall.ts:149` reads the secret on every call. Electron's main process has the default `UV_THREADPOOL_SIZE=4`.
- **Reproduction:** `repro/r4-vault-pool.mjs` (real `createObservatoryVault`, fake engine whose `run` takes 3 s): an unrelated `fs.promises.readFile` takes **1 ms with 2** concurrent reads, **2222 ms with 4**, **2315 ms with 6**.
- **Scenario:** two agents each issue a couple of calls at once (or one agent fans out); for the duration of the vault reads Fabric's renderer IPC handlers that touch files, the session manager, transcripts and the forwards' own DNS lookups all stall; with Observatory slow (7 s timeout) the stall is 7 s per wave.
- **Fix:** open the FIFO with `O_RDONLY|O_NONBLOCK` (returns immediately on macOS) and read with a non-blocking stream (`fs.createReadStream(null, { fd })` or `net.Socket({ fd })`), or replace the FIFO with a pipe on the child's fd 3 (`spawn(..., { stdio: ['pipe','pipe','pipe','pipe'] })` and `printf ... >&3`), which needs no filesystem object at all. Also cache nothing longer than the call, as today. Add a concurrency test (N=6) asserting an unrelated fs read stays fast.

### ER-4 — `vault.read` has no deadline on the secret's arrival: a `run` that exits 0 without writing hangs the call forever and the process cannot exit
- **Severity:** Low (depends on the tool honouring its contract; consequences are severe when it does not).
- **Evidence:** `observatoryVault.ts:191-204` — the release-the-reader path runs only when `r.code !== 0`; with exit 0, `await reading` has no timer. The `finally` `rmSync` never runs, so the `fabric-secret-*` dir leaks.
- **Reproduction:** `repro/r4-vault-pool.mjs exit0-nowrite 1`: the read is `STILL PENDING after 15s`, and `process.exit(0)` does not return — the process is still alive 25 s later because a threadpool thread is parked in `open()` on the FIFO (Node waits for it at exit; Electron's quit is expected to behave the same — not measured in Electron).
- **Scenario:** an Observatory version whose `run` short-circuits (dry-run flag, policy refusal printed with exit 0, a wrapper script) makes every `agent.call` hang until the agent times out, each one parking a pool thread (ER-3), and blocks Fabric's quit.
- **Fix:** after `r` resolves, race `reading` against a short timer; on expiry, open-and-close the write end (as the failure path does) and refuse "the vault handed nothing over". Covered by the ER-3 fix too if the FIFO is replaced by an inherited pipe (EOF arrives when the child exits).

### ER-5 — An idempotency key replays the product's earlier answer after the grant is revoked or the product disconnected
- **Severity:** Low (data the agent already received once; but "Revoking stops the next call" (ADR §3) is not true for a retried key for 24 h).
- **Evidence:** `hubCall.ts:187-191` — a remembered key returns `seen.answer` before `perform` (and therefore before `liveGrantsOf`/`coverage`/`liveConnection`).
- **Reproduction:** `repro/r6-idem.mjs`: call with key `k1` → `MAIL BODY #1`; operator revokes the grant and disconnects the product; same key → `MAIL BODY #1` again, `forwards: 1`, no refusal. (Across bindings the map is per binding: another binding with `k1` gets `access-required` — sound.)
- **Fix:** on a hit, re-run the grant check (`resourceArguments` + `coverage` against live grants) and refuse `access-required` if it no longer covers; drop a binding's map on `revokeGrant`/`revokeBinding`/disconnect.

### ER-6 — The connect callback has no deadline of its own: a vault slower than the product's 10 s leaves Fabric "connected" to a key the product has revoked
- **Severity:** Medium (honest degradation: the operator is told "connected", every later `agent.call` fails `product-refused`, and on a Reconnect the previous working connection has already been superseded).
- **Evidence:** `productConnect.ts:277-307` — `store.append` then `vault.put` then `write(res, 200)`, with no overall timer and no check that the socket is still open. `vault.put`'s own bounds add up to 5 s (`full-path`) + 2 s (`which`) + 7 s (`where`) + 7 s (`put`/`rotate`) = 21 s (`observatoryVault.ts:102,116,136,154`), against the product's 10 s (ADR §4.4: "If the callback does not answer 2xx within 10 s, the app revokes the key"). Measured here, real engine: `full-path` 0.24–0.30 s, `where` 0.29–0.36 s — fine when idle, but this machine's swap pressure is documented.
- **Reproduction:** `repro/r5-callback-late.mjs` (real `AgentSurface` + `ProductConnector`, vault `put` taking 2.5 s, client giving up at 1 s as the product does at 10 s): product `gave up (TimeoutError) -> revokes key k1`; Fabric `live connection key: k1`, `outcome: connected`.
- **Fix:** give the callback one deadline below the product's (e.g. 8 s from the first byte) covering record + vault; on expiry, or when `res`/`req` closes before the 200 is written, withdraw the record (`product.disconnected@1`) and settle `failed` with "the product gave up before the key was stored". For a Reconnect, keep the previous connection live until the new one is stored (supersede only on success) so a failed reconnect does not cost the working one.

### ER-7 — The door token is ONE budget bucket for every agent on the Mac, and unauthenticated bearers cost a database read with no budget at all
- **Severity:** Low (availability, same-user).
- **Evidence:** `agentSurface.ts` `handleExternal`: `const key = principal.kind === 'door' ? 'door' : \`binding:${id}\`` — all door traffic (every agent's `fabric.access.request` and its `fabric.access.status` polling) shares 120 calls/min; the budget is checked only after a principal is found, so any 43-character bearer reaches `access.authenticate` → `bindingByVerifier` (one PostgREST round-trip) unmetered.
- **Reproduction:** `repro/r7-door.mjs` (budget lowered to 5): door calls `200,200,200,200,429,429,429` — a second agent is refused once the first one has spent the bucket.
- **Scenario:** one agent polling `fabric.access.status` in a tight loop (or a misbehaving one) locks every other agent out of asking; the agent the operator just allowed cannot collect its credential within the 10-minute claim window and must ask again.
- **Fix:** key the door budget by the request's `requestId`/`agentId` (or a per-request poll secret, see ER-2), and add a small global budget for unknown bearers before the database lookup.

### ER-8 — While Fabric holds 127.0.0.1:47070, another program can take the same port on `::1` and `0.0.0.0`; an agent that dials `localhost` reaches it while hub.json's pid is alive
- **Severity:** Low (needs an agent that deviates from the published origin; the amendment's pid check passes because Fabric IS alive).
- **Evidence:** `agentSurface.ts` `start()` listens on `127.0.0.1` only; libuv sets `SO_REUSEADDR` on TCP listeners, so a wildcard or IPv6-loopback bind of the same port succeeds. `hubTools.ts:15-16` (`VERIFY_HUB`) tells agents to check the pid, not to use the origin verbatim.
- **Reproduction:** `repro/r8-port.mjs` (real `AgentSurface` on port P): a second listener on `127.0.0.1` → `EADDRINUSE` (sound, `HubPortUnavailable`), on `0.0.0.0` → `BOUND`, on `::1` → `BOUND`; `http://127.0.0.1:P` → Fabric (404), `http://localhost:P` → `200 SQUATTER`, `http://[::1]:P` → `200 SQUATTER`.
- **Fix:** add to `VERIFY_HUB` (and the hub doc in `hub.ts`): "connect to `origin` exactly as hub.json writes it — never `localhost`"; optionally also listen on `[::1]:<port>` so the port is Fabric's on both loopbacks (and refuse to start the hub if that bind fails).

### ER-9 — What the prompt shows is not always what is granted: invisible characters are removed from the display but kept in the stored resource
- **Severity:** Low (no widening found — the product reads the stored id as a different, non-existent mailbox, and a non-Latin-1 narrowing header fails at `fetch` — but the operator's decision is about a string they were not shown).
- **Evidence:** `shared/access.ts:141` `ACCOUNT_CF` excludes only `@ \s / : % ,`, so U+200B, U+2060, U+00AD and homoglyphs pass `normaliseInboxAccount`; `displayResource` → `oneLine` strips U+200B/U+2060 (and U+00AD renders invisibly).
- **Reproduction:** `repro/r9-shown.mjs`: granted `"cloudflare:news@example.com​"` → shown `"read mail in news@example.com"` (identical to the plain address); same for U+2060; U+00AD and Cyrillic `е` shown visually identical.
- **Fix:** refuse, at `normaliseInboxAccount`, any resource that is not printable ASCII (Cloudflare addresses and Gmail ids are ASCII; Fabric Inbox's `create_address` localPart is `[a-z0-9._+-]`), so the shown string and the granted string are byte-identical. Same rule in Fabric Inbox's `cloudflareId` keeps the two readers aligned.

### ER-10 — `vault.read` checks "vault only" with a separate `where`, then runs `use_secret.py run` without `--vault-only`
- **Severity:** Low (time-of-check/time-of-use within the same-user floor; contradicts §6 "a product secret kept outside the vault" being refused by construction).
- **Evidence:** `observatoryVault.ts:136` (`where`) and `:188` (`run --env … fabric NAME -- …`, no `--vault-only`). The real `use_secret.py run` resolves with `vault_only=args.vault_only or vault_only_default()` (engine `tools/use_secret.py:367-370`); its own help names `--vault-only` as "the rule for agents and services".
- **Scenario:** between the two calls an env file for `fabric/local` gains `FABRIC_INBOX_CLIENT_SECRET` (or resolution order changes in a later Observatory); `run` hands Fabric that value while the `where` answer said vault.
- **Fix:** pass `--vault-only` to both `where` and `run` (keep `where` only for its better refusal message).

### ER-11 — A failure that throws inside `agent.call` writes no journal span and hands the raw exception text to the agent
- **Severity:** Low.
- **Evidence:** `hubCall.ts:136,144` — `liveGrantsOf` and `liveConnection` throw on a failed read before any `span(...)`; `canonical()` (`hubCall.ts:51`) recurses without a depth bound; `hubTools.ts:85-93` `guard` turns the throw into `hub-unavailable: Fabric could not complete this: ${e.message}`. ADR §5.4 and the module header promise one span per hop, "refusals included".
- **Reproduction:** `repro/r7-door.mjs`: `agent.call` with 20 000 nested arrays → `{"code":"hub-unavailable","message":"Fabric could not complete this: Maximum call stack size exceeded"}` in 11 ms (no crash, loop not blocked — sound), and no `hub.call.forwarded@1` was appended.
- **Fix:** bound `canonical` (or reuse `resourceArguments`' depth-16 refusal before hashing: refuse `invalid-arguments` first), wrap `perform` so a throw writes a `failed` span with `error_code: 'hub-unavailable'`, and give the agent a fixed sentence while the cause goes to the operations log (as the vault path already does, `hubCall.ts:152-155`).

### ER-12 — A binding whose credential was never collected is listed to the operator as an agent with live access
- **Severity:** Low (operator-facing honesty).
- **Evidence:** `accessService.ts:279-302` `overview()` lists every binding with `revoked_at === null`, whatever its `verifier`; `status()` refuses to mint after `CREDENTIAL_CLAIM_WINDOW_MS` (`:192-193`), so such a binding can never be used, yet its grants stay "live" for a year in Settings → Agent access.
- **Fix:** list unclaimed bindings separately ("allowed, never collected — expired at …") or have the claim-window expiry revoke them (an `access.binding.revoked@1` by `system:fabric-hub` when the window passes, or at the next overview read).

### ER-13 — An agent that hangs up (or cancels) mid-`agent.call` does not stop the forward: the product still acts
- **Severity:** Low (cancellation; matters for `send_email`/`reply`/`forward`, where a client that timed out and retries with a NEW idempotency key sends twice).
- **Evidence:** `hubTools.ts:156-160` passes only `extra._meta` to `deps.call` — never `extra.signal`; `ForwardRequest` (`productForwarder.ts:26-36`) has no caller signal, only its own 60 s deadline.
- **Reproduction:** `repro/r10-cancel.mjs` (real `AgentSurface` + `hubServerFor` + `createAgentCall`, fake forward taking 800 ms): agent aborts at 200 ms (`TimeoutError`) → `sends that reached the product after the agent hung up: 1`, span `succeeded`.
- **Fix:** pass `extra.signal` through `agentCall` → `perform` → `forwardToProduct` (join it into `controller` with `AbortSignal.any`); skip the vault read and the forward when it is already aborted; journal the span as `cancelled`. For a call already on the wire, say in the tool description that a retry must reuse its `idempotencyKey`.

## Checked and found sound

Every item below was read in the code at `67a5dc42` and, where marked, exercised against the real module.
The change's own pure suites pass here: `node --experimental-strip-types --test test/hub-products.test.mjs test/hub-files.test.mjs test/consent-presenter.test.mjs test/agent-registry.test.mjs` → `tests 46, pass 46, fail 0` (DB-backed suites not run: no stack in this read-only pass).

**Principals and what each reaches**
- Session bearers keep the one-shot rule: `this.states.get(token)` is consulted first and only a non-session bearer reaches `handleExternal` (`agentSurface.ts` `handle`); session tokens are 24 bytes (32 chars) and can never match `CREDENTIAL = /^[A-Za-z0-9_-]{43}$/`.
- Door token → exactly `fabric.access.request`, `fabric.access.status`; binding → those plus `fabric.access.grants`, `agent.call`; no `fabric_*` session tool on either; an unknown bearer → 401 (measured, `repro/r7-door.mjs`).
- Door comparison is constant-time over sha256 digests (`sameToken`); binding lookup is by sha256 verifier; a revoked binding authenticates nothing, re-checked on every request (stateless transport); an authentication store failure is 503 + `retry-after`, not "unknown credential".
- A hub with no published door token (port refused, or quitting) opens neither the callback nor the external door; quit nulls the token before withdrawing `hub.json`.

**fabric.access.request / status**
- Unknown or collided `agentId` refused before any prompt (`registry.resolve`, collision rule; bare id → `.default` only).
- A binding may ask only for its own agent; incremental grants go to the asking binding (service and projector both enforce); a revoked asking binding cannot be allowed.
- Request TTL 10 min enforced in `decide` and again in the projector (`occurred_at > expires_at` raises); claim window 10 min after the decision; the claim is serialized (`serial`) and the projector's `verifier is null` guard refuses a second claim — two reads of one status cannot both mint (the hijack in ER-2 is a different reader winning, not a double mint).
- A standing denial answers `denied` without a prompt until cleared; a used (claimed) request never re-issues the credential; a new identical request after Allow prompts again.
- Nothing widens silently: the projector refuses a grant whose capability or resource was not in the request; one live grant per (binding, callee, capability, resource) via `access_grants_one_live`.
- Prompt text: reason, registry name, `installedBy`, repository and resources pass through `oneLine` (controls, bidi, zero-width, line/paragraph separators removed); Deny is default and cancel; the dialog always has a parent window; prompts are bounded (3 pending per agent, 20 overall).

**agent.call**
- Grant matching reads every `accountId` at any depth and the `accounts`/`hide`/`show` lists, refuses anything it cannot normalise and inputs deeper than 16; capabilities are matched exactly (lower-case pattern at the schema, no aliasing); narrowing is per capability (the mailboxes this binding holds *this* tool for).
- Arguments the check does not read (e.g. `messageId`, `threadId`, `list_messages`' `domain`, admin tools' `address`) are still held by the product: Fabric Inbox origin/main `workers/mcp/scope.ts` — `narrowPrincipal` intersects `X-Fabric-Accounts` with the key, `toolFitsScope` hides every tool with a non-mailbox route (all admin tools except via the header-less setup), `scopedApi` refuses any path outside the named mailboxes. So the second narrowing is real.
- Header injection: narrowing entries come only from normalised grant resources (no `,`, whitespace, CR/LF, `:`/`%` in the address), re-checked in the forwarder (`UNSAFE_IN_HEADER`); `fetch` also refuses CR/LF and non-Latin-1 values.
- `create_address` without the header: only `localPart, domain, name, createRoute` ride along; `forwardTo`/`agent` each need their own per-address grant; any other key refused (matches the product's input list at origin/main `tools.ts:586-593`).
- Idempotency: per binding (another binding with the same key is re-decided — measured), only product-produced answers kept, in-flight retries wait for the first, 24 h / 256 per binding.
- Redirects: POST 307 and the SDK's GET stream 302 are both refused and the capture origin never receives the secret; a product that never answers is `product-unreachable` at the deadline (measured, `repro/r3-forward.mjs`). Product error text reaching the agent has the verbatim secret replaced (a percent-encoded echo survives `scrub`, measured — not reachable with a hex service-token secret, noted only).
- A vault failure tells the agent a fixed sentence; the reason goes to the operations log only.
- Deep or huge input: no crash, event loop not blocked (body cap 1 MB, measured 11 ms for 20 000 levels) — see ER-11 for the span/text gap.

**Connect callback**
- `state`: 32 random bytes, pattern-checked, spent synchronously before any await after the body is read (no double use under concurrency), product-bound, 10-minute expiry; at most 3 waiting per product.
- Browser CSRF / DNS rebinding: any `Origin` header → 403 before the body; `Content-Type` must be `application/json` (not a simple request); the state is unguessable, so a rebinding page gains nothing. Body ≤ 64 KiB and ≤ 5 s (408, connection closed after the answer).
- Vault write: value on stdin only; `said()` redacts the value from the tool's output; record first, then secret; vault refusal withdraws the record and answers 503; Observatory missing → refusal with that reason, nothing kept elsewhere; PATH includes `~/.local/bin` for a Dock-launched app (`env.ts` `fixPath`).
- Secret exposure: never in argv (FIFO + shell builtin `printf`), never in Fabric's logs or journal (`product.connected@1` carries `secret_ref` only; `hub.call.forwarded@1` carries an args hash only; tool traces keep a 4 KiB peek in memory for classification, not logged); the FIFO lives in a 0700 `mkdtemp` dir under the per-user `$TMPDIR`. The value does sit in the environment of Observatory's short-lived `/bin/sh` child — Observatory's own `run` design, same-user readable for milliseconds.

**hub.json and the door-token file**
- Both 0600, written via `O_EXCL` temp + fsync + chmod + rename (no symlink follow, no torn read); door token written before `hub.json`; rotated on every start; removed on quit only when `hub.json` names this pid.
- A second hub on the same `127.0.0.1` port fails `HubPortUnavailable` (measured) — never a fallback port; a port claimed by a registered agent is refused before listening.
- Port squatting while Fabric is down and pid liveness are the agent's check, stated in the tool descriptions (amendment 1); a crash leaves `hub.json` with a dead pid, which the stated check treats as "no hub" (pid reuse after a crash remains a residual risk inside the same-user floor).

Status: COMPLETE — 13 findings: 0 high, 4 medium (ER-1, ER-2, ER-3, ER-6), 9 low (ER-4, ER-5, ER-7 … ER-13). Proposed blocking: ER-1, ER-2.
