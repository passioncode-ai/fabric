---
report:
  id: fabric/2026-10-05-hub-i3-docs-130b5510
  title: "Fabric 0.3.1 · iteration 3 · docs review at 130b5510"
  kind: review
  project: fabric
  domains: [architecture, reliability]
  as_of: 2026-10-05
  status: active
  valid_until: 2026-10-19
  summary: >-
    Independent iteration-3 docs review of the converged 0.3.1 candidate 130b5510: verdict request-changes,
    15 findings, 2 blocking. Dispositions live in the hub verification ledger.
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

# Fabric 0.3.1 · iteration 3 · docs review at 130b5510

**Candidate:** `130b5510011a0f15858642838fc906ad4af4bf67`. Previous release v0.3.0 is `5193022c` (tag `d2ed94cc`).

This was an independent reviewer run in a fresh context; no earlier review material was opened. The coordinator saved this report verbatim from the reviewer's final message, because the reviewer's harness refused `.md` writes. The structured findings are in `findings.json`.

## Method

- I read ADR-0115 in full (amendments 1–31). I checked every constant, symbol, code path, HTTP status and error code it names against the hub source files, migrations 76/77/80, `servers.ts`, `ceoPrivateArchive.ts` and Observatory's `vault.py`.
- I compared ADR-0105's description of the call path and its credentials with ADR-0115 and `hubCall.ts`.
- I checked the upgrade section of `release-mac.md` against:
  - `schemaReadiness.ts` and `schemaContract.json` (78/78);
  - `schema_version()`, which counts applied migrations (78 files);
  - the bundled-stack code (`bundledStack.ts`, `env.ts`, `electron-builder.yml`);
  - `config.toml` (port 54322, PostgreSQL 17);
  - the `pg_dump` installed on this Mac;
  - the release-gate scripts.
- I also checked CHANGELOG, CONTEXT, terminology, the README, SCN-132/133, FLW-75/76, SCR-41/76, the architecture notes, the design map's top entries, the knowledge pages `plans.md` and `products.md`, and every `#region` marker in the hub files.
- I searched the code for every backticked identifier in ADR-0115.

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `node scripts/check-regions.mjs` | 0 | 148 markers, all resolve |
| `node scripts/check-design-map.mjs` | 0 | stamp OK, 460 anchors |
| `bash scripts/check-docs.sh` | 0 | PASS |
| `node scripts/check-registers.mjs` | 0 | PASS |
| `pg_dump --version` (on PATH) | 0 | **14.24** (a PostgreSQL 17 copy exists separately) |
| count of `run-*-db` runner files | 0 | 16 |
| identifier search over ADR-0115 | 1 | `consentFacts` not found |

## Findings

