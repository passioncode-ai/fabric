# Plan to the first slice on a real provider — 2026-09-27

## Objective and entry point

Take R0 from "every first-slice step exists in source with local receipts" to "the first slice
— bundle → admission → delivery → ACK → observed Stop — is accepted on the real Codex and
Claude CLIs in a dedicated test Project", and make the CEO chat reachable behind its
activation gate on the way. The second slice and H09 stay outside this plan; they are listed in
[development.md](../../launch/harness-r0/development.md#ordered-next-packets).

Entry point for the next executor: the first open row of [Sequence](#sequence). One executor
works the packets in order, one branch per packet, committing and running the full
`bash scripts/ci.sh fast` before a packet lands on `main`.

## Decisions

| Decision | Choice | By |
|---|---|---|
| Horizon | up to the first slice on a real provider; second slice and H09 coarse only | operator, 2026-09-27 |
| Order | A1 (owner-private archive) first | operator |
| Execution | one executor, packets in sequence, no parallel member wave | operator |
| Codex topology | owned authenticated loopback backend — [ADR-0081](../../adr/0081-codex-execution-uses-an-owned-authenticated-loopback-backend.md) | operator |
| Registry in the app | measure the adapter inside Electron's own runtime (E0) rather than a separate Node supervisor | operator |
| Codec strictness | four defaults below, each overridable before A1-1 lands | executor; open to review |
| Migration 66 | lands in one change with schema admission 66–66 | forced: `scripts/build-manifest.mjs` requires the admitted maximum to equal the migration count |
| UI/UX first, in the house style | the whole UX chain and branded mockups for every surface this plan touches are done before A1; strictly the specified behaviour, nothing extra | operator, 2026-09-28 |
| Visual system | migrate the Fabric runtime and mockups to PassionCode 1.1.0 first (D0, the token part of CO-169) | operator, 2026-09-28 |
| Chat screen id | the chat overlay gets its own screen, SCR-64; SCR-44 stays Manager lifecycle | executor; resolves the id collision |
| Restore model | SCN-065 / FLW-36 / SCR-48 are refined in place to ADR-0079 (fresh Estate, atomic, no read-only activation) | executor; ADR-0079 is the later accepted decision |
| Flows | the chat gets FLW-57 and private export/import FLW-58, instead of appendices FLW-24 cannot project | executor |
| First-slice chat | the mockup shows "saved, no reply yet" and the other send states; simulated replies stay only as labelled target design | executor; the plan has no model dispatch |
| many/all context | refused visibly in the first slice | plan C4 |
| Native view vs execution | worked out now, not after B3/B4 | operator's UI-first order |

Codec defaults for A1-1, each against a finding in the preserved draft
(`archive/wip/ceo-private-archive-codec`):

1. **Drop the project-context rule.** The draft (`ceoPrivateArchive.ts`, line 120 of the tag)
   refuses a message in a project conversation unless its context is `mode:'one'` for that
   Project. Migration 64's `ceo_send_message` has no such rule and
   `apps/desktop/test/ceo-conversation-db.test.mjs` sends `mode:'none'` into a project
   conversation, so the draft would refuse real history.
2. **Companion sequence numbers are safe integers only.** Decimal strings stay allowed for the
   ordinary journal's `seq`, as ADR-0079 §6 says, and nowhere else.
3. **Non-canonical integer spellings (`1.0`, `1e0`) refuse** — the contract refuses ambiguity.
4. **One definition of depth and node budget, shared by JS and SQL**: the root is depth 1,
   and every value (not object keys) is a node. Frozen by vectors, not by prose.

## Requirements

| REQ | Requirement | Verified by |
|---|---|---|
| REQ-0 | The runtime and mockups use the PassionCode design system, vendored and gated | D0: `scripts/check-design.mjs`; both themes in the browser |
| REQ-1 | Owner-private history exports and imports, and an ordinary archive restores atomically into a fresh Estate owned through a control Estate; schema 66–66 admitted | A1-5: every `run-*-db.mjs` runner and the A1 SQL runner green on 66 |
| REQ-2 | Private export and import are reachable in the app with an honest UI, through scenarios → flows → screens | A1-6: vitest/RTL states, UX lint, native walkthrough in N1 |
| REQ-3 | The registry and the native view host are qualified inside Electron 44's own runtime | E0: the 17 registry groups and 14 view-host groups run in a real Electron main process |
| REQ-4 | The CEO chat is reachable in the app behind a closed activation gate, with every send state distinct | C0–C4 tests; C4 RTL states |
| REQ-5 | The chat is switched on — messages persist and show "saved, no reply yet"; no model dispatch | C5: activation check plus native cold restart |
| REQ-6 | Managed launch owns a backend process and classifies refused / started / unknown correctly | B1 tests against the real `createManagedLaunch` and registry |
| REQ-7 | Codex runs through the ADR-0081 loopback profile; Claude through owned stdio; both produce a validated `ProviderExecution` binding | B0, B2a, B2b |
| REQ-8 | A backend exit has its own Stop receipt; `terminal.closed@1` is never fabricated | B3 SQL and TS tests |
| REQ-9 | A native view attaches to the backend; view detach is not Stop | B4 |
| REQ-10 | The first slice is accepted on the real Codex and Claude CLIs in a dedicated test Project | N1 receipts |

## Sequence

| # | Packet | Implements | Needs | Status |
|---|---|---|---|---|
| 0a | [D0 · PassionCode design system](#d0--passioncode-design-system) | REQ-0 | — | done 2026-09-28 |
| 0b | [U1 · UX chain for every surface in this plan](#u1--ux-chain) | REQ-2, REQ-4, REQ-9 | D0 | done 2026-09-28 |
| 0c | [U2 · branded mockups of every state](#u2--branded-mockups) | REQ-2, REQ-4, REQ-9 | U1 | done 2026-09-28 |
| 0d | [U3 · UX audit and copy review](#u3--ux-audit-and-copy-review) | REQ-2, REQ-4, REQ-9 | U2 | done |
| 1 | [A1-1 · codec freeze](#a1-1--codec-freeze) | REQ-1 | U3 | done |
| 2 | [A1-2 · migration 66 base and privileges](#a1-2--migration-66-base-and-privileges) | REQ-1 | A1-1 | done |
| 3 | [A1-3 · verified restore wrapper](#a1-3--verified-restore-wrapper) | REQ-1 | A1-2 | done |
| 4 | [A1-4 · export, import, receipt](#a1-4--export-import-receipt) | REQ-1 | A1-3 | done |
| 5 | [A1-5 · admission 66 and inventories — lands on `main`](#a1-5--admission-66-and-inventories) | REQ-1 | A1-4 | done |
| 6 | [E0 · Electron runtime measurement](#e0--electron-runtime-measurement) | REQ-3 | — | done |
| 7 | [C0 · host-to-SQL receipt](#c0--host-to-sql-receipt) | REQ-4 | — | done |
| 8 | [C1 · main-side chat binding](#c1--main-side-chat-binding) | REQ-4 | C0 | done |
| 9 | [C2 · IPC, preload, registration, gate closed](#c2--ipc-preload-registration-gate-closed) | REQ-4 | C1, E0 | done |
| 10 | [C3 · history and cleanup discovery](#c3--history-and-cleanup-discovery) | REQ-4 | C2 | done |
| 11 | [C4 · UX chain and renderer entry](#c4--ux-chain-and-renderer-entry) | REQ-4 | C3 | done |
| 12 | [A1-6 · native private export and import](#a1-6--native-private-export-and-import) | REQ-2 | A1-5, C2 | done |
| 13 | [C5 · chat activation](#c5--chat-activation) | REQ-5 | A1-6, C4, E0 | done |
| 14 | [B0 · loopback profile and execution identity](#b0--loopback-profile-and-execution-identity) | REQ-7 | ADR-0081 | done |
| 15 | [B1 · launch receipt seam](#b1--launch-receipt-seam) | REQ-6 | E0 | done |
| 16 | [B2a · Claude over owned stdio](#b2a--claude-over-owned-stdio) | REQ-7 | B1 | done |
| 17 | [B2b · Codex over the loopback backend](#b2b--codex-over-the-loopback-backend) | REQ-7 | B0, B1 | done |
| 18 | [B3 · backend exit receipt and Stop](#b3--backend-exit-receipt-and-stop) | REQ-8 | B2a, B2b | done |
| 19 | [B4 · native view on the backend](#b4--native-view-on-the-backend) | REQ-9 | B3 | done |
| 20 | [N1 · first slice on real providers](#n1--first-slice-on-real-providers) | REQ-10 | all above; human steps | open |

REQ set-comparison: REQ-0…REQ-10 each appear in the `Implements` column; no packet implements
a REQ outside the table.

E0 and C0 have no dependency on A1 and are placed after it only by the operator's ordering.
E0 is a measurement that can invalidate every packet from C2 onward; if A1 stalls, run it next.

## Packets

### D0 · PassionCode design system

Done 2026-09-28. Tokens vendored from PassionCode 1.1.0 @ `6085d10` with a manifest; every
colour, focus, state, radius, font and motion role in `tokens.app.css` resolves to `--pc-*`;
mockups inline the same file; the gate rejects drift, raw or pack colours in mockups, undefined
variables and focus drawn without `--app-focus`. Receipts: [verification D0](../verification.md#d0--the-passioncode-design-system-in-the-fabric-runtime-and-mockups).
Found on the way: `--app-text` was undefined in three mockup stylesheets and silently fell back.

### U1 · UX chain

Through `super-ux`, ids from the next free set (SCN-097, FLW-57, SCR-64 as of 2026-09-28):

- **Chat:** SCR-64 "CEO conversation" with states loading, not activated, empty, saved locally,
  recovered, draft conflict, commit unknown → reconcile, offline, accepted pending ("saved, no
  reply yet"), refused with named reason, capacity full with inventory, local recovery required,
  denied (no content), unsupported context; FLW-57; SCN-042 states and keyboard (Enter,
  Shift+Enter, IME, Escape and minimise keep the draft); chat references repointed from SCR-44.
- **Private archive and restore:** SCN-065 / FLW-36 / SCR-48 refined to ADR-0079 (history
  restored, destination access verified, destination opened as three facts; active Estate chosen,
  restart); SCN-097 private export and import, FLW-58, SCR-65, with the codec reason codes.
- **Native view vs execution:** SCN-096 refined; SCR-25 and SCR-39 separate "view ended" from
  "execution ended", add view detached with execution continuing, backend lost (every view
  fenced), execution unknown; FLW-56 branch close view → execution continues → reattach; the
  refinement at `screens.md` that cites SCR-29 (the landing page) corrected.
- `product-model.json` screen, view and journey coverage; strings rows in `docs/brand/strings.md`.
- Gates: `docs/ux/lint.py`, `check-product-model`, `sync-product-ux --check`.

### U2 · branded mockups

Every new state drawn in `scripts/product` in the PassionCode style, one gold primary action per
task region; the chat's simulated replies replaced by the first-slice states; restore and private
archive in `operations.mjs`; view vs execution in the `session` view and `r0-work`. Wire the
unrun `chat-workspace.test.mjs` and `operator-workspace.test.mjs` into `ci.sh`, and repair the ten
browser suites that already fail on `main` (CO-171) so every mockup suite is green before U3. Rebuild
`product.html`, coverage and previews; review both themes in the browser.

**Done 2026-09-28.** U1: SCR-64/FLW-57/SCN-042 for the chat; SCN-065/FLW-36/SCR-48 refined to ADR-0079 and SCN-097/FLW-58/SCR-65 added; SCN-096/SCR-25/SCR-39/FLW-56 separate view from execution. U2: `ceo-conversation` and `private-history` views, the restore state machine and session states rewritten; empty first-release views gained a page heading and one primary action; the provider-accounts empty state is reachable again. All 15 mockup browser suites pass and run from `ci.sh` (CO-171 resolved). Receipts: [verification U1–U2](../verification.md#u1u2--ux-chain-and-branded-mockups-for-the-first-slice-surfaces).

### U3 · UX audit and copy review

`/ux-audit` of the new chain against the mockups; every new string through `copywriting` against
`docs/brand/voice.md` and `terminology.md`; findings fixed before A1-1 starts.

**Done 2026-09-28.** The state tables of SCR-64, SCR-65 and SCR-48 are now parsed by a test and
every row must be reachable in the mockup; that found SCR-48 without restoring, opening and error,
and SCR-65 treating someone else's history as a file refusal. The shared empty state no longer
stands in for the three screens; Restore is the primary action only after verification; one
reattach action has one name. Copy: Fabric instead of «CEO» and «первый срез», one name per
check, no dash before a conjunction (B062). Strings: [first-slice rows](../../brand/strings.md#first-slice--target-mockup-2026-09-28-u3).
Receipts: [verification U3](../verification.md#u3--ux-audit-and-copy-review-of-the-first-slice-screens).
NOT_RUN: a person reading the screens; the audit is the agent's reading against the spec, and it
is recorded as that.

Each packet: failing tests first, then the change, then its checks, then `ci.sh fast`. "NOT_RUN"
lists what the packet cannot prove and must not claim.

### A1-1 · codec freeze

- **Files:** restore `apps/desktop/src/main/archiveJson.ts` and `ceoPrivateArchive.ts` from
  `archive/wip/ceo-private-archive-codec`; apply the four codec defaults; one reason-code
  vocabulary shared with SQL (`invalid_json`, `too_large`, `invalid_archive`,
  `integrity_mismatch`, `unsupported_schema`, `archive_stale`, `idempotency_conflict`,
  `not_found`, `unavailable`). New `apps/desktop/test/ceo-private-archive-codec.test.mjs` and
  `apps/desktop/test/fixtures/ceo-private-archive/` (archive JSON plus expected canonical string
  and SHA-256), reused by A1-2.
- **Tests first — golden vectors:** empty archive; global conversation with null owner Project;
  project conversation with an open alias different from the canonical ID; question
  conversation; Cyrillic, CJK, astral emoji, U+2028, LF and CRLF inside text; A→B→C origin;
  project conversation with `mode:'none'` (must pass); ordinary digest for empty, one-line,
  many-line and decimal-string journals; the existing CeoSend vector from
  `ceo-conversation-db.test.mjs`.
- **Negatives, each with its frozen reason code:** duplicate keys, invalid UTF-8, BOM, lone
  surrogate, NUL; wrong row order, duplicate IDs or ordinals; invalid UUID; unsafe, negative or
  non-canonical numbers; missing ordinal, body or message; unknown field or subtype; depth and
  node budget exceeded; oversize; journal CRLF, blank row, missing final LF; truncation; edited
  bytes without recompute; wrong schema, source schema or preparation version; non-empty
  tombstones; foreign Person.
- **Verify:** the new test; `pnpm --dir apps/desktop typecheck`; a planted defect per rule
  class watched failing (R-006).
- **NOT_RUN:** SQL parity, any database, native files.

**Done 2026-09-28.** `archiveJson.ts` and `ceoPrivateArchive.ts` restored from the tag with the four
defaults and one shared reason-code list; seven companion vectors and four ordinary archives frozen
in `apps/desktop/test/fixtures/ceo-private-archive/`; 57 frozen refusals and vectors in
`ceo-private-archive-codec.test.mjs`, registered in `ci.sh` and the desktop `test` script. Seven
planted defects (each default reverted, the digest check skipped, the tombstone code) each failed
the test. Decisions as recorded in the [contract](../../launch/harness-r0/ceo-private-archive.md#native-codec--frozen-2026-09-28-a1-1).
Receipts: [verification A1-1](../verification.md#a1-1--codec-freeze-for-the-owner-private-archive).

### A1-2 · migration 66 base and privileges

**Landing (measured 2026-09-28):** A1-2 to A1-5 reach `main` together, on one branch. The first
file under `supabase/migrations/` numbered 66 makes `scripts/build-manifest.mjs` refuse until
`schemaContract.json` admits 66, and admitting 66 is A1-5; a partial landing would leave `ci.sh
fast` red on `main`.

- **Files:** `supabase/migrations/20260927000066_ceo_private_archive.sql` from
  `archive/wip/ceo-private-archive-sql`, plus a SQL canonical form and digest for the private
  archive, and `revoke` on **every** helper function. New `apps/desktop/test/run-ceo-private-archive-db.mjs`
  (owned cluster, the pattern of `run-restore-authority-db.mjs`, next free port 58467) and
  `ceo-private-archive-db.test.mjs`.
- **Tests first:** full chain to 66; A1-1 vectors give byte-identical canonical strings and
  digests in SQL; `has_function_privilege` is false for `anon`, `authenticated` and
  `service_role` on every helper. This test must fail on the draft as preserved: the draft
  revokes table privileges only, and `ceo_archive_journal` is `security definer`, so any role
  could read any Estate's journal.
- **Negatives:** the ordinary-journal corpus through SQL, each mapped to a fixed reason code
  with no body, digest or path in the error.
- **Reason codes:** the SQL draft refuses oversize as `archive_too_large`; A1-2 uses the codec's
  `too_large` and asserts SQL's codes against `ARCHIVE_REASON_CODES`.
- **NOT_RUN:** the other DB suites, which pin 65 until A1-5.

**Done 2026-09-28 on branch `codex/a1-archive-sql`** (lands with A1-5). Migration 66 carries the
draft's tables plus: one reason-code vocabulary raised by `ceo_archive_fail`, the codec's order and
codes for the ordinary archive (digest mismatch is `integrity_mismatch`, not the draft's
`invalid_archive`; a blank row is `invalid_archive`, not `archive_too_large`), NUL and lone
surrogates mapped to `invalid_json`, `ceo_private_archive_canonical` and `_digest` for the
companion, and a `revoke` on all 14 helpers. `ceo-private-archive-db.test.mjs` on an owned cluster
(`pnpm --dir apps/desktop test:archive-db`, port 58467): all seven A1-1 companion vectors are
byte-identical in SQL, the four ordinary archives and the original-bytes case pass, 13 journal and
9 companion refusals carry the codec's codes. Watched failing: the preserved draft (anon could
execute `ceo_archive_keys`), a dropped revoke, a missing tombstone frame, the draft's digest code,
and a depth-0 root.

### A1-3 · verified restore wrapper

- **Contract:** ADR-0079 §2–3 over the older contract text: trusted main derives the Person and
  the held control-Estate revision and mints the target UUID; SQL rechecks owner role and
  revision under a membership row lock, locks Estates in a fixed order, creates the target shell
  and same-Person ownership, records a `verified` boundary before projection, and checks the
  `CeoRestoredPrefix@1` fingerprint before commit.
- **Tests first:** the owner restores into a fresh target and resolves there as owner; the
  archived owner gets no membership, including after rebuild; a lost reply retried with the same
  operation ID returns the same receipt; changed input is `idempotency_conflict`; two concurrent
  identical requests produce one target; the legacy marker is never upgraded; the A0 suite stays
  green.
- **Negatives, each with before/after row snapshots showing zero mutation:** member-only caller;
  revision moved by a concurrent `change_membership`; missing Person; forged actor; existing
  target; source equals target; malformed input rolls back shell, membership, marker and receipt.
- **NOT_RUN:** active-Estate selection and restart (A1-6, N1).

**Done 2026-09-28 on branch `codex/a1-archive-sql`** (lands with A1-5). `restore_estate_verified`
in migration 66, over a body shared with the legacy entry point (`restore_estate_events`;
`restore_estate_internal` keeps migration 65's receipt shape). Locks: operation, then both
Estates by UUID; authority is read under `for update` on the control membership. The request
digest frames control, Person, target, operation, name and the manifest; revision and actor are
checked, not bound, so a retry at a moved revision still returns its receipt.
`restore-verified-db.test.mjs` (same owned cluster, its own database): six groups, including a
real concurrent `change_membership` and two concurrent identical requests. Watched failing: owner
suppression dropped, the row lock dropped, a landed `schema_rev` diverging from the archive
(prefix check), a request digest without the name, and the landing check removed.

### A1-4 · export, import, receipt

- **Files:** the same migration: receipt and provenance tables (import receipt must enforce a
  `verified` boundary — a mode column plus check), the three RPCs, `grant execute` to
  `service_role` only. Import also takes the global identity locks 6064/6164 in the order
  migration 64 uses them.
- **Timestamps** are exported and compared as SQL text at microsecond precision; no value passes
  through a JS `Date`.
- **Tests first,** with separate source, B and C databases inside one owned cluster (the
  `restore-disposable` pattern) and history written by the real `ceo_open_conversation` and
  `ceo_send_message`: SQL export decodes in JS; a concurrent send makes export `archive_stale`;
  two owners import in both orders and concurrently and cannot read each other; lost reply →
  receipt lookup → retry returns the original receipt; zero pending rows after import; a repeated
  historical send creates no pending row; A→B→C round trip; the journal carries no canary text.
- **Negatives:** edited, truncated, foreign, malformed, deep or oversize archive; wrong manifest
  or target; partial collision; a forced failure after the first insert rolls everything back; a
  raw append cannot forge a receipt; every refusal leaves zero mutation.
- **Decision recorded:** import takes `jsonb`, so duplicate keys are caught only by the codec
  before the call. Acceptable because trusted main always decodes first; stated in the contract.

**Done 2026-09-28 on branch `codex/a1-archive-sql`** (lands with A1-5). `ceo_export_private_archive`
(read-only, the supplied journal must equal this Estate's row for row, or `archive_stale` /
`integrity_mismatch`), `ceo_import_private_archive` (owner equality, digest, per-operation
idempotency, a verified boundary enforced by `restore_mode` in the receipt's foreign key, the
restored prefix unchanged, the codec's relation rules in `ceo_private_archive_validate`, journal
coverage both ways, subjects in the prefix, collision refusal under 6064/6164, then immutable
inserts only) and `ceo_private_import_receipt`. `private-history-db.test.mjs`: seven databases in
one owned cluster, six groups — export decoded by the native codec with the same digest; two owners
in both orders and concurrently; lost reply, receipt and retry; a repeated historical send with no
pending row; A→B→C; 14 refusals with zero rows, including a forced failure after the first insert.
Watched failing: a restored pending request, no export journal equality, no owner equality, no
prefix check on import, no per-message digests, no coverage check, an export without the Person
filter. SQL refuses a too-deep envelope as `invalid_archive` where the codec says `too_large`: the
companion reaches SQL as jsonb, after the codec.

### A1-5 · admission 66 and inventories

- **Files:** `apps/desktop/src/shared/schemaContract.json` → 66–66; the tests that pin 65
  (`ceo-conversation-db`, `ceo-conversation-service-db`, `ceo-host-sql`, `restore-authority-db`,
  `schema-readiness`); `scope.ts`, `storageContract.ts`, `archive.ts` and their tests, including
  an explicit test that both new tables are `excluded` — today an unknown table silently defaults
  to journal recovery; ADR-0079, `ceo-private-archive.md` (fix its stale "66/67" reservation line),
  `checks.md`, `development.md`, `restore-authority.md`.
- **Verify:** `pnpm --dir apps/desktop test`; `pnpm -r typecheck`; every
  `apps/desktop/test/run-*-db.mjs` and `run-ceo-host-sql.mjs`; the `packages/schema`
  restore-disposable and membership-roles tests against an owned cluster; `ci.sh fast`. Then
  land on `main`, publish the workspace.
- **NOT_RUN:** native UI, production database, capacity at the declared limits, signed package.

**Done 2026-09-28**, landing A1-2…A1-5 together. `schemaContract.json` 66–66; the private import
receipt and content provenance are private in `scope.ts`, not mirrored in `storageContract.ts`,
and `excluded` in `archive.ts`, with tests that failed before the entries existed. The four DB
suites and `schema-readiness.test.mjs` that pinned 65 read the contract instead. ADR-0079,
`ceo-private-archive.md` (the stale reservation line), `development.md` and `release-admission.md`
updated; runs in [checks](../../launch/harness-r0/checks.md#owner-private-archive-sql--2026-09-28).
NOT_RUN: 12 stack-backed desktop probes and `packages/schema` `planted` (local stack stopped, not
started), plus the packet's own NOT_RUN list.

### A1-6 · native private export and import

**UX-first half done in U1 (2026-09-28):** SCN-097, FLW-58 and SCR-65 now exist, with the mockup
(`private-history` view) and its state test; the line below is the packet as first written.


- **UX first:** no scenario, flow or screen exists for private export or import (SCN-065,
  FLW-36 and SCR-48 cover ordinary restore only). Add them through `/ux` before code.
- **Files:** a main-side file writer and reader (private directory, mode 0600, no path from the
  renderer), typed IPC channels, the restore flow with explicit active-Estate selection, UI.
- **Tests first:** refusal states render distinctly; a partial file is never offered; a restore
  never activates raw `backup.restore()` as a usable workspace; IPC refuses caller-supplied
  identity (`check-actor`).
- **NOT_RUN until N1:** a native walkthrough in the packaged app.

**Decomposed 2026-09-28**, because one packet would touch the archive files, the database commands,
the Estate every main-process module is bound to, and two screens at once:

- **A1-6a · private history service in main.** `apps/desktop/src/main/privateHistory.ts`: export
  (ordinary archive taken, `ceo_export_private_archive`, the codec's decode, `ceo-private.json`
  written 0600 by temp-and-rename beside it) and import (preflight and decode, a fresh target ID
  minted by main, `restore_estate_verified`, `ceo_import_private_archive`, and a lost reply resolved
  by the SAME operation IDs, which are written to an operation file before the first call). Tested
  on the owned cluster through a psql-backed RPC port: A→B, lost replies at each step, a partial
  file never offered, the operator's identity only from main.
  **A1-6a done 2026-09-28:** `privateHistory.ts` with `exportHistory`, `exports`, `inspect`,
  `restore` and `check`; `private-history-native-db.test.mjs` (owned cluster, the real `backup.take`,
  real migration 66): three private files or none, a lost restore reply and a lost import reply each
  resolved by the same operation with one target and one receipt, another Person's archive refused
  before any call. Watched failing: `check` minting a new restore, a partial directory left after a
  failed take or a refused export, no owner check, the operation not recorded before the first call.
- **A1-6b · the active Estate.** `ORG1` becomes the Estate recorded in a validated local file
  (default ORG1). Opening a restored Estate records it and restarts. An unreadable file is shown,
  never silently replaced by another Estate.
  **A1-6b done 2026-09-28:** `activeEstate.ts` reads and records `active-estate.json` (0600,
  temp-and-rename, read back after writing); main's `ORG1` constant is now `ACTIVE_ESTATE`, set at the
  start of `bootstrap()` before the database client exists; an unreadable choice stops startup as
  `active-estate-unreadable`, whose remedy says Fabric will not open another Estate in its place.
  `active-estate.test.mjs`, 6 groups. Watched failing: an unreadable file read as the default, and the
  startup stop removed. The restart that opens a recorded Estate is wired with its IPC in A1-6c.
- **A1-6c · IPC and screens.** Typed channels, SCR-65 and SCR-48 in the app, their RTL tests, and
  `check-actor` refusing caller-supplied identity.

  **A1-6c done 2026-09-28:** `history:*` channels and `FabricApi['history']`; main picks the archive
  folder in its own dialog and hands back a token, so no path crosses IPC; `history:open` records only
  an Estate `privateHistory.restored()` lists — a completed restore for the held Person, read from the
  operation files so it survives a restart — and then relaunches. `PrivateHistoryPanel.tsx`, opened
  from settings: SCR-65 (export, list, the not-encrypted note) and SCR-48 (Choose archive, the archive's
  summary, a name, Restore, the four result facts, Open this Estate or Stay here, Check again for an
  unknown result). 47 strings in en and ru. `PrivateHistoryPanel.test.tsx` (8) and a source check that
  `history:open` tests `restored()` before recording and recording before the restart. Watched
  failing: Check again restoring again, Restore without a name, an unreadable list shown as none, and an
  `history:open` accepting any id. FLW-58 leaves the unmeasured list. NOT_RUN: the running app.

### E0 · Electron runtime measurement

- **Measured already:** `ELECTRON_RUN_AS_NODE=1 apps/desktop/node_modules/.bin/electron -e
  'process.versions'` → Node `24.18.1`, Electron `44.0.0`, modules `149`. The registry refuses
  anything but Darwin and Node `26.8.2`, so today it cannot be constructed in the app.
- **Work:** run the registry's 17 groups inside a real Electron main process (not only
  `ELECTRON_RUN_AS_NODE`), and the native view host's 14 groups with node-pty rebuilt for ABI
  149; re-measure the private `stdin._handle.fd`, bigint `fstat().isSocket()`, nonblocking
  `writeSync` partial/EAGAIN and backpressure. Replace the version equality with an allowlist of
  measured tuples (Electron version, embedded Node, platform, arch, framework-binary SHA-256).
- **Stop condition:** if any descriptor behaviour differs, stop and bring the separate-supervisor
  alternative back to the operator; do not loosen the guard.
- **NOT_RUN:** the packaged, hardened app — N1.

**Done 2026-09-28.** Measured in a real Electron 44.0.0 main process (`process.type` `browser`,
Node 24.18.1, libuv 1.52.1, ABI 149) through `apps/desktop/test/electron-main-runner.mjs`: the
registry's 17 groups and the native view host's 14 pass, node-pty 1.1.0's N-API prebuild loads
without a rebuild, and no descriptor behaviour differs, so the stop condition did not fire. The
equality became `MEASURED_RUNTIMES` in `runtimeAdmission.ts` — kind, Electron, Node, libuv, ABI,
platform, arch and the SHA-256 of the code binary (Electron Framework; `libnode.147.dylib`, since
Homebrew's `node` is a 50 KB launcher). `runtime-admission.test.mjs` runs under both; Electron as
Node is refused and the registry will not construct there. `ci.sh fast` runs all three suites
under Node and inside Electron main. Watched failing: the hash dropped from the comparison,
`ELECTRON_RUN_AS_NODE` treated as main, and the registry guard removed.

### C0 · host-to-SQL receipt

Register `"test:ceo-host-sql": "node test/run-ceo-host-sql.mjs"` beside `test:ceo-db`, rerun it
on `main`, record it in `checks.md`, and correct the "SQL through HTTP is next" lines in
`development.md` and `checks.md`. The test's HTTP server is a fixture, not PostgREST; say so.

**Done 2026-09-28.** Registered as `test:ceo-host-sql`; 7 groups PASS on the 66 chain; `development.md` corrected in place and a dated [checks](../../launch/harness-r0/checks.md#host--http--sql-composition--2026-09-28) section supersedes the older "next" lines. The test's closing line now prints the admitted schema instead of a literal 65.

### C1 · main-side chat binding

- **File:** new `apps/desktop/src/main/ceoChatBinding.ts` and its test, no Electron import.
  One host per trusted owner; fixed key lists; any `estateId`, `personId`, `p_*`, `url` or
  `serviceKey` from the renderer refuses; one activation check
  (`{active:false, reason:'private_recovery_unavailable'}` until C5).
- **Bounded per-owner queue.** The host allows one identity check at a time and a concurrent
  call receives `null`, which the service turns into `authority_changed` — so a draft autosave
  during a send would fail with a false refusal. The queue removes that.
- **Tests first, with the real service and a fake RPC:** unknown method or extra field refuses
  with no effect; closed gate refuses every write with zero RPC calls while draft reads stay
  local; denied or revoked returns a uniform `unavailable` without content; stale draft is
  `draft_conflict` and the newer text survives; autosave plus send both settle; restart over the
  same files returns the frozen send and `reconcile` does not resend; a late reply after switching
  conversation is dropped.
- **Also closes [CO-172](../specs/2026-08-16-software-fabric-carryover.md):** reading an imported
  message validates it by migration 64's historical rules, never by re-preparing it; tested with a
  message whose text today's sanitizer would change.

**Done 2026-09-28.** `apps/desktop/src/main/ceoChatBinding.ts`: ten fixed methods with fixed key
lists; identity, RPC and credential names refuse at any depth; one activation check at the call and
again at the head of the queue; a bounded per-owner queue (32) answering `busy` past its bound;
`unavailable` for any missing, revoked or moved authority; `superseded` for a read that settles
after the operator left its conversation. `ceo-chat-binding.test.mjs` runs over the real service
with a fixture identity that keeps the host's one-check-at-a-time rule: 10 groups. CO-172 is closed
in the same change: `historicalCeoSend` and `historicalCeoSendCanonical` in
`shared/ceoConversation.ts` are the one definition the service's read and the archive codec share,
and `prepareCeoSend` is those rules plus today's preparation. Watched failing: no queue, no early
gate, no gate at the head, no forbidden-field scan, no uniform denial, no superseded drop, and the
read path before the CO-172 fix.

### C2 · IPC, preload, registration, gate closed

`ceo*` channels in `shared/types.ts` `IPC`, a `FabricApi['ceo']` namespace in the preload,
`handle(IPC.ceo…)` in `index.ts` with `Returns<…>` annotations, the host built after
`identity.establish()`. Checks: `check-ipc-contract`, `check-actor`, `check-ops`,
`preload-sandbox.test.mjs`, typecheck, a vitest that the closed gate refuses. NOT_RUN: real
PostgREST routing and JWT, TLS against the real backend.

**Done 2026-09-28.** `ceo:status`, `ceo:call` and `ceo:select` in `IPC`; `FabricApi['ceo']` with
`CeoChatStatus` and `CeoChatReply`, and `CEO_CHAT_METHOD_NAMES` as the one list the binding's table
is tested against; the preload namespace; `handle(IPC.ceo…)` with `Returns<…>` annotations. The host
is built after `identity.establish()` from the connection main already holds; one that cannot be
built leaves the chat `unavailable` and the app running (`ops.failed('ceo.chat.host')`). The gate is
the constant `CEO_CHAT_CLOSED`. `check-ipc-contract` (91 of 91), `check-actor`, `check-ops`,
`check-written-never-read`, `preload-sandbox.test.mjs` and typecheck pass; `src/shared/ceoChat.test.ts`
(vitest, 4) checks the method list, a closed gate that never reaches the service, a throwing
activation, and the gate line in `index.ts` — an opened gate there failed it. NOT_RUN as well: the
app itself, whose bootstrap would start the operator's local stack.

### C3 · history and cleanup discovery

Service-level `inventory()` over local drafts and send records: status, and whether each can be
forgotten, discarded or must be reconciled. Tests: full capacity (32 drafts, 8 unresolved sends)
lists every item; an unknown send refuses discard with `unresolved_send`; an unreadable namespace
is `local_recovery_required`, not empty; another Person's namespace is never listed. A
server-side conversation list needs a new RPC and migration; it is **not** in this plan — history
is local inventory, and the limit is stated in the UI.

**Done 2026-09-28.** `ceoConversationService.ts` `inventory()` and the binding's local, ungated
`inventory` method (added to `CEO_CHAT_METHOD_NAMES`): each draft with an 80-character preview and
`discard`, or no action and `blockedBy: 'unresolved_send'`; each send with `send` (saved),
`reconcile` (unknown) or `forget` (settled); capacity against 32 drafts and 8 unresolved sends.
`ceo-conversation-inventory.test.mjs`, 5 groups: full capacity lists every item, an unknown send
blocks discard and forget, an unreadable namespace is `local_recovery_required`, another Person's
namespace is never listed. Watched failing: a blocked draft offered for discard, an unreadable file
read as empty, an unknown send offered for forget.

### C4 · UX chain and renderer entry

- **UX first:** SCN-042 gains the missing states (saved not answered, unknown and reconcile,
  draft conflict, offline, recovered, capacity full, denied, not yet activated); FLW-24 gains a
  chat sub-flow with the capacity and cleanup branch; the chat overlay gets its own screen ID —
  today SCR-44 names both "Manager lifecycle" and the chat overlay.
- **Renderer:** overlay behind the gate; autosaving composer; history and New; every state from
  SCN-042 distinct; many/all context chips refuse visibly with `unsupported_context`.
- **Tests:** RTL per state; Enter, Shift+Enter, IME; Escape and minimise keep the draft.

**Done 2026-09-28.** The UX-first half was U1 (SCN-042, FLW-57, SCR-64). `CeoChat.tsx` in the app,
opened from its own floating Fabric avatar (the attention panel keeps its button; one side panel at a
time): header with scope, History and New, the conversation log, context chips (none or one active
project; "All projects" refused visibly), an autosaving composer (400 ms), per-send states, the kept
list at full capacity, and minimise. 49 strings in `en.ts` and `ru.ts`; four layout classes on
PassionCode tokens. `CeoChat.test.tsx`, 15 RTL tests: all fourteen SCR-64 states (the four send
states with the gate opened in the test only), Enter, Shift+Enter, IME, Escape. Watched failing: Send
enabled behind the closed gate, Enter during IME, Escape without saving, "All projects" applied,
Check again resending, an unreadable history shown as empty. `check-design`, brand lint (Mac added
to the entity names), UX lint, `sync-product-ux`, `check-product-model` pass.

### C5 · chat activation

Switch the gate only when all hold: schema 66–66 admitted (A1-5); private export and import
wired natively with a fresh-database restore proven (A1-6); the chat IPC qualified in a real
Electron run and a native cold restart passing (E0, C2); the UX chain updated (C4). Messages
persist and show "saved, no reply yet". Model dispatch, many/all context, typed outcomes and
voice stay outside this plan.

**Done 2026-09-28.** The operator's local database was migrated from 59 to 67 after a full
`pg_dump` and a rehearsal of migrations 60–67 on a restored copy of the same data (every one applied;
156 797 journal events kept) — [receipt](../../launch/harness-r0/checks.md#chat-activation-in-the-real-app--2026-09-28).
The gate now opens while private recovery is available (`index.ts` `ceoChatActivation`). The real app
run found two defects the fakes could not: the chat never opened a conversation on the server, so a
send could not succeed and an active chat read an unopened one as "no access"
(`CeoChat.tsx` now opens a new conversation before its first send and reads only known ones; four RTL
tests, each watched failing); and quitting hung, because the main window's `closed` handler read
`webContents` after it was destroyed and Electron's modal error box blocked the quit (the ids are now
read at creation, for every window). `chat-activation-native.test.mjs` then passed twice: the built app,
a fresh Estate founded for the local operator (never the operator's own), the message sent from the
composer, shown as saved with no reply yet, one acceptance in the journal and no message text in it,
and after a real quit and a cold start the same message read back and not resent. Watched failing: the
probe failed on the old renderer (no access) and on the old quit (the process never exited).

### B0 · loopback profile and execution identity

Proposal packet T1 plus the profile ADR-0081 requires: a new runtime profile in
`providerExecution.ts` for the loopback backend (validators refuse it under `owned-stdio`); the
durable separation of execution root, structured connection and view, with open, close and Stop
receipts specified. Tests: the new profile validates only with its own fields; an `owned-stdio`
claim for a loopback backend refuses; a view identity cannot bind as execution.

**Done 2026-09-28.** `owned-loopback` with its `backend` block (required there, refused elsewhere),
`view:*` connections refused as execution under every profile, and `providerLoopback.ts`'s execution
root fold for view, stop, lost and exit receipts — [as built](../../launch/harness-r0/provider-topology-proposal.md#t1--as-built--2026-09-28-first-slice-plan-b0).
`provider-loopback.test.mjs`, 8 groups; the existing provider, PTY, launch and stop suites pass
untouched. Watched failing: a backend block accepted under `owned-stdio`, a view binding as execution,
a view detach ending the run, and a stale-epoch receipt accepted.

### B1 · launch receipt seam

- **Plug-in points:** `ManagedLaunchDeps.prepare`/`open`, the failure classification in
  `createManagedLaunch`, and `get(sessionId)`.
- **Changes:** a process-agnostic `processStarted` failure in `launchFailure.ts`; a backend
  `open` adapter (`owned` → session; clean refusal with no child → not started;
  `outcome_unknown`, `run_already_consumed`, `run_identity_conflict` and a marker hit → **unknown**);
  a session-to-handle lookup that reports running only for an owned, live child. The registry's
  own snapshot reads `outcome_unknown` after a clean refusal, so classification uses the launch
  result, never the snapshot.
- **Tests first, real `createManagedLaunch` plus the registry's fault seam:** refusal before spawn
  → not started and `get()` null despite the marker file; hang past the deadline never spawns
  late; synchronous spawn throw → unknown and Stop called; capture failure → unknown with the child
  retained; root exit between owned and bind; lost bind reply; marker, capacity and filesystem
  faults; authority change before spawn; a new registry on the same root after a simulated crash
  classifies the old Run unknown; lost `fail_task_launch` reply never respawns.
- **Known gap, fixed in B3:** SQL cannot refuse a false "no process started" for a backend,
  because a backend spawn writes no process evidence it checks.

**Done 2026-09-28.** `launchFailure.ts#ProcessLaunchFailure` is the process-agnostic "a child may
exist" failure (`PtyLaunchFailure` is now its subclass) and `LaunchRefusedBeforeSpawn` the typed clean
refusal; `managedLaunch.ts` classifies by them before it consults `get()`. `backendLaunch.ts#createBackendLaunch`
is the `open` adapter and the session lookup; the registry now answers a marker hit as its own
`run_marker_present` instead of folding it into capacity. `backend-launch.test.mjs`, 12 groups on the actual
managed launch over the actual registry, under Node and inside Electron main; the existing launch, PTY and
registry suites pass. Watched failing: a marker or consumed Run read as not started, `get()` running for a
non-owned handle, a stale record overriding a typed refusal, `ProcessLaunchFailure` ignored, the marker
folded back into capacity, a Stop that signals nothing, and every non-owned result read as refused. The
known gap above stays open for B3.

### B2a · Claude over owned stdio

Join `claimStdio` to the Claude control transport; `onClosed` calls `connectionLost`; the
per-request fence reaches the registry's synchronous write edge. Tests (Node peer fixture under
the registry): a command fence revoked after the transport's check but before the write sends no
bytes — this fails today; timeout is unknown with no resend; backend exit mid-turn fences the
owner; partial write or EAGAIN is unknown; a second claim or a copied handle cannot reattach.

**Done 2026-09-28.** `claudeOwnedStdio.ts#joinOwnedClaudeControl` claims the pipes once and wires the
transport's `onClosed` to `connectionLost`. `claimStdio` now returns an `edge(fence, write)`: the
registry's write gate checks the request's own fence as its LAST callback, after the authority and
descriptor callbacks, and a fenced write sends no bytes and leaves the owner open (the refusal is the
command's). A write that does not reach the edge synchronously, or an edge re-entered from a fence,
fences the owner. `createClaudeControlTransport` takes the optional `edge`. `claude-owned-stdio.test.mjs`,
10 groups on a Node peer fixture under the actual registry, under Node and inside Electron main; the
fence test failed on the old code (1 byte written) before the edge existed. Watched failing: the edge
ignoring the fence, a fence refusal losing the owner, a non-boolean fence accepted, the transport
treating a fenced write as sent, `onClosed` not wired, the edge not passed, a partial write accepted,
and the fence checked before the other callbacks. The two re-entrancy guards cover the same case from
two sides: each removed alone passes, both removed fails.

### B2b · Codex over the loopback backend

The registry starts `codex app-server` on an authenticated loopback listener with a per-backend
token; the controller's frame-level fence runs at the socket write edge (ADR-0081 §3); an
`initialize` → `thread/start` → `turn/start` producer yields a validated binding. First step is
the no-model part, reusing `codex-loopback-native.test.mjs`; the turn itself belongs to N1.
Tests: absent and wrong token refused; a fence revoked between queue and write sends nothing;
foreign thread or missing turn fails binding validation; reconnect does not grant a new writer.

**Decomposed 2026-09-28** into three bounded steps, because the built-in `WebSocket` has no
synchronous write edge (`send()` is already a queue) and a pre-chosen port would hand the bearer
token to whatever process took it first:

- **B2b-1 · listener receipt and launch arguments.** The registry reads the backend's port only from
  a whole stderr line matching the configured non-global pattern, on the process it owns; a duplicate
  or malformed receipt fences the owner, a line over the bound is skipped whole, no stderr text is kept.
  Per-launch arguments (the token digest) are appended to the fixed recipe and never persisted.
- **B2b-2 · authenticated loopback client.** A bounded RFC 6455 client with the bearer header whose
  own queue is drained by a pump that checks each frame's fence immediately before `socket.write`;
  absent and wrong token refused; a fence revoked between queue and write sends nothing; reconnect
  grants no new writer.
- **B2b-3 · binding producer.** `initialize` → `thread/start` over that client, validated into an
  `owned-loopback` binding; a foreign thread or missing turn fails validation. The turn is N1.

**B2b-1 done 2026-09-28.** `listener(handle)` and the snapshot's `listenerPort` on
`ownedBackendProcessRegistry.ts#createOwnedBackendProcessRegistry`; `start(…, launch)` with
`BackendLaunchArgs`, refused as `invalid_launch_args` before any reservation; `backendLaunch.ts` passes
them through. `backend-listener.test.mjs`, 7 groups on a Node fixture serving real HTTP on
127.0.0.1, under Node and inside Electron main. Watched failing: a duplicate receipt ignored, a line's
length ignored, the port unvalidated, launch arguments dropped (in the registry and in the adapter),
malformed arguments accepted, a lost owner leaving waiters unresolved, a global pattern accepted, stderr
text in the snapshot, and a listener read after the owner was fenced.

**B2b-2 done 2026-09-28.** `loopbackWsClient.ts#connectLoopback`: a bounded RFC 6455 client over
`net.Socket` with the bearer token only in the upgrade header and the accept key checked; its own
queue is drained by one pump that checks each frame's fence immediately before `socket.write` and
waits for `drain`; backend requests are always refused; each connection is a new `controller:<uuid>`
writer and a closed client never reopens. `loopback-ws-client.test.mjs`, 13 groups against a real
WebSocket server on 127.0.0.1, under Node and inside Electron main. The suite found one real defect
while it was being written — bytes arriving with the handshake could be overtaken by the next chunk —
fixed and pinned by a test that failed 5 of 5 on the old code. Watched failing: the pump ignoring the
fence or backpressure, a 401 not read as unauthorized, the accept key unchecked, masked server frames
accepted, a foreign response accepted, a backend request approved, a written deadline claimed as not
sent, a reused writer identity, a ping unanswered, and no fence before queueing.

**B2b-3 done 2026-09-28.** `codexLoopback.ts`: `codexLoopbackRecipe` (the registry recipe — `codex
app-server` under `sandbox-exec`, binding and accepting on localhost only, writing only inside its
own private root, operator provider homes unreadable, the Codex binary's SHA-256 pinned),
`mintLoopbackToken` (only the digest reaches the process), `startCodexThread` (`initialize` answered
by the owned profile, `initialized`, `thread/start`, each under the caller's fence) and
`bindCodexLoopbackTurn` / `writerAllowed`. `codex-loopback.test.mjs`, 7 groups in CI; nine planted
defects watched failing. The manual probe `pnpm --dir apps/desktop test:codex-loopback-thread` ran
the whole chain on the installed `codex-cli 0.157.1` — [receipt](../../launch/harness-r0/checks.md#codex-thread-over-the-owned-loopback-backend--2026-09-28).
It measured one fact B3 must answer: **the backend starts a descendant in its own session**, so
after the backend exits its process group reads `unknown`, and a group-wide Stop does not reach that
process (it ended on its own in every run).

### B3 · backend exit receipt and Stop

- **SQL, next free migration slot at that time:** backend open and exit event types registered in
  `event_types` with feed sentences in `i18n/en.ts` and `ru-baseline.txt`, and in
  `EXTERNAL_INGRESS_OWNERS`; `record_task_run_stop_observation` accepts the backend exit event
  bound to owner, epoch and process identity as an alternative to `terminal.closed@1`;
  `fail_task_launch` counts backend open as process evidence (closes B1's gap).
- **TS:** a backend port for the native Stop runtime — observe via `inspect`, signal via
  `signalOwned`, an exit hook that triggers natural exit; one host identity shared with the
  registry (today it mints a second boot ID); numeric exit signals (today a string); a second fence
  level so input and delivery halt before the provider interrupt while Stop commands still pass.
- **Tests:** complete observation plus backend exit → stopped; missing event, a view's
  `terminal.closed` or a foreign owner → unknown; SIGTERM ignored → unknown; natural exit versus
  operator Stop race; observer hang → deadline; lost record reply retried with the same command ID.
- **Measured input (B2b-3):** `codex app-server` 0.157.1 starts a descendant in its own session; the
  registry reads the group as `unknown` after the backend exits. Stop must treat that as unknown,
  never as stopped, until that descendant's end is observed.

**Decomposed 2026-09-28:** **B3-1** is the SQL (migration 67) and **B3-2** the TS backend port for the
native Stop runtime, which writes the two receipts.

**B3-1 done 2026-09-28.** Migration `20260928000067_backend_exit_receipt.sql`: `backend.opened@1` and
`backend.exited@1` in `event_types` with feed sentences in `en.ts` and `ru.ts` and owners in
`desktopIngress.ts#EXTERNAL_INGRESS_OWNERS`; `backend_exit_evidence` finds the latest trusted open after
admission and an exit with its exact owner, epoch, process, host and boot; `record_task_run_stop_observation`
accepts that exit instead of `terminal.closed@1` only with a quiescent group and an observation naming the
same process, host and boot, and never reads a view's `terminal.closed@1` for a backend session;
`fail_task_launch` counts either receipt as process evidence (B1's gap closed). Schema 67 is qualified as a
private-archive source (ADR-0079 decision 5) and the runtime contract is 67–67. Slot 67 had been
reserved for pipeline persistence; the unexecuted reservation moves to 68/69 by the
[persistence contract](task-pipeline-persistence-contract.md)'s ordering rule. `backend-stop-db.test.mjs`,
9 groups via `pnpm --dir apps/desktop test:stop-db` on the full chain, with every other owned-cluster DB
runner passing on it. Watched failing: an unknown group accepted, a view's `terminal.closed` read as the
exit, a foreign owner accepted, the backend not counted as process evidence, the process reference
unchecked, an agent-written exit or open accepted, the helper granted out, an export mislabelling its
schema, any source schema accepted, and the codec accepting 68 or refusing 67.

**B3-2 done 2026-09-28.** `backendStopPort.ts#createBackendStopPort` is the owned backend in the PTY
port's shape for `nativeStopRuntime.ts`: it writes `backend.opened@1` from the registry's own
snapshot and `backend.exited@1` once per observed group state, with a numeric exit signal; `haltInput`
closes `inputAllowed` while `commandAllowed` stays open for Stop until the owner is gone; a registry
built with another host identity is refused. The registry takes the Stop runtime's host identity
(`host`) and an exit hook (`onExit`) that main turns into natural exit; the runtime takes a port's own
process reference. The B2b-3 finding is closed at its source: `codexLoopbackRecipe` writes
`[features] shell_snapshot = false` into the owned profile, and on `codex-cli 0.157.1` the backend's
group is then `quiescent` with no descendant outside it (three runs, and Electron main) — the snapshot
shell was the only escape. `backend-stop-native-db.test.mjs`, 7 groups end to end — the actual
registry and a Node backend, the port's receipts through `append_event`, managed Stop settling in
SQL — via `test:stop-db`. Watched failing: an exit receipt claiming quiescence, `haltInput` doing
nothing, Stop commands halted with input, a host mismatch accepted, a string exit signal, the port's
process reference ignored, an exit receipt written every sample, the registry ignoring the shared
host, the snapshot left on, the exit hook never firing and a handle mapping to no session.

### B4 · native view on the backend

Map the registry snapshot and the provider connection epoch into `NativeViewOwner`; backend loss
fences every view; a stale ticket cannot touch a newer backend; detach is not Stop; Stop disables
input from every view; unknown closure stays unknown. Runs in Electron with the ABI-149 node-pty.

**Done 2026-09-28.** `backendView.ts#createBackendViewAuthority` is the view host's `currentOwner`: the
registry's snapshot (still `owned`, its owner, host, boot and process reference), the controller
connection's epoch (open, its `connectionId`), the held authority and Stop's input fence make one
`NativeViewOwner`, and anything missing or changed is `null`, which fences every view of that owner.
`codexViewRecipe` is the native TUI on that backend — `codex resume <thread> --remote ws://127.0.0.1:<port>
--remote-auth-token-env FABRIC_VIEW_TOKEN`, the binary pinned, the token only in that variable, a private
view profile. `backend-view.test.mjs`, 8 groups with the actual registry, Stop port and native view host in
node-pty, under Node and inside Electron main (node-pty 1.1.0, ABI 149). Watched failing: Stop leaving view
input open, a lost backend still owning views, a closed connection owning views, an owner id not the
backend's, the token in argv and an unpinned view binary; dropping the authority check is equivalent code
(the null read fails closed the same way). NOT_RUN: the native Codex TUI attached to this backend (N1).

### N1 · first slice on real providers

In a dedicated test Project, on the exact source SHA, for Codex and Claude separately: launch,
delivery with ACK by digest, operator Stop, natural exit, crash and restart, stale command,
SIGTERM ignored, child survives, double Stop — the HAR-R0-04 matrix — plus ADR-0081's gates
(a)–(e) for Codex and the provider capability matrix rows each packet claims. Publish only the
capabilities measured; `NOT_RUN` stays `NOT_RUN`.

**Measured 2026-09-28, before any N1 run.** Both providers need a login in a profile Fabric owns;
neither can borrow the operator's:

- **Claude Code 2.1.284** in a private `CLAUDE_CONFIG_DIR` answers its first turn with
  `Not logged in · Please run /login` (`apiKeySource: none`): its credential is bound to the config
  directory, not only to the OS user. Running in `~/.claude` would put canary sessions into the
  operator's own history, which this plan forbids.
- **Codex** runs its backend in the owned profile `codexLoopbackRecipe` writes, empty of any login;
  the sandbox also forbids every outbound connection, so a model turn needs an explicit allowance
  (outbound TCP to 443 only) in the recipe — engineering for N1, not a human step.

**Corrected 2026-09-29 — the logins were on the machine; the first attempt looked in the wrong
place.** The operator runs claude-swap with several Claude accounts and one Codex login:

- **Claude:** `cswap run <account>` keeps a persistent per-account profile under
  `~/.claude-swap-backup/sessions/`, seeded with that account's credential, sharing settings and skills
  by link and no conversation history. Account 8 (most headroom) now has one; a stream-json turn in it
  answered `OK` and exited 0. The canary uses that profile with `--setting-sources ''` and
  `--strict-mcp-config`, so the operator's hooks and MCP servers do not run in it.
- **Codex:** one ChatGPT login in `~/.codex/auth.json`. It is never copied (refresh-token rotation would
  log one copy out): `codexLoopbackRecipe`'s `modelAccess` links it into the owned profile and lets the
  sandbox read and write that one file, TCP to 443 and the mDNSResponder socket (DNS; without it the
  backend reports `workspace routing discovery failed`). A real turn through the registry, the loopback
  client and `startCodexThread` was accepted, `turn/started` and `turn/completed` named the same turn and
  thread, and the backend's group quiesced after Stop — but the turn **failed with `usageLimitExceeded`**:
  that Codex account is out of usage until 2026-10-03 19:15. Codex model turns wait for it (or another
  Codex login); nothing else in N1 does.

The test Project is `~/DATA/_canary/fabric-n1/project` (an empty git repository); the Codex scope is
`~/DATA/_canary/fabric-n1/codex-scope`.

## Human steps

These need the operator and cannot be done by the executor:

1. **Before N1's Codex model turns:** the Codex login is out of usage until 2026-10-03 19:15 —
   wait, add credits, or name another Codex login. Claude needs nothing: claude-swap account 8's
   profile is used. Fabric never copies the operator's private profile into fixtures.
2. **Before C5 and A1-6 land:** review of the new scenario, flow and screen entries.
3. **Any time:** override a codec default in [Decisions](#decisions) before A1-1 lands.

## Risks

| Risk | Where it bites | Response |
|---|---|---|
| Electron's runtime changes descriptor behaviour | E0, then everything wired into the app | stop and return the supervisor alternative to the operator |
| The loopback listener cannot meet ADR-0081 gates (a)–(e) | B2b, N1 | the ADR's stop condition: a reviewed gateway packet |
| Migration 66 cannot land in pieces | A1-2…A1-5 on one branch for several packets | keep the branch rebased on `main`; land only at A1-5 |
| A second parallel wave leaves work uncommitted | any | one executor; R-008 before any cleanup |
