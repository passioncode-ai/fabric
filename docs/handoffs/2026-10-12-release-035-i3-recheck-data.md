# Fabric 0.3.5 release recheck: data, memory, orchestration, harness

- **Final candidate:** `89718e92704981809f7dc5a7d7e2c4cc64de7bf3`, a detached checkout at `<candidate>`, clean (`git status --short` printed nothing).
- **Previous candidate (iteration 3 read):** `01783787665f400a8a7b7f2ec804ad5b6be9c87e`. Its report is `scratchpad/rv3/data.md`: 7 findings, 0 blocking, ruled into CO-273.
- **Rehearsed migration candidate:** `4b86e817`.
- **Delta read:** `git diff 01783787..89718e92 -- supabase apps/desktop/src apps/desktop/test docs/evidence/specs`. It covers 9 files, +42/−11. `docs/launch/release-mac.md` was also read for the disposition of DA-3.
- **Reviewer run id:** `release-035-i3-recheck-data-20261012`.
- **Read-only.** Nothing was edited, committed or pushed in the repository. No app was launched. No stack was started. Ports 54321/54322 were not touched.
  - Side effect: one `git fetch` of `refs/agent-sync/ids/CO` wrote `FETCH_HEAD` in the shared git directory. The working tree is unchanged.
  - Local files written: only this report and the logs beside it in `scratchpad/rc3/`.

## What I ran

| Command | Exit | Result |
|---|---|---|
| `git diff --quiet 4b86e817..89718e92 -- supabase/migrations` | 0 | Empty: the migrations are byte-identical to the rehearsed candidate. |
| `git diff --name-only 4b86e817..89718e92 -- supabase` | 0 | Empty: `config.toml`, `seed.sql` and the ledger are unchanged too. |
| `node scratchpad/ledgercheck.mjs .` (my own check: sha256 of each file with line endings normalized to LF, compared with `supabase/migration-ledger.json`, plus order and coverage) | 0 | 84 ledger entries and 84 files. Order matches. 0 mismatched, 0 missing, 0 unrecorded. |
| `node scripts/check-migration-order.mjs` | 0 | `PASS migration order: 84 applied migration(s) recorded in merge order with their bytes` |
| `npx vitest run src/renderer/src/harnessAgentWords.test.ts` (apps/desktop) | 0 | 2/2 passed |
| `node scripts/check-registers.mjs` | 0 | 273 carry-over rows. `PASS: registers parse, citations resolve, asserted counts recompute` |
| `node scripts/check-regions.mjs` | 0 | 327 markers. The `seed-repair` region's new `#amendments` reference resolves. |
| `gh run view 38219258686 -R passioncode-ai/fabric --json …` | 0 | headSha `89718e92…`, `workflow_dispatch`, conclusion `success` |
| `gh run view 38219258686 --job 114713471410 --log` | 0 | 10 128 lines. Ends `full tier green.` and the disposable stack is removed. |
| `git ls-remote origin refs/agent-sync/ids/CO`, then fetch and read the message | 0 | `{"reg":"CO","next":274,…,"rkey":"rv3-data"}` |

## Verdict per item

### 1. Migrations are byte-identical to `4b86e817`: CONFIRMED

`git diff 4b86e817..89718e92 -- supabase/migrations` is empty (exit 0). The whole `supabase/` tree is unchanged.

Each of the 84 files hashes to its `migration-ledger.json` entry, in ledger order, with none missing or unrecorded. `check-migration-order.mjs` passes on its own. The rehearsal (79 → 84) therefore still describes these bytes.

### 2. The delta's test changes are faithful: CONFIRMED

None of them weakens an assertion. Each one makes a fixture match code that changed in an earlier iteration.

- **`work-claims-db.test.mjs` adds `.claude/agent-sync.json` with `{}`.**
  - The real gate is `agentSyncLeases.ts#usesAgentSync`. It only calls `access()` on `.claude/agent-sync.json` and never parses the file, so `{}` is enough to model a repository that uses agent-sync.
  - `createLeaseRefReader` returns `not-used` without that file, and `fabric_work_list` would then carry no leases. The test's assertion `agent_sync_leases.read === true && leases[0].key === 'docs/evidence/backlog.md'` would fail for the right reason, so the fixture had to change.
  - The `not-used` branch itself stays covered by `test/agent-sync-leases.test.mjs`. That file has the injected `usesAgentSync: async () => false` case (asserts `code === 'not-used'` and no remote read) and real-directory cases where the file is absent and then present.
  - Hosted log: all 25 ok-lines of `[132/136] work-claims-db` pass, including "agent-sync's leases are listed read-only, decoded".
- **`memory-eval` and `handshake-e2e` pty stubs gain `get: () => undefined`.**
  - `AgentSurface` now calls `deps.ptys()?.get(sessionId)` in `#sessionSign`, `#projectSessions` (via `sessionSign`) and at the observe and scope sites. The stub without `get` would throw `TypeError` once a held session was read.
  - The real `PtyManager.get` returns `TerminalSession | null`, while the stub returns `undefined`. Every call site reads it through `?.` or `?? null`, so the two values behave the same. The stub models the real API's "no such session" answer and suppresses no check.
  - memory-eval passed in the hosted log: 34 ok-lines, no FAIL.
- **`runtime-observer.test.mjs` switches `codex` to `cline` in the M181 case.**
  - In `shared/agents.ts`, Codex now declares `surfaceAdapter: 'codex-config-home'` with `connectsToSurface: true`. Cline declares `surfaceAdapter: 'none'` with `connectsToSurface: false`.
  - `runtimeObserver.ts#capabilitiesFor` reads exactly these fields. The case's purpose, "a runner with no surface is never reported stalled", needs a runner that still has none, and Cline is one. Keeping Codex would have tested the opposite claim.
  - The positive control is unchanged (`claude-code` must be `stalled`), as is the unknown-runner case. The hosted log shows all 7 lines ok, the swapped one reading "(quiet)".

