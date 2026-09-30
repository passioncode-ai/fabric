# Дополнение: provider accounts · 2026-09-09

База `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d` → design commit `25026daef6dc1829581ca9fe1f68495761dfd1cf` (`codex/provider-accounts-design-20260909`). Только чтение git objects и чистый fixture renderer. Runtime-файлы `apps/`/`packages/` в diff не менялись. **Ни одна найденная ранее runtime-недоработка не закрыта.**

Новые сущности: SCN-081–087; FLW-50–52; SCR-62–63; **M199 / CO-112**, уже разложенные на PA-01–06. Новый ADR — **0051, proposed**, не 0063. Контракт прямо обозначен как proposed/no runtime acceptance.

## Сценарии

- **SCN-081**: runtime **BLOCKED**, design **PARTIAL**. Official staging/identity/duplicate/cancel lifecycle specified. Fixture implements only example completion/cancel; expiry, duplicate verified subject, identity mismatch and reauthentication cases are not modelled. Owner M199 / CO-112 / PA-01/PA-02. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/ux/scenarios.md:1904`; fixture line 29.

- **SCN-082**: runtime **BLOCKED**, design **PARTIAL**. New admission account/revision is pinned by contract; default fixture changes without switching current conversation. No launch is executed by fixture. Owner M199 / CO-112 / PA-01/PA-03. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/ux/scenarios.md:1921`; fixture line 62.

- **SCN-083**: runtime **BLOCKED**, design **PARTIAL**. Native conversation/open Task stable, Session and TaskRun new; certified boundary/native ack mandatory. Fixture changes counters only; no eligible-target empty state is missing and an active prepare button becomes no-op. Owner M199 / CO-112 / PA-03/PA-04. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/ux/scenarios.md:1938`; fixture line 34.

- **SCN-084**: runtime **BLOCKED**, design **PARTIAL**. Contract distinguishes waiting, stopping and unknown effect. Fixture covers wait/cancel and simulated boundary; no certified boundary or external effect result exists. Owner M199 / CO-112 / PA-04. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/ux/scenarios.md:1955`; fixture line 41.

- **SCN-085**: runtime **BLOCKED**, design **PARTIAL**. Persisted operation, crash reconciliation and old-writer absence specified. Fixture failed/restore/unknown controls exercise display only; restart loses the in-memory operation and cannot prove durable recovery. Owner M199 / CO-112 / PA-04/PA-06. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/ux/scenarios.md:1972`; fixture line 70.

- **SCN-086**: runtime **BLOCKED**, design **PARTIAL**. Quota is keyed by identity/runtime/auth revision in contract; unknown not zero. Fixture covers in-use/default delete refusal. Reauthenticate specific existing account and deletion of final eligible switch target need explicit flow coverage. Owner M199 / CO-112 / PA-01/PA-05. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/ux/scenarios.md:1989`; fixture line 30.

- **SCN-087**: runtime **BLOCKED**, design **PARTIAL**. Unsupported resume, denied and wrong-project fixture paths exist; actual post-prepare revocation/old callback fencing/native provider constraints remain implementation gates. Owner M199 / CO-112 / PA-02/PA-04/PA-06. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/ux/scenarios.md:2006`; fixture line 23.

## Что уточняет прежний план

- **UX28-02 / M102 / S14** — Read identity expands for quota to provider+verified subject/org+account+runtime+auth revision. Account-blind cache/backoff is PA-05, while generic renderer read lifecycle remains UX28-02. Do not duplicate the quota fix under M102. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/architecture/provider-accounts.md:38`.

- **UX28-05 / M145 + S02** — Harness must separately display provider account identity, declared provider capability and Fabric authority. Provider login does not satisfy membership/grants. S09 membership floor alone is insufficient trusted login. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/architecture/provider-accounts.md:31`.

- **UX28-07 / M191** — Context-pack inspection or transcript bytes are not native conversation continuity. Fallback context handoff is a new conversation; keep M191 compiler and M199 native resume contracts distinct. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/architecture/provider-accounts.md:16`.

