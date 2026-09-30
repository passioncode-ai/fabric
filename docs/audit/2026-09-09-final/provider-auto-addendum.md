# Дополнение: automatic provider switching · 2026-09-09

Исходная runtime-база `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d` неизменна. Предыдущая дельта `25026daef6dc1829581ca9fe1f68495761dfd1cf` → новая design-дельта **`8a0e9dbc17ac251e543b26653f64540a24ff0a8a`**. В `apps/`, `packages/`, `supabase/` изменений нет. 80 сценариев исходного аудита не пересчитаны; новые SCN081–089 — отдельное расширение. Ни один runtime-дефект исходного аудита этой дельтой не исправлен.

## Изменившееся решение

**Scope reversal**: Auto is now operator-required opt-in capability. ADR0052 overrides only no-automatic-rotation clause of ADR0051; old record remains immutable. Requirement accepted; detailed policy/defaults still proposed. Источник `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/adr/0052-provider-account-automatic-switching.md:3`.

**Enrollment authorization**: Explicit pool/provider/runtime/project scope + existing-conversation enrollment permits eligible later switches without per-switch reconfirmation. Defaults do not silently enroll existing conversations; manual pin opts out. Источник `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/adr/0052-provider-account-automatic-switching.md:10`.

**Authority/identity**: Provider account is not a Fabric grant. Recheck actor/membership, account identity, policy/binding/auth revisions and candidate scope/headroom before stop and commit. Unknown identity/usage/resume/effect holds; expired token follows coordinated refresh first. Источник `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/provider-accounts.md:197`.

**Quotas/strategies**: best uses max relevant account/model utilization; consume-first can move below threshold for earlier verified weekly reset + sufficient headroom. Missing windows are not zero. Ties prefer staying; typed quota exhaustion differs from 429/5xx/network/auth. Источник `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/provider-accounts.md:196`.

**Proposed finite controls**: 90% used threshold, 60s polling, 300s cooldown, 10pp hysteresis, 12/hour proposed ceiling (3600/300); enclosing budget/deadline/attempts survive account/TaskRun change. Billed/API-key accounts excluded absent explicit bounded allowance. Источник `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/provider-accounts.md:189`.

**Crash/pause**: Persist dedup intent, cooldown/quarantine/pending operation/backoff; tick lease prevents duplicate dispatch; unknown stop reconciles same ID. Pause before stop cancels intent; after stop recovery only. App shutdown stops polling, restart reconciles first; no implied daemon. Источник `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/provider-accounts.md:210`.

## Новые сценарии

**SCN-088** — runtime **BLOCKED**, design **PARTIAL**. Opt-in enrollment, best/consume-first, no repeat confirmation and same coordinator are specified. Fixture demonstrates a no-confirmation counter transition, not native account/identity/budget preservation; full account pool/policy revisions and editable thresholds are future M199.ui/auto. Источник `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/ux/scenarios.md:2025`. Owners: M199.auto, M199.resume, M199.ui, M199.acceptance

**SCN-089** — runtime **BLOCKED**, design **FAIL**. Pure fixture reproduction contradicts hold semantics: queued switch B + unknown observation still commits B at boundary; deleting queued B allows boundary commit with empty account ID. Ordinary exclude/pause paths cancel queue, but these invalidations do not. Источник `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/ux/scenarios.md:2042`. Owners: M199.auto, M199.accounts, M199.resume, M199.ui, M199.acceptance

## Каталог и исполнение

Существующие девять дочерних ID и зависимости сверены с execution_nodes (9/9 совпали). M199 — агрегат завершения, не десятый исполнитель. Первый шаг — M199.probe.

- **M199.probe** ← нет зависимостей; Проверить изоляцию входа и возможности native resume. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12277`.

- **M199.accounts** ← M199.probe; Локальный реестр аккаунтов и официальный вход. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12338`.

- **M199.auth** ← M199.accounts; Изолированный auth context и координация refresh. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12403`.

- **M199.binding** ← M199.auth, S04, M188; Закрепить аккаунт и native conversation при запуске. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12468`.

- **M199.resume** ← M199.binding, S03.effects; Транзакция смены аккаунта с checkpoint и восстановлением. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12535`.

- **M199.usage** ← M199.auth; Квота того же аккаунта, который запускает работу. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12603`.

- **M199.auto** ← M199.resume, M199.usage; Автосмена по квотам: политика, выбор, polling и защита от циклов. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12669`.

- **M199.ui** ← M199.accounts, M199.binding, M199.usage, M199.auto; Экран аккаунтов и управление автопереключением. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12745`.

- **M199.acceptance** ← M199.ui; Проверить manual и automatic A→B→A на реальных CLI. `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12815`.

