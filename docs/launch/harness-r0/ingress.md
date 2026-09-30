# HAR-R0-06 · Canonical persisted input

Status: **desktop journal, answer/import adapters and original-text preparation implemented; native acceptance and historical-data cleanup remain open.** [R0 entry](README.md), [checks](checks.md). Inspection baseline [`a58d4a8`](https://github.com/passioncode-ai/fabric/tree/a58d4a8); no real credential or live RPC was used as a fixture.

## One policy, several entry points

The policy must run before persistence and before any digest derived from the command's canonical text. It is separate from identity authorization. `apps/desktop/src/main/identity.ts#createIdentity` wraps person-actored journal appends but passes the payload unchanged. `apps/desktop/src/main/index.ts#bootstrap` calls `answer_question` and the import transaction directly. A journal-only wrapper cannot intercept those SQL functions' internal `append_event` calls.

1. Install a prepared-input journal adapter immediately after the journal is created inside `apps/desktop/src/main/index.ts#bootstrap`, before Policy or other consumers capture it. Preserve membership checks and original input objects.
2. Prepare the final answer composition, including selected-option label, before the answer RPC and before continuation. `apps/desktop/src/main/continuationDelivery.ts#createContinuationDelivery` must hash exactly the persisted canonical answer. No second, differently sanitized version for delivery.
3. Apply the same event policies to the import transaction's `p_events`; any refusal aborts the whole import. Preserve `apps/desktop/src/main/workspace.ts#previewImport` source-file digest semantics and the command identity derived in `apps/desktop/src/main/workspace.ts#commandIdForImport`. A canonical-event digest, if introduced, needs a separate name.

## Explicit schema policy

| Input | Free text to sanitize | Preserve validated values, or refuse sensitive authority |
|---|---|---|
| Task / idea | Original instruction before title truncation or title/note split | IDs, references, idempotency keys, option and preset enums |
| Note / brief | Body Markdown | Note/task IDs and section enum |
| Routine | Instruction | IDs, kind, interval, provider selection |
| Agent configuration | Display name, instructions | Runner/provider/server identifiers and permission mode |
| Project | Name, purpose | Project ID, repository path and backend/default-agent settings |
| Goal / memory | Title, claim | IDs, supersession and typed references |
| Question answer | Composed option label and user text | Question/command/project/option IDs and revision |
| Workspace import | Above project/agent text fields | Relationships, IDs, paths, enums and original source digest |

Field inventory: event producers in `apps/desktop/src/main/index.ts#bootstrap` for `task.created@1`, `note.added@1`, `brief.edited@1`, `routine.defined@1`, `agent.registered@1`, Project and Goal/Memory events; import events are built in `apps/desktop/src/main/workspace.ts#importWorkspace`. Exact event names/schema paths must be matched in the implementation packet before enabling a policy. Unknown events have an explicit `not_covered` result, never a silent assertion of whole-journal coverage.

Authority-bearing values such as paths/targets are **rejected** if recognizable secrets are embedded; silently rewriting them could redirect an operation. Existing precedent: `apps/desktop/src/shared/authorityIngress.ts#checkAuthorityTarget`. Valid IDs, revisions, digests and enums remain byte-identical. Unknown credential-configuration fields must not become accepted configuration just because their values were replaced with markers.

## Why preparation precedes formatting

Task title slicing in `apps/desktop/src/main/index.ts#startTask` and idea splitting in `apps/desktop/src/shared/idea.ts#readIdea` can divide a credential into fragments that no longer match a recognizer. Sanitize the original text first. The eventual journal adapter is an independent backstop, not a substitute for this ordering.

Repeated sanitation must be stable. Existing assignment redaction split its own `[redacted: assignment]` marker on whitespace, mutating text on every pass. Reviewed fix [`023eb2a`](https://github.com/passioncode-ai/fabric/commit/023eb2a4a7f034f1d70b987f1b9e9e4b4df942bc) preserves exact emitted markers and does not count no-op replacements as newly removed credentials. Lookalike prefixes and attached suffixes remain sanitized. Source and direct regressions: [redact.ts](../../../apps/desktop/src/shared/redact.ts), [redact.test.ts](../../../apps/desktop/src/shared/redact.test.ts). This repair does not wire ingress or prove historical data clean.

## Implementation and acceptance packets

1. Pure `commandIngress.ts`: explicit covered schemas, immutable prepared values, typed refusal with no offending value in diagnostics. Reject cycles, accessor properties, non-JSON values and size/depth overflow without invoking getters or `toJSON`. No ops-log clipping for a command: invalid input means zero effects.
2. Actual sink adapters: journal bootstrap order, answer RPC and import transaction; sanitized original task/idea text before formatting. Preserve identity/authority checks, idempotency and source-digest meaning. No database migration is implied by this policy.
3. Capture outgoing real adapter calls in fixtures. Synthetic credentials must be absent from task/note/brief/routine/agent payloads, composed answers and imports; answer delivery bytes and digest must match storage. One invalid import field produces no commit. Verify ordinary text, UUIDs, digest, `token_count`, refs and enum preservation.
4. Wire future CEO/voice/attachments to this prepared-input contract when their native commands exist. Current API does not expose all those surfaces; do not count a mockup as coverage. Historical cleanup and index invalidation remain a separate controlled operation.

Recognizers cover declared credential formats and contexts; they cannot guarantee discovery of an arbitrary unknown password. Preserve explicit omission metadata and fail closed on unsafe authority, without promising universal secret detection.

## Integrated desktop boundary · 2026-09-27

Reviewed pure policy [`994a7ba`](https://github.com/passioncode-ai/fabric/commit/994a7ba2f1a6707f291d7bc0c9a2c8ca3792e88a), erasable Node syntax correction [`012a381`](https://github.com/passioncode-ai/fabric/commit/012a3813ab72a749cb8ea6d07d5ca8482c1a6d7e), sink adapters [`eb46f03`](https://github.com/passioncode-ai/fabric/commit/eb46f03c931e7dc8300636086bb317a54e517f49), and desktop binding [`f314c67`](https://github.com/passioncode-ai/fabric/commit/f314c6747a5462c93d78ba12d8d35c8fb5fa1198) are integrated. Exact implementation owners:

- [commandIngress.ts](../../../apps/desktop/src/shared/commandIngress.ts): immutable bounded schema preparation; unknown names/versions are not covered. The exported event roster is tested against an exhaustive fixture map in [commandIngress.test.ts](../../../apps/desktop/src/shared/commandIngress.test.ts).
- [commandIngressAdapters.ts](../../../apps/desktop/src/main/commandIngressAdapters.ts): prepared Journal and transactional answer/import callers. Invalid input makes no call; response loss is uncertainty, never automatic retry. Error prose from a backend is not returned.
- [desktopIngress.ts](../../../apps/desktop/src/main/desktopIngress.ts): exact-version external-owner roster and original-before-format helpers. `apps/desktop/src/main/index.ts#bootstrap` wraps Journal before Policy, AgentSurface or PTY capture it; identity guarding remains independent. `apps/desktop/src/main/index.ts#startTask`, idea filing and `chainAdvance.ts#createChainAdvance` prepare originals before clipping, outbox and admission. Retrieval queries are cleaned before search and before journal clipping.
- `agentSurface.ts#appendRedacted`: validates covered originals before any generic rewrite, then lets the prepared Journal perform its single cleaning pass; fixture surfaces inject the same wrapper. This preserves measured removal counts. Explicit legacy events retain their former policy. Counts describe the pass that observed removal, not an invented aggregate of every earlier transformation.
- `workspace.ts#importWorkspace`: only known optional legacy fields become null before strict batch preparation. Source input digest and command ID still identify original files, not the cleaned event batch.
- `pty.ts#open`: recognizes sensitive cwd/runner/option/program references before bundle, capture or spawn. Refusal does not rewrite a path to a different launch target.

The covered field roster additionally includes task closing reason, retrieval query, repository attachment, routine pause/result, cycle summary and chain dispatch. Finalized context/transcript receipts are deliberately not recursively rewritten: their bytes and digests belong to their producer. Policy authority events retain `Policy.appendAuthority`; lifecycle and fixed relationship events have named external owners. This is explicit mixed coverage, **not a universal schema or secret-detection claim**. Unknown event versions refuse until classified.

Answer composition passes identical prepared bytes to `answer_question` and continuation. A repeated SQL receipt does not attest newly submitted text: its `canonicalAnswer` is null, it triggers no new continuation, and the app's absent commit sequence remains null instead of the string `undefined`. An import receipt must match Estate, command, original source digest and event count. Backup restore retains its separate archive-validation contract; it is not new-command preparation and is not silently rewritten.

Evidence: [17 captured adapter scenarios](../../../apps/desktop/test/command-ingress-adapters.test.mjs), [actual desktop Journal/chain composition](../../../apps/desktop/test/desktop-ingress.test.mjs), [zero-effect launch reference cases](../../../apps/desktop/test/pty-launch-failure.test.mjs), and independent review recorded in [checks](checks.md). These use synthetic secrets and owned fixtures, not a live database. Updated DB/MCP fixture wiring is not itself a run receipt.

HTTP/MCP transport preparation is now checked by the owned fixture below. Next: bind future CEO/voice/attachment commands to this same preparation. The isolated SQL and legacy compiler results below cover their narrower boundaries. No historical records or source files were rewritten. No mandatory release gate is closed by these helpers alone.

## Legacy context compilation and isolated SQL acceptance

Reviewed [compiler packet ec114db](https://github.com/passioncode-ai/fabric/commit/ec114dbff42759454b5423f87bab1982b6dced76) changes `apps/desktop/src/main/contextPack.ts#compileContextPack` to compiler revision 2. Whole rendered source values are cleaned before flattening, clipping, selection, budget accounting and hashing. Header fields, fact metadata, source display references, task text and transcript annotations are covered; backend prose becomes the fixed `source_read_failed` receipt. Citation identities and historical records remain unchanged. `apps/desktop/src/main/sessionBundle.ts#createBundleCompiler` cleans legacy agent instructions before joining them with the preamble, while preserving scoped transport credentials. It does not mutate already finalized context bytes after their digest was recorded.

[Seven offline composition checks](../../../apps/desktop/test/context-privacy.test.mjs) exercise the actual compiler → context file → execution packet → verified read path. A synthetic token crossing the old clipping boundary and a multiline PEM are removed before fragmentation; ordinary text, citation identity, immutable input and byte/digest parity are asserted. This closes the reproduced legacy-source compilation leak, not a universal historical-data cleansing claim.

Reviewed [SQL packet eff884a](https://github.com/passioncode-ai/fabric/commit/eff884a48645e117065358514aafea7902054fe8) provides `pnpm --filter @fabric/desktop test:ingress-db`. [Runner](../../../apps/desktop/test/run-command-ingress-db.mjs) owns a fresh PostgreSQL cluster, unique Unix socket and nonce; no caller database URL or TCP listener is used. [Acceptance](../../../apps/desktop/test/command-ingress-db.test.mjs) applies the real migration chain and calls the real prepared adapters against the SQL functions as `service_role`. It verifies sanitized projections, refusal before RPC, exact Unicode/path identity, stored answer/continuation parity, repeated-answer behavior, source-digest preservation and transactional import rollback after a later foreign-key failure. Cleanup is checked. This is SQL acceptance, not HTTP authentication, MCP transport or a native provider test. Missing PostgreSQL binaries exit 2 (`NOT_RUN`); the manual suite is separate from fast.


## Owned HTTP/MCP ingress acceptance · 2026-09-27

Reviewed [packet f5b5417](https://github.com/passioncode-ai/fabric/commit/f5b54170b0e949afec7b32152af447d61c3d1498)
repairs original-before-format preparation in
[agentSurface.ts](../../../apps/desktop/src/main/agentSurface.ts). Complete question
text and option labels are cleaned before normalizer caps. Secret-bearing `about`
keys, origins, handoff names, write scopes, option IDs, effect targets/actions and
ACK digests refuse before query or storage; they are never rewritten into different
identities. Covered memory provenance retains exact case and Unicode. Previously,
normalization could clip a credential into an unrecognizable prefix or remove its
separators before validation.

`node --experimental-strip-types apps/desktop/test/agent-http-ingress.test.mjs`
**PASS: 10 owned HTTP/MCP scenarios**, independently repeated in the integration
checkout. The [test](../../../apps/desktop/test/agent-http-ingress.test.mjs) uses the
actual AgentSurface HTTP listener and MCP SDK, a minted session token, prepared
Journal, fake query/RPC storage and an actual owned temporary ops sink. It checks
unminted-token refusal, zero-effect authority refusal, secret absence, optional
blank fields, ordinary receipts, exact references and repeated command identity.
It is registered in desktop and fast runners. This proves transport preparation;
SQL authority/concurrency, historical response cleansing and native provider
behavior have separate receipts. Recognizers still do not identify every unknown
secret. No real credentials, live database or external model were used.