- **UX28-11 / project settings** — Default precedence becomes explicit run choice → project binding → provider default → system default; settings changes affect future admissions, never silently rebind active conversation. Existing atomic-settings defect remains. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/architecture/provider-accounts.md:62`.

- **UX28-12 / M169 + M194** — Same-provider account switching is M199. Cross-provider handoff remains M169; manager binding must refer to an account choice without treating login as authority. No automatic quota rotation in first slice. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/adr/0051-provider-accounts-and-conversation-continuity.md:15`.

- **UX28-13 / M71 sessions** — Selected agent/session view must preserve stable conversation + open Task while new Session/TaskRun generation is created; late events fenced by generation and binding revision. Do not reuse dead PTY id to simulate continuity. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/architecture/provider-accounts.md:35`.

- **UX28-14 / verification** — Add separately authorized live A→B→A, same native conversation marker/tool history, account identity, unrelated conversation unchanged, no effect replay. Scope by exact CLI/OS/runtime; two approved test accounts required. Fixture 1440/375 screenshots cannot satisfy this. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/architecture/provider-accounts.md:170`.

- **UX28-15 / evidence and scope** — Add SCN081–087/SCR62–63/FLW50–52 and proposed ADR0051/M199/CO112 as future scope. Keep original 22-scenario source snapshot and existing unresolved verdicts; no broad baseline recount without explicit delta. Source `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/evidence/plans/2026-09-09-provider-accounts.md:17`.

## Дельта-пакеты

### ADD-PA-01 — M199 / CO-112; reuse existing PA-01..PA-06 rather than new milestone

P2 planned capability, after its actual prerequisites. Keep the six already bounded account packets. First a read-only PA-02 feasibility spike; then reviewed schema PA-01/PA-02 implementation. Account selection/usage may ship with continuity explicitly unsupported; no automatic advancement ahead of the existing integrity queue.

Контекст: `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/architecture/provider-accounts.md:27`; `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/evidence/plans/2026-09-09-provider-accounts.md:50`; `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/adr/0051-provider-accounts-and-conversation-continuity.md:3`

1. Review proposed ADR0051 and certify provider/runtime identity, isolated auth and compatible refresh ownership before accepting support. Record explicit unsupported/unverified rather than inferred support.

2. PA-01 local principal/device/runtime account IDs, secret references, staged verified login, revisions and dependent deletion; no secret in Git/IPC read models/journal.

3. PA-02 contract/adapter ports + PA-03 admission: immutable resolved identity, ConversationBinding, account revision, new TaskRun, generation fencing. Contract repo baseline 1eeb5a302518a25af4c3ef82f1942aa3288bc9b9; adapter baseline 5d2ccd7a124d7052f743529d8dcf0caf294bfdfd are source-plan references, not inspected here.

4. PA-04 durable SwitchOperation: checkpoint, no unresolved effect, stop/fence receipt, spawn intent before spawn, identity AND native-conversation ack, CAS commit; reconcile unknown using same operation ID.

5. PA-05 account-scope quota/cache/backoff and account UI; merge generic reader mechanics with UX28-02, keep account producer under PA-05.

6. PA-06 separately authorized native acceptance for each certified provider/version/runtime with two test accounts, isolated test workspace and redacted receipts.

Зависимости: Trusted application principal beyond S09 floor; M188 frozen TaskRun/admission; S03 outcome reconciliation; Relevant S12 recovery primitives, not wholesale backup completion; Provider-specific version/runtime capability receipts

Positive: Default B leaves existing A conversations unchanged. Explicit certified A→B→A keeps native conversation/open Task, new Session/TaskRun each activation, old effects never replayed.

Negative: Wrong subject/org/runtime/workspace, revoked actor after prepare, unknown old writer/effect, late old-generation callback and duplicate operation never launch/commit target. Cancelled/expired/duplicate login cannot replace unrelated login; revoked/default/in-use deletion preserves history. Quota A never appears under B; auth revision change invalidates cache/backoff; unknown quota never becomes zero.

Исключения: No global credential swap, copying rotating tokens into session homes, undocumented-TUI parsing, automatic quota account rotation or universal cross-provider resume. No real login, provider auth mutation, native launch or paid call authorized by this audit addendum.

### ADD-PA-02 — M199 / PA-05 fixture refinement + PA-06 acceptance contract