M199.usage может идти после auth параллельно с binding/resume. M169 не обязательный предшественник same-provider rotation. Все future_files в каталоге — предложенные файлы, не существующая реализация.

## Корректировки под существующими владельцами

### M199.auto

Extend existing owner; required new capability replaces old no-auto exclusions in earlier audit addendum.

One pure policy selector and persisted scheduler submit to M199.resume; no second execution engine. Invalidate queued intent on every observation/policy/account/authority revision change, not only explicit exclude control.

Контекст: `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12669`; `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/provider-accounts.md:181`

1. Freeze exact arithmetic for selected model windows, candidate freshness, threshold boundary, consume-first reset eligibility and 10pp hysteresis; use deterministic stay on ties. Specify rolling/hourly cap and time-source/restart behavior before storage implementation.

2. Persist policy enrollment/allowlist/scope/budgetRef plus immutable dedup intent with target account/auth/binding/policy/observation revisions.

3. Recheck actual target eligibility at certified boundary and immediately before stop; unknown newer observation produces hold and invalidates stale eligibility.

4. One tick lease, bounded refresh requests and per-account typed backoff; restore counters/cooldown/quarantine/pending operation before scheduling.

5. Reuse same selector for preview/dry-run, producing decision trace without credentials/PTY/paid-execution mutations.

Positive: Enabled/enrolled A95%, fresh B20%, correct scope/native receipts → automatic switch through coordinator without another confirmation. Both below threshold with earlier verified weekly reset B: consume-first selects B with headroom; best stays.

Negative: Queued fresh B then unknown/stale observation cannot switch at boundary; duplicate tick and concurrent processes cannot create second operation. 89/91 oscillation cannot ping-pong; 12 accepted switches exhaust cap through restart/100% quota; budget never resets. Wrong scope/provider/runtime, disabled/quarantined/revoked account, missing model window or unverified resume cannot become candidate.

Зависимости: M199.resume, M199.usage



Исключения: No cross-provider fallback, global credential swap, implicit background daemon or per-switch consent prompt after enrollment.

### M199.accounts

Retain former PA01; add queued SwitchOperation references to safe removal dependency set.

Deletion/default/auth revision changes atomically invalidate dependent pending selection or refuse deletion until its owner resolves it. A queued target is a dependency before it becomes current.

Контекст: `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12338`; `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:scripts/product/provider-accounts.mjs:94`

1. List current bindings, defaults AND queued/active switch operations in remove preflight.

2. CAS remove account revision and dependent intent revision; notify read model that target became ineligible.

3. Keep current account/history/draft; local deletion remains separate from provider revocation.

Positive: Unused account can be removed; existing history remains; blocked deletion names pending conversation/operation.

Negative: Queued B deletion cannot later commit empty/missing B; deletion racing admission never succeeds against stale dependency list.

Зависимости: M199.probe



Исключения: No new task owner; no credentials in receipt.

### M199.resume

Manual and automatic paths share transaction; retain former PA04 and revalidate at execution, even if selector said eligible earlier.

Immutable operation target and versioned checkpoint/identity/authority receipts are required inputs; never use mutable UI selected field as execution target.

Контекст: `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12535`; `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:scripts/product/provider-accounts.mjs:97`

1. Freeze target account/native conversation IDs on prepare; read latest existence/auth/scope/authority at boundary/stop/admission/commit.

2. Reject stale/empty/deleted target; reconcile unknown old writer/effect before new spawn intent.

3. After stop, pause/revoke permits fencing/recovery only; never starts another paid auto run.

Positive: Valid intent has exactly one fenced writer and new linked Session/TaskRun under same open Task/native conversation.

Negative: Late callback, missing target, wrong identity/native ack, crash after spawn intent and duplicate advance never duplicate spawn or effects.

Зависимости: M199.binding, S03.effects

Catalog has hard S03.effects prerequisite. Existing general-effect dispatcher deferral must be revisited against exact required outcome/fencing outputs when M199.resume starts; do not silently bypass edge or make whole unrelated backup product a prerequisite.

Исключения: No handoff transcript substituted for native continuation.

### M199.ui

Absorb ADD-PA-02 design refinement; empty-selector gap still open at new SHA, plus auto hold/removal interaction defects.

Render authoritative policy/operation states and useful no-candidate recovery; fixture should model same invalidations as declared design, while remaining explicitly non-runtime.

Контекст: `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12745`; `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:scripts/product/provider-accounts.mjs:57`; `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:scripts/product/provider-accounts.mjs:74`

1. Zero eligible targets: no active no-op prepare; show reason and add/manage account action with preserved draft/history.