| ID | Blocking | Finding | Evidence | Fix |
|---|---|---|---|---|
| D-1 | **Yes.** The release notes say something false and leave out the manual upgrade. | The changelog claims "An estate opened by 0.3.1 cannot be opened by 0.3.0". | `CHANGELOG.md:32`. In the code, 0.3.1 never migrates: it refuses any schema below 78 before starting services (`schemaReadiness.ts`, `withSchemaReadiness`), so 0.3.0 can still open that database. Only the manual `supabase migration up --local` makes it unopenable by 0.3.0. The startup error points to a repository path a DMG user can't open. | Say that 0.3.1 refuses a 0.3.0 database until the operator follows the upgrade procedure (give the absolute runbook URL), and that a database migrated to 78 can't be opened by 0.3.0. |
| D-2 | **Yes.** The upgrade instruction doesn't work on the target Mac. | The runbook's backup step runs whatever `pg_dump` is on PATH. | `release-mac.md:146-153`. The stack is PostgreSQL 17 (`config.toml`), but this Mac's PATH `pg_dump` is 14.24. pg_dump refuses to dump a newer server, so the backup that steps 3–5 depend on can't be made. It fails safely, without data loss. | Name `/opt/homebrew/opt/postgresql@17/bin/pg_dump` and add a version check, or use `supabase db dump --local`. State which database role the dump needs. |
| D-3 | No | Steps 3 (rehearsal) and 5 (rollback restore) can't be run as written. | `release-mac.md:158-163`: restoring a full dump onto a stack that `supabase start` has already migrated will collide. `run-hub-upgrade-db.mjs` uses a bare PG17 cluster instead. | Give the actual commands. |
| D-4 | No | The release steps leave out the review-receipt checks the gate enforces. | `release-gate.mjs` `reviewProblems` requires a `reviewReceipts` packet (schema `fabric-release-reviews/1`). `release-mac.mjs` `verifiedCandidateProblem` keeps a list of metadata files allowed to change after the verified commit, including `docs/handoffs/2026-10-04-claude-recovery.md`. Neither appears in `release-mac.md:36-51`. | Document both in step 1. |
| D-5 | No | ADR-0105 describes a different call path and credential model from ADR-0115 and the code. | ADR-0105 (`0105:45-55`, `0105:83-84`) has an off-machine agent reach Observatory through the hub, with Fabric minting a credential per call. In the code, `hubCall.ts:303` routes only to `CONNECTABLE_PRODUCTS=['fabric-inbox']`, forwards with the product's own stored key plus a narrowing header, and accepts only agents registered on this Mac. ADR-0034's successor is also named three different ways across the docs. | Amend ADR-0105 to match, and use one sentence everywhere for what replaced ADR-0034. |
| D-6 | No | "Answers within 10 s or keeps nothing" is stated without exception. | `CHANGELOG.md:29`, the `productConnect.ts` header and FLW-76 (`flows.md:2280`) all say it. In the code, if withdrawing a late record fails, the record stays (`withdraw-failed`, `productConnect.ts:446-458`; amendment 28). | Qualify the statement in all three places. |
| D-7 | No | ADR-0115 names functions that don't exist. | `consentFacts` (`0115:210`) was renamed `pendingFacts`; "symbol `withdraw`" (`0115:372`) doesn't exist. | Correct them in an amendment. |
| D-8 | No | The error-code list that ADR-0115 calls "one place" is incomplete. | `hubCall.ts` also returns `binding-revoked`, `idempotency-capacity` and `answer-not-kept`. `outcome-unknown` and `product-outdated` appear only in prose, outside the retry list. | Publish the full table with retry rules. |
| D-9 | No | Region markers: one missing, three pointing at the wrong section. | The new external-ingress code in `agentSurface.ts` (+337 lines) has no marker. Migration 77's marker points at iteration-2 notes but implements amendments 11/14/16. Migration 80's points at §3 but implements amendment 24. `productConnect.ts` points at §4, which later amendments superseded. | Add the marker and repoint the others. |
| D-10 | No | README runner counts are stale. | `README.md:282-285` says 15 runners, 11 in the full tier. There are 16, with 12 in the full tier (`ci.sh:562-564`). | Update the numbers. |
| D-11 | No | Amendment 22's Host rule is narrower than the code. | The code also accepts `[::1]:<port>` (`agentSurface.ts:473`). | Name both forms. |
| D-12 | No | The Telegram architecture doc still marks "Reaching an external tool" as available. | `telegram-surface.md:286` keeps ✅, but sessions Fabric starts have no product route yet (CO-194). | Change the mark. |
| D-13 | No | Migrations 78/79, reserved for later, will be applied out of order. | Their files sort before the already-applied 80, so `supabase migration up` will need `--include-all`, and fresh and upgraded databases will apply them in different orders. No carry-over row records this. | Add a CO row, and either renumber past 80 or document the ordering. |
| D-14 | No | Missing spaces in text the operator reads. | For example "The0.9.0", "off2026-09-14", "count78" and "Fabric0.3.1" in CHANGELOG, the ADR index, `ceo-private-archive.md` and the backlog. | Add the spaces. |
| D-15 | No | The P-08 backlog row is behind. | `backlog.md:90` still says main integration is pending; `130b5510` is that integration. | Update the row. |

## Verified true

- **ADR-0115 constants and amendments 10–31 match the code**, except where D-6 and D-11 say otherwise.
- **All 10 journal events** are registered and have English and Russian feed sentences.
- **The CONTEXT and terminology terms** match what the code does.
- **The runbook's numbers hold:** stack path, ports, `public.journal`, `schema_version()` = 78, and the startup error's link anchor resolves.
- **The changelog and verified-commit checks in the release steps** match the scripts.
- **The knowledge-base pages** correctly say 0.3.0 is released and 0.3.1 is a candidate.
- **AGENTS.md's description of the hub's footprint** is accurate.

## Not run