### 3. The hosted full tier passed on this commit: CONFIRMED

Run 38219258686 (`ci`, `workflow_dispatch`) has headSha `89718e92704981809f7dc5a7d7e2c4cc64de7bf3` and conclusion `success`.

| Job | Result |
|---|---|
| `fast — no database` | success |
| `full — with a disposable stack` | success, 07:49:49 to 08:03:21 Z. Log ends `full tier green. The live stack was not addressed`. |
| `gate` | skipped. Correct: `if: github.event_name == 'schedule'`, and this run was dispatched. |

The delta's tests ran inside the full job:

| Test | Position | Result |
|---|---|---|
| `harnessAgentWords.test.ts` | vitest | 2 tests ✓, twice |
| `runtime-observer` | 102/136 | passed |
| `memory-eval` | 116/136 | passed |
| `work-claims-db` | 132/136 | passed |

`handshake-e2e.test.mjs` is not part of the full tier: it is `test:e2e` and needs `FABRIC_E2E=1` and stack credentials. Its one-line stub change is the same as memory-eval's, which did run. See RC-D1.

### 4. CO-270…CO-273 describe the code: CONFIRMED

- **CO-273 (my level), each claim checked against the code:**
  - **DA-1:** in the claim handler, `linkSource(id, resolved)` runs before `leaseOf(id)` and the `held` refusal. A refused claim has already relinked the task.
  - **DA-2:** `claimByKey` is read before the append, and migration 95 has `create unique index work_claims_key on work_claims (estate_id, idempotency_key)` with `on conflict do nothing`. When two claims race, the second one's `claim_id` is never projected. `leaseOf` then shows its own session, so the answer falls through to `unresolved-run` ("the task's last run has not ended").
  - **DA-4:** `index.ts` reads `access_grants` filtered by `revoked_at is null` and `expires_at > now` only, with no `product_connections.removed_at` join. `docs/ANALYTICS.md:50` says "on a connected product".
  - **DA-5:** `workRead.ts#readWhereWork` has `.limit(500)` on projects and `.limit(5000)` on review tasks. `supabase/config.toml:18` sets `max_rows = 1000`.
  - **The named files exist:** `workTools.ts`, `workRead.ts`, `index.ts` usageCounts.
- **CO-273's list (DA-1, DA-2, DA-4, DA-5) disposes every iteration-3 data finding:**
  - DA-3 (the runbook misnaming migration 91) is fixed in this delta. `docs/launch/release-mac.md` now says 91 "projects the floor's `grants` (money, deletion and publication effects) from the journal".
  - DA-6 (the eviction test does not assert the release) is carried in CO-270.
  - DA-7 (info, frozen header) needs no action.
- **CO-270, spot-checked:**
  - `sessionEnroll.ts` has `MAX_ENROLLED_PER_BINDING = 8`. `evictedReason` says "Its claims were released" (ER-11).
  - `fabricMcpMain.ts` registers only `process.stdin.once('end', …)`. There is no SIGTERM or SIGHUP handler (ER-2).
- **CO-271, spot-checked:**
  - `shared/linkRoute.ts` exists. `main/index.ts` has `#region fabric-link-handler`, which takes remotes from `projectReposWithRemotes`, and that goes through `cachedOrigin` (ER-6). `en.ts` has 9 `links.notice*` keys.
- **CO-272, spot-checked:**
  - `i18n/en.ts`, `ru.ts` and `docs/brand/strings.md` exist. The wording findings are other levels' and were not rechecked line by line.
- **Next free ID:** `CO-274` matches the counter ref (`next: 274`, rkey `rv3-data`), and `check-registers.mjs` passes.

## Findings

| ID | Blocking? | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| RC-D1 | No (info) | The `handshake-e2e.test.mjs` stub change is not exercised by any hosted tier. The test needs `FABRIC_E2E=1` and stack credentials and is not in `scripts/ci.sh full`. The change is identical to memory-eval's, which did run green, so the risk is nil for this release. | `apps/desktop/package.json:39` (`"test:e2e": "FABRIC_E2E=1 node test/handshake-e2e.test.mjs"`); the full-job log has no `handshake-e2e` line; header of `test/handshake-e2e.test.mjs` (lines 20 and 40). | None for 0.3.5. If its coverage is wanted, run it on the next stack-bearing tier. |
| RC-D2 | No (low) | DA-5's truncation also affects the analytics grant count: `agents_with_access` and `coding_agents_enrolled` read live grants with `.limit(10_000)`, but the API returns at most 1000 rows. Past 1000 live grants both counts are undercounted with no notice. It is unreachable at today's scale and pre-existing, but CO-273 names only «Where work is». | `apps/desktop/src/main/index.ts:990` (`access_grants … .limit(10_000)`); `supabase/config.toml:18` (`max_rows = 1000`); `analytics.ts#agentCounts`. | Fold it into CO-273's fix: count with `count: 'exact'`, or an RPC with distinct counts, when DA-4's connected-product filter is added. |

**Counts:** 2 findings, 0 blocking (1 info, 1 low). All four items are confirmed.

**Verdict:** nothing blocks the release at this level. The migrations are the rehearsed bytes, the test edits model the real code without weakening it, the hosted full tier is green on `89718e92`, and CO-270…CO-273 describe the code.