P2 before implementing account UI from the mockup. Complete the user-visible no-target and reauthentication paths so implementers do not copy dead controls or treat all login as adding a new identity. Extend scenario state tables and failure examples; do not claim these refinements implement runtime auth.

Контекст: `25026daef6dc1829581ca9fe1f68495761dfd1cf:scripts/product/provider-accounts.mjs:34`; `25026daef6dc1829581ca9fe1f68495761dfd1cf:scripts/product/provider-accounts.mjs:43`; `25026daef6dc1829581ca9fe1f68495761dfd1cf:scripts/product/provider-accounts.mjs:67`; `25026daef6dc1829581ca9fe1f68495761dfd1cf:scripts/test/product-provider-accounts.browser.cjs:29`

1. Add no eligible alternate account state after deleting B while current and other conversation remain on A. Replace empty selector/active prepare with reason and Add account action, preserving draft/current conversation.

2. Model reauthenticate(accountId, expected identity) separately from add account; mismatch must not silently replace account identity or pollute cached usage.

3. Add expired/cancelled/duplicate-subject login and stale-revision/default/dependency removal examples; state exactly what is preserved.

4. Extend fixture tests for empty candidate set, reauth same account versus identity mismatch, account deletion while switch pending and keyboard focus after rerender.

5. Keep generic scenario UI elements specialized: account list vs switch phases vs recovery receipt; list loading/empty/error/unknown/revoked explicitly.

Зависимости: Existing SCN081–087 and FLW50–52; no native adapter required for bounded design-state refinement

Positive: After removing last alternate account the screen offers a useful Add account action and keeps A, draft and history; reauth same verified subject updates auth revision in fixture.

Negative: Zero targets cannot render an apparently active no-op prepare button; mismatch cannot become successful existing-account login; denied paths must not expose identity/history.

Исключения: Only design fixture/UI-state work; fixture assertions cannot establish native identity, checkpoint safety or provider isolation.

### ADD-PA-03 — Parent audit publication / evidence-docs; no new product milestone

P2 integration correctness. Integrate account design as an explicit later delta. Preserve the original queue report used to formulate this audit and avoid replacing historical exposure counts with a mixed-revision total.

Контекст: `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:docs/reports/2026-09-09-queue-progress-report.html:1`; `25026daef6dc1829581ca9fe1f68495761dfd1cf:docs/evidence/backlog.md:526`

1. Pin original queue report at baseline and retain a tracked audit-input snapshot/commit link even though provider branch deletes the file.

2. Register new seven draft scenarios and one proposed milestone/carryover in delta inventory; inherited verdicts remain bound to baseline.

3. Use M199/CO112 and PA01..06 as canonical owners, not duplicate audit milestones.

4. Retain ADR0051 proposed; integration/publication does not constitute domain approval or runtime acceptance.

Зависимости: Parent report source pin/index

Positive: Fresh checkout resolves original source report and new account design through exact commit links; both baselines labelled.

Negative: Merged report deletion cannot erase audit input; 7 design scenarios cannot inflate runtime delivery count; no reference to nonexistent ADR0063.

Исключения: Do not absorb provider design into runtime baseline implicitly; no production dependency pin changes.

## Проверки и пределы

- git rev-parse 25026daef6dc → 25026daef6dc1829581ca9fe1f68495761dfd1cf

- git diff --name-only d28c321 25026da -- apps packages → empty

- Read exact git objects for scenarios, ADR0051, provider contract, fixture, existing PA packets and browser test source.

- No existing browser tests or live-provider tests rerun; published previous fixture checks remain historical evidence.

Pure fixture probe: eligibleTargetCount 0; target empty; emptySelect true; prepareButtonOffered true. Handler line67 requires a.selected, therefore control has no effect. Лог `provider-fixture-gap.log`. Это defect target-макета, не выполняющего auth/network/IPC; никакого нативного сбоя эта проба не доказывает.

- No provider source/API facts independently verified; proposal contents evaluated against own declared contracts.

- No native implementation exists in delta; all runtime scenario verdicts BLOCKED pending implementation and observation.

- No repository edits, branch changes or agent/runtime interference.
