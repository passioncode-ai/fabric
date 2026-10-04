# Hub verification iteration 2: core recovery, 2026-10-04

Objective: finish the abandoned Claude core work without editing its checkout. This packet owns access rules, forwarding, credential/grant reads and the database authority boundary. Parent integrates the connected-product UI, map, ADR, release documentation, overall ledger and final gates.

Recovered source: branch `agent/hub-0.3.1-v2-core` HEAD `9ab28854`, and its five-file tracked dirty diff. Original worktree preserved. New branch `fix/hub-v2-core-resume`; no live database, applications, release approvals or deployments touched.

## Dispositions and implementation context

| Finding | Disposition | Receipt / implementation |
|---|---|---|
| ER-1 | Recovered committed fix: never resend a key whose effect may have run; uncertain outcomes returned explicitly | `9ab28854`, `apps/desktop/src/main/hubCall.ts`; products suite includes cancellation/deadline tests |
| ER-8 / DA-1 | Recovered committed fix: database-filtered complete pagination, live bindings, grant-by-id revoke | `18f30594`, `apps/desktop/src/main/accessStore.ts`; real-store >1000 grant / >500 binding tests in hub-door-db |
| ER-11 | Recovered committed fix: strip client id and secret; fixed agent sentences | `9ab28854`, productForwarder / hubCall; product suite |
| DA-3 | Recovered committed fix: bounded bytes, process-wide entries, TTL sweep, revoke notification | `9ab28854`, hubCall; product suite |
| ER-6 | Finished dirty patch: each narrowed forward checks `serverInfo.name=fabric-inbox`, semver >=0.9.0 before tools/call; mailbox aliases not checked by Fabric refused | shared/access.ts, productForwarder.ts, hubCall.ts; old forwarder regression watched accepted unsafe server; now 39 product tests pass |
| ER-7 | Finished dirty patch: own-property table reads; prototype capability/input names refused without throwing | shared/access.ts; old shared code 3 failures, now 28 access tests pass |
| DA-2 | Fixed: restored pending requests lose poll verifier on projection and migration repair; fresh decisions against below-watermark requests refused | migration suffix80; six owned-PostgreSQL boundary groups pass |
| DA-4 | Fixed: canonical binding_id/request_id/grant_id/supersedes and grants[].id at append door | migration suffix80; owned boundary group |
| DA-5 | Fixed: standing denial, duplicate pending, per-agent and global cap refusals carry bounded operations receipts | accessService.ts; two refusal/verifier tests pass |
| DA-6 | Fixed: top-level key allowlists for requested, credential claimed, product connected events at append door | migration suffix80; plaintext test for each event; revoked projector privileges retained |
| ER-2 | Core DB half fixed: product.connected supersedes must equal current live connection id, under existing estate lock | migration suffix80; first connection null, reconnect current id, stale id refused; callback/begin half owned by surface agent |
| ER-3 | Core hint half fixed: primeCredentialVerifiers at startup + knownCredential sync lookup | accessService.ts; restart/revoke hint regression passes; root wires hint to transport budget and owns Host/Origin |
| ER-4 | Root owns bounded cancellable vault implementation; core call uses read(slot,{signal}) | observatoryVault interface synchronized only; root keeps implementation |
| ER-5 | Root owns JSON-RPC batch refusal | transport change outside this branch |
| ER-9 | Surface owns invalid delivery settles pending attempt | productConnect outside this branch |
| ER-10 | Root owns discovery identity/release policy disposition | no claim of a cryptographic identity from a pid |
| DO-2 | Root owns corrected ADR/tool envelope description | shared docs outside this branch |

### Database contract and compatibility

`20261004000080_hub_authority_boundaries.sql` uses suffix 80 because 78/79 are reserved by a different, unmerged workstream. This branch has **78 migration files**; `schema_version()` counts applied migrations, so `schemaContract.json` is 78..78. Archive export reads the actual `schema_version()`, import accepts 66..78. The suffix is not the schema version. Do not integrate unrelated pending pipeline changes to fill the gap.

Reconnect payload is `product.connected@1 { …existing fields, supersedes: null | <current live connection UUID> }`. The live-write guard runs under append_event's estate lock. It is outside the projector so historical events without supersedes still rebuild. New writes are CAS checked; replay is historical. Database refusals roll back journal insertion.

Access request restore: journal history retains the source event; projection poll_verifier becomes null. A decision above the watermark against a request below it is refused; historical below-watermark decisions still replay. Existing restored projections are repaired during migration. This must run only through approved upgrade procedure, never agent-written live SQL.

Known credential verifier snapshot is a **rate-limit hint**, not authentication. Root awaits `primeCredentialVerifiers()` before opening the surface and checks `knownCredential()` before unknown-token budget. Every admitted bearer still goes through `authenticate()` and its current live database row. Local claims/revocations update hint state, successful authentication refreshes it, failure removes it; an externally revoked stale hint cannot grant access.