- `pg_dump`/`psql` against the live stack, because that would read the operator's database. D-2 rests on the installed version, not on an actual failed dump.
- `ci.sh` and the hub test suites, because the full run was in progress.
- The native consent prompt and the Agent access screen.
- External sources (Fabric Inbox repo and issues, fabric-agent-contract#8).
- How `release.yml` extracts the changelog section for the release notes.

## Verdict

**Request changes.** There are 2 blocking findings (D-1, D-2) and 13 non-blocking ones. Both blockers are documentation-only; no code needs to change.

## Recheck at the replacement candidate 19e5427a — 2026-10-05

The same reviewer, continuing its own context, rechecked its findings at `19e5427aabfec4ef23f7131136ffbe2b6ea6c6d1`. Verdict: **approve**. Structured result: `recheck.json`.

| Finding | Result | Evidence |
|---|---|---|
| D-1 | fixed | CHANGELOG.md 0.3.1 'Schema 75 → 78' bullet now says 0.3.1 does not migrate an existing database itself, refuses below schema 78 and links the runbook anchor by absolute GitHub URL; that once migrated to 78 the database cannot be opened by 0.3.0; and that the backup comes first. schemaReadiness.ts schemaBehindRecovery now carries https://github.com/passioncode-ai/Fabric/blob/main/docs/launch/releas |
| D-2 | fixed | release-mac.md step 2 now sets PGBIN=/opt/homebrew/opt/postgresql@17/bin, checks `"$PGBIN/pg_dump" --version` for 17.x, uses $PGBIN for pg_dump, psql and pg_restore, and states the measured 14.24 PATH client. Residual nit, not blocking: step 4 still runs bare `psql` (14.24), which can still run the two SELECTs against a 17 server, with a version warning. |
| D-3 | ruled-acceptable | CO-198 (carry-over line 209) states the gap and refuses to write untested restore commands into a data runbook; it must close before the live database moves to 78. Ruling accepted. Note: release-mac.md steps 3 and 5 do not cite CO-198, so a reader of the runbook is not told the commands are pending; a one-line pointer is recommended. |
| D-4 | fixed | release-mac.md step 1 'Review receipts' paragraph documents the reviewReceipts packet (schema fabric-release-reviews/1, 3 iterations × 5 levels, report/receipt, SHA-256, unique reviewerRun, closed, empty blockingFindingsOpen, dispositions with evidence), distinct and ancestral candidates, and the iteration-3 candidate equal to verifiedCommit. It also gives the post-verification allowlist, includin |
| D-5 | fixed | ADR-0105 has a new amendment, 'the Observatory hop takes ADR-0115's shape': a held/presented credential with no per-call mint, a narrowing header, and 'Observatory is not a hub callee yet: on 0.3.1 agent.call routes only to Fabric Inbox (CONNECTABLE_PRODUCTS)', which matches shared/access.ts:29 and hubCall.ts. ADR-0115 amendment 36 mirrors it. The ADR-0034 lineage now reads consistently: supersede |
| D-6 | fixed | CHANGELOG hardening bullet: 'keeps nothing it could not confirm, except a late record whose withdrawal itself failed'. The productConnect.ts header lines 17-22 name the amendment-28 exception, flows.md FLW-76 adds `G -->\|withdrawal itself fails\| X[Record stays …]`, and amendment 32 restates it. |
| D-7 | fixed | Amendment 32 names apps/desktop/src/shared/access.ts#pendingFacts (it exists) and says there is no separate `withdraw` symbol in productConnect.ts. |
| D-8 | not-fixed | Amendment 33's table still omits two agent.call refusal codes the code returns. productForwarder.ts:193-194 returns `product-refused` (redirect/401/403) and `product-unreachable` (timeout) with reached:false, and hubCall.ts surfaces them via refusal(forwarded.code, notSent(...), {mayHaveRun:false}); neither is in the table. A refusal-form `product-error` with mayHaveRun:false (reached:false) is al |
| D-9 | fixed | agentSurface.ts:689-810 now has `#region hub-external-ingress` → ADR-0115 §1. The migration 77 region now points at the iteration-1 'what the code now does' amendments, migration 80 at the iteration-2 clarifications (amendment 24), and productConnect.ts at the iteration-3 corrections. check-regions.mjs exits 0 with 150 markers. |
| D-10 | fixed | README.md:282-285 now reads 'Sixteen … Four … the other twelve', matching 16 runner files and scripts/ci.sh. |
| D-11 | fixed | Amendment 34: Host admits 127.0.0.1:<port> and [::1]:<port>, anything else 421. Matches agentSurface.ts Host check. |
| D-12 | fixed | telegram-surface.md row now reads '⚠️ partial — external agents only; a session Fabric starts has no product route yet (CO-194)'. |
| D-13 | ruled-acceptable | CO-199 (carry-over line 210) records the out-of-order application and the --include-all need, ties renumbering to the reserving workstream and proposes a filename gate; no suffix 78/79 file exists yet. Ruling accepted. |
| D-14 | not-fixed | Most are fixed (CHANGELOG, ADR index, backlog P-08, ceo-private-archive.md:668-674). Residue: docs/launch/harness-r0/ceo-private-archive.md:679 'also preserves77 acceptance and79 refusal; removing78 is caught …' and ADR-0115:386 amendment 30 'migration suffix80'. Cosmetic, non-blocking. |
| D-15 | fixed | backlog.md P-08 row now names 130b5510 as the converged candidate (ci.sh full exit 0, five reviews) and the fixes branch agent/p08-i3-fixes-20261005 with exact-SHA rechecks pending; the 'Now' line matches. |

New findings introduced by the fixes:

| ID | Severity | Finding |
|---|---|---|
| D-16 | non-blocking | Amendment 33 claims every refusal carries a mayHaveRun flag; most do not |
| D-17 | non-blocking | The CHANGELOG 0.3.1 lead paragraph is process text that the new finalization check does not catch |

## Final recheck at the release candidate 469b4bc6 — 2026-10-05

The same reviewer rechecked the second-round fixes at `487caf3944e6155b7c314db2eaa1508ea2d5b19a` and confirmed that the final candidate `469b4bc6e957fe491c6563214a56a20c7fb1dd1d` differs from it only by `docs/workspace-receipt.json`, `workspace` (the scheduled workspace-publication pin), so the verdict carries over. Verdict: **approve**. Structured result: `recheck2.json`.

| Finding | Result | Evidence |
|---|---|---|
| D-8 | fixed | ADR-0115 amendment 33's table now has `product-refused` and `product-unreachable` rows (may have run: no). This matches productForwarder.ts returning both with reached:false, which hubCall.ts surfaces as refusal(code, notSent(...), {mayHaveRun:false}). |
| D-14 | fixed | Amendment 30 now reads 'suffix 80'. ceo-private-archive.md:679 reads 'preserves 77 acceptance and 79 refusal; removing 78'. A grep over ADR-0115, ceo-private-archive.md, CHANGELOG.md and adr/README.md for suffixN/countN/preservesN/andNN/removingN/The0./off20 finds nothing. |
| D-16 | fixed | Amendment 33 now says: every refusal carries error.code; one that may have reached the product carries mayHaveRun:true; false or no flag means it reached nothing, and early refusals carry no flag. Matches hubCall.ts: outcome-unknown and answer-not-kept carry true; cancelled, idempotency-capacity and the not-sent forward codes carry false; pre-forward refusals carry none. |
| D-17 | fixed | The process paragraph is gone from the CHANGELOG 0.3.1 section (it now opens with the hub bullet). release-mac.mjs changelogProblem now refuses any 'unreleased' heading, 'not (been) released'/'unreleased' in the body, and process wording ('release pull request', 'renames this heading', 'follow(s) the (third) verification iteration'). Exercised on the candidate CHANGELOG with node: as-is → refused  |
| D-2 | fixed (note closed) | Step 4 now sets PGBIN=/opt/homebrew/opt/postgresql@17/bin and runs "$PGBIN/psql". |
| D-3 | ruled-acceptable (accepted; note closed) | Step 3 now says the executable commands for steps 3 and 5 are not written yet (CO-198), so the rehearsal is a manual, recorded check. |
| D-9 | fixed, migration half ruled | Migrations 77 and 80 are byte-identical to 130b5510 (`git diff --quiet 130b5510 HEAD -- …077… …080…` exit 0). Their original markers, 77 → #verification-iteration-2-clarifications--2026-10-04 and 80 → #3-grants-are-standing-narrow-and-revocable, still resolve (check-regions: 150 markers, exit 0). The anchored sections only loosely describe the fenced SQL, but leaving applied, dated migration text  |