2. Render pool from actual accounts, not hardcoded Working+Reserve; removed target cannot remain advertised.

3. Unknown observation/deleted target invalidates waiting fixture intent; boundary does not infer target from mutable selected field.

4. Expose off/monitoring/waiting/switching/cooling/exhausted/held/paused plus reason, receipt and next probe; threshold/advanced controls align with policy source.

5. RU/EN, keyboard focus, narrow view and CAS conflict recovery; no extra confirmation on each eligible automatic switch.

Positive: Enable displays affected conversation/scope/pool; pause retains draft; known no-candidate state gives actionable next step.

Negative: Replay attached pure probes: unknown queued target must remain A, deleted queued B must remain A or controlled recovery, never account empty. No native-success claim from fixture history/counter preservation; stale policy edit cannot silently overwrite another window.

Зависимости: M199.accounts, M199.binding, M199.usage, M199.auto



Исключения: Only existing M199.ui owner; design fixture repairs do not count as production UI.

### M199.acceptance

Former PA06 now covers both manual and opted-in auto; runtime remains not executed.

Independent native identity/conversation/effect evidence plus failure controls; fixture tests verify design states separately.

Контекст: `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/architecture/engineering-specs.json:12815`; `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/ux/scenarios.md:2025`; `8a0e9dbc17ac251e543b26653f64540a24ff0a8a:docs/ux/scenarios.md:2042`

1. Add pure fixture negative controls from provider-auto-probe.mjs and then invert expected bad outcomes in owning tests.

2. After certified adapter and explicit test-account authorization, run manual A→B→A and quota-trigger auto A→B without second confirmation.

3. Verify native markers/tool history, account subject at activation, unchanged other conversation, pending text and enclosing budget.

4. Crash/revoke/delete/unknown/reset/cooldown/hysteresis/exhausted/concurrent tick matrix scoped by provider CLI/OS/runtime; publish redacted observed receipts.

Positive: Automatic success needs no second confirmation after enrollment and preserves all declared identity/history/budget boundaries.

Negative: Wrong identity/native ack, repeated effect, changed other conversation or fabricated transcript-only resume must fail acceptance. No authorized accounts/provider certificate → BLOCKED/not-executed, not PASS; resetAt clock alone is not fresh quota.

Зависимости: M199.ui



Исключения: This addendum authorizes no live login/spend/launch or recurring task.

## Что закрыто и что осталось от прошлого дополнения

- ADD-PA-01 no automatic rotation exclusion: **SUPERSEDED** — ADR0052/M199.auto; preserve same-provider/isolation/no effect replay exclusions

- PA01–06 as current execution IDs: **REFINED** — M199.probe/accounts/auth/binding/resume/usage/auto/ui/acceptance; old plan dated snapshot

- ADD-PA-02 empty selector: **OPEN** — M199.ui; reproduced at new SHA

- ADD-PA-03 queue report deletion: **RESOLVED for this delta** — Restored docs/reports/2026-09-09-queue-progress-report.html byte-identical to d28c321 baseline (git diff --quiet exit0)

## Фактические пробы

`provider-auto-probe.mjs` импортирует сохранённый source module exact SHA и вызывает его fixture handlers через минимальную synthetic event surface; browser, CLI, IPC и сеть не используются.

1. После удаления последнего альтернативного B: select пуст, prepare остаётся активным — прежний дефект не исправлен.
2. Busy → enable → tick (B queued) → unknown quotas → boundary: макет переключается A→B вопреки показанному hold.
3. Busy → enable → tick → delete B → render switch → boundary: account становится пустой строкой, run увеличивается. Это провал design-state semantics, не доказанный runtime account-loss.

Лог: `provider-auto-probe.log`. Пробы сохраняются рядом с exact source fixture module и запускаются через `node provider-auto-probe.mjs`. Исполнитель M199.ui должен инвертировать плохие исходы в regression assertions.

## Проверки и пределы

- git rev-parse 8a0e9dbc17ac → 8a0e9dbc17ac251e543b26653f64540a24ff0a8a

- git diff --name-only 25026da 8a0e9db -- apps packages supabase → empty

- git diff --quiet d28c321 8a0e9db -- docs/reports/2026-09-09-queue-progress-report.html → exit0

- 9 detailed part depends_on arrays equal corresponding execution_nodes arrays; M199 completion aggregate depends M199.acceptance

- node /tmp/fabric-audit-20260909/provider-auto-probe.mjs → output log reproduces 3 fixture defects; initial probe syntax error corrected before results

- No runtime support/authority/identity acceptance inferred from design.

- No upstream cswap facts reverified; source defaults reported as proposed design inputs only.

- No repository modifications or agent/runtime interaction.