## Research: fetched 2026-10-04, concrete implications

- [Supabase range documentation](https://supabase.com/docs/reference/javascript/range) specifies inclusive offsets and warns ordering affects pagination. [Maintainer/community discussion #3765](https://github.com/orgs/supabase/discussions/3765) identifies the API row cap and pagination. Implication: increasing a caller `.limit()` cannot make authorization complete. Recovered store uses existing complete-read helper with deterministic `(decided_at,id)` and `(created_at,id)` ordering, live filters and direct grant lookup; real capped PostgREST-shaped tests verify newest grants and bindings remain visible and revocable.
- [PostgreSQL UUID input documentation](https://www.postgresql.org/docs/current/datatype-uuid.html) accepts braces, alternate hyphens and upper-case input while output is canonical. Implication: cast equality does not make journal string identities equal. Extend the existing one-spelling append-door helper to hub references and nested grant ids, preserving historical casts/rebuild.
- [MCP lifecycle specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle) exposes server implementation name/version at initialize. [Upstream issue #4575](https://github.com/modelcontextprotocol/servers/issues/4575) demonstrates serverInfo.version can drift when hardcoded. Implication: version gate must be tied to actual product implementation, not merely protocol version. Fabric Inbox origin/main `workers/mcp/handler.ts` imports package.json version; package 0.9.0 includes X-Fabric-Accounts narrowing and `workers/mcp/scope.ts` route-level enforcement. Fabric Inbox `origin/main` @ `90138c4aa17050f214b29fb5ad10aa9c6e86fb17` inspection confirms PROTOCOL_NAME `fabric-inbox`. Version is the connected product's self-report over its authenticated endpoint; it is compatibility evidence, not independent cryptographic proof of behavior. Unknown, malformed, older and 0.9.0 pre-release identities fail closed before tools/call. Checked on every call, so rollback is detected.
- [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628) treats device_code as authority to poll. Implication: a restored poll verifier must not survive as authority in a different estate. Null restored verifier and refuse post-restore decisions; preserve history instead of making source credentials usable in the target.

## Checks actually run

- `node --experimental-strip-types --test-force-exit apps/desktop/test/hub-products.test.mjs`: 39 passed, 0 failed ([receipt](core-resume-receipts/products-green.log)). Initial recovered run had 2 fixture failures: redirect/deadline tests omitted minimum narrowing version; fixtures corrected to exercise those paths against 0.9.0.
- `apps/desktop/node_modules/.bin/vitest run --root apps/desktop src/shared/access.test.ts`: 28 passed. Watched against committed old access.ts: 3 failed, 25 passed ([receipt](core-resume-receipts/access-watched-red.log)); restored code afterward.
- `node --experimental-strip-types apps/desktop/test/hub-access-refusals.test.mjs`: 2 passed ([receipt](core-resume-receipts/refusals-green.log)). Old DA-5 failed missing receipt; old ER-3 failed missing method ([receipts](core-resume-receipts/)).
- `node --experimental-strip-types apps/desktop/test/hub-authority-boundaries-db.test.mjs`: 6 groups passed on owned PostgreSQL17 with Supabase default privileges ([receipt](core-resume-receipts/boundaries-green.log)). Watched without migration: all 6 failed ([receipt](core-resume-receipts/boundaries-watched-red.log)). Two old-code failures are earlier existing checks rather than journal leak (missing binding/request); they still prove the new gate's exact refusal is absent.
- Old forwarder ER-6 watched regression: unsafe old server returned ok:true instead of false ([receipt](core-resume-receipts/forwarder-watched-red.log)).
- `node apps/desktop/test/run-hub-access-db.mjs`: hub-access schema 17 passed, door/real-store 18 passed, new boundary groups 6 passed; full chain on owned cluster ([receipt](core-resume-receipts/database-green.log)).
- `node apps/desktop/node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.node.json`: exit 0, no diagnostics.
- `node scripts/check-regions.mjs`: exit 0; 104 markers closed and every docs reference resolves.
- Upgrade rehearsal from 75 and 77 with existing saved estate data: NOT_RUN in this subtask; parent retains required release gate. Fresh migration-chain tests do not prove that release rehearsal.
- Full CI, fresh independent iteration 3, native/product acceptance and release: parent owns convergence; no claim made here.

## Exact next task

Parent integrates this branch's recovered commits and new commit, keeps its own vault implementation and surface agent's productConnect. Wire credential snapshot before transport opens, preserve narrowed test fixtures, run combined owned DB suites then full CI under the agreed lock. Update ADR/schema upgrade/scenarios/map/ledger under lease. Start independent iteration 3 against the exact converged candidate; ship only when those dispositions close.
