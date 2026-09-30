# Проверки и текущая передача

Run HARNESS-R0, 2026-09-27. Исходная база `eda2e5d071cfb891719e81cf6ba448327f6a7643`. Это живой журнал выполнения; итоговые receipts дополняются после реальных checks, не заранее.

## Измерено

- `git status --short` перед работой: clean; active branch `codex/context-audit-2026-09-14`.
- `agent_sync.py status`: нет чужих активных leases; acquire HARNESS-R0 succeeded, run `r-410f09da3`.
- Reconcile exit 1: 28 post-baseline ADR и 112 CO без as-built плюс 10/50 historical; существующий backlog, не свидетельство реализации. Причина сохранена в journal; записи не закрываются этим срезом.
- `npx sshlg-skills toolkit --for …`: 568 reachable на configured host `claude`; это не число загруженных навыков Codex.
- Bundle implementer commit `62f96f483f58f0cc62bc1f642f11dbc8c731fd8a`, branch `codex/harness-bundle-cleanup`: two-file diff, independently reviewed, no blocking findings. Изменения перенесены в integration checkout для общей итерации.
- `node apps/desktop/test/session-bundle.test.mjs`: PASS в integration checkout, включая fault injection после mint, revoke/unlink failure и packet preservation. Новые regressions на старом source у implementer дали ожидаемый FAIL. Это compile lifecycle evidence, не live provider conformance.

- FIFO commits `9f6f80f` + `6cac842a34bf3834aa57e767c1039bf48c467dc6`: independent reviewer reproduced stale readiness after manual input; follow-up invalidates readiness and adds four manager-path regressions. `node --experimental-strip-types apps/desktop/test/delivery.test.mjs`: PASS in integration.
- Dispatch implementer `115239f0457f637ff0943cc46b9906b0ac7ff0f8`: isolated two-connection PostgreSQL claim test PASS. Root review added early session-bound ACK, common first-instruction dispatch, projection-fence preservation and full migration replay. Additional independent agent review could not start: tool returned `agent thread limit reached`; this part has root review plus tests, not an invented independent receipt.
- `node apps/desktop/test/run-dispatch-db.mjs`: PASS. Creates/cleans its own PostgreSQL 17 cluster; applies every migration from disk, uses real append/projections/RPC, tests concurrent claim, expiry, stale owner, no replay after begin, known-no-write retry, legacy queued uncertainty, exact-session/digest ACK before write receipt and replay preservation. Supabase auth service and HTTP/MCP not covered by this SQL-only run.
- Focused `vitest` answerReceipt/continuation/scope: 3 files, 43 tests PASS. Board loop closure now requires ACK for every addressed task; unknown/queued state remains visible.
- Earlier fast attempt: FAIL at event wording gate for two new delivery event types. Added EN/RU strings; subsequent fast result recorded below after execution.

## В работе

HAR-R0-02 integrated for existing-task admission and answer continuation with native-write Promise. Legacy `startTask` and free-terminal first instruction still bypass the durable dispatch coordinator: migrate them in HAR-R0-03; do not claim all launch paths repaired. General repository fast gates PASS. Next HAR-R0-03 compensated admission and HAR-R0-04 observed Stop. Полные native scopes ещё не приняты. [Точная последовательность](development.md).

## Не выполнялось / не принято

Electron walkthrough, live Claude/Codex conformance, voice/STT end-to-end, cross-provider fidelity, behavioral CEO eval и operator useful-return pilot. Они остаются release blockers для соответствующих capabilities; отдельных CPU tests недостаточно. Старый аудит E07 описывает базовый дефект; новые tests и результаты должны заменить его только для изменённого пути.

## Координация и Git

В этой итерации source owns Fabric. Sibling contract/adapter production pins пока не менялись. Ветка bundle — subordinate code receipt, не отдельный выпуск. Публикация wiki выполняется после принятия source iteration; actual source/workspace/release tuple всегда в generated workspace receipt, не в вручную составленной таблице.


Integration review also found the new operational table missing from mirror coverage. This broke 66 tests through the common storage boundary; `NOT_MIRRORED` now explicitly classifies fences as authority, not editable workspace content. Old queued history with no fence remains unknown after journal-only restore. A pure gate false positive matched the queue timeout field to an unrelated historical `Delivery.deadlineMs`; renamed the new private timing field rather than claiming the old gap closed or weakening the baseline.

RPC authority carries the held person ID and membership revision separately from the audit actor label `person:operator`. Claim/begin recheck that revision under a row lock; tests exercise changed revision and removal. Raw dependency errors are not emitted in dispatch responses. The session ACK command preserves digest mismatch semantics and rejects another session.

Final root review found a granted queue gate could survive new output/manual input while waiting for readiness again. It now returns `failed_before_write / readiness_changed`; a fresh attempt revalidates authority. Manager regressions PASS, including a revoked retry after the old gate granted. Legacy unfenced queued deliveries now persist one `delivery.unknown@1`, so the read model matches the command's uncertainty.

Integration fast reached 121 test files / 1362 tests PASS, then exposed stale prototype previews and an unexecuted migration reservation. Rebuilt 98 previews from the actual report; inspected the Home thumbnail. Moved future pipeline reservations after migration 60 under their existing collision rule; `fix-pf-06.03.py` PASS. Final full fast rerun is required before source commit. Neither that check nor preview generation is native UI acceptance.

Final rerun: `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` **exit 0**, 121 Vitest files / 1362 tests, build and pure probes, docs/register/UX/report/preview gates, planted regressions passed. Stack-backed probes were not run by this command; isolated full SQL migration test above is a separate receipt. Build manifest reports no toolchain pin, so reproducible-build acceptance remains open. Final receipt/navigation edits are documentation-only and checked again through the documentation gates before commit.

Native inventory, read-only on 2026-09-27: `claude --version` → `2.1.283 (Claude Code)`; `codex --version` → `codex-cli 0.157.1`. `codex --help` offers `--no-daemon` and describes a shared background server. This is a Stop-design input, not proof that any existing session is isolated or that cancellation works. HAR-R0-04 must verify the execution boundary instead of equating TUI exit with agent termination.

Skills actually used: task-pipeline — bounded build/review; agent-harness/orchestrator/interop/evals — execution boundaries, full module map, adapter separation and acceptance tiers; super-ux — delivery scenarios; copywriting — honest delivery states; evidence-docs — receipts and limits; agent-sync — guarded registry lease; maintaining-fabric-workspace — publication chain. Additional review runs inline because the agent tool refused further threads; it is not independent review.

## HAR-R0-03 · первый срез: ошибка после spawn

На базе `4a90bd2f7cd2e6a55267f9c957b140d2b683b698` новый `pty-launch-failure.test.mjs` сначала FAIL: после отказа journal.open manager удалял ещё потенциально живой процесс. Исправление сохраняет session и наблюдение до реального exit, закрывает очередь, независимо пытается revoke и terminate, возвращает `PtyLaunchFailure` с точной session identity. Исключение exit observer больше не препятствует записи terminal.closed; отказ revoke не пропускает закрытие связанной задачи. StartTask сохраняет связь для позднего exit, chain оставляет lease и outcome_unknown после post-spawn failure.

Focused checks: `node --experimental-strip-types apps/desktop/test/pty-launch-failure.test.mjs` PASS (journal, spool, signal, revoke, exit-observer faults); `chain-launch-failure.test.mjs` PASS против реального createChainAdvance; session-bundle и delivery suites PASS; `node apps/desktop/test/pty.test.mjs` PASS с настоящим локальным pseudo-terminal/echo. Main TypeScript check PASS через установленный tsc. Сигналы и агенты в fault tests — fixtures; native PTY echo не доказывает остановку CLI, descendants или remote effects.

Изолированная рабочая копия использована для кода, пока публиковалась предыдущая итерация; её `pnpm exec` отказался работать с внешним symlink modules (`ERR_PNPM_UNSAFE_MODULES_DIR`). Установка не продолжалась и зависимости основного checkout не удалялись. Typecheck выполнен существующим compiler напрямую; интеграционные gates выполняются в основном checkout. Новые regressions включены в fast и desktop test runners.

Остаётся HAR-R0-03: один admission/spawn/bind/delivery coordinator вместо нескольких путей; atomic lease/run bind; unknown старый writer не освобождается по timeout; host-aware recovery вместо глобального reconcile([]). Затем HAR-R0-04: durable Stop, наблюдаемая граница и continuation. Этот срез не закрывает эти требования и не меняет native readiness.

Review added an exit-before-catch recovery case: a second DB failure must preserve the original post-spawn identity. `retainFailedLaunch` is imported by startTask and tested directly; recovery failure cannot be misclassified as no process. An early fast attempt caught the output-cost check's registration-order assumption; both callbacks now remain in their original order inside the guarded block, before transcript initialization. The gate is unchanged.

HAR-R0-03 recovery slice final check: `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` exit 0, including 121 Vitest files / 1362 tests, both new launch regressions, output-cost guard, build and documentation gates. The prior output-cost failure is corrected without modifying that guard. Final receipt-only edit is checked with the documentation gates and map stamp before source commit. The standalone SQL fixture did not need a repeat: this slice changes no migrations or dispatch SQL.


## HAR-R0-03 · единый managed launch, 2026-09-27

Source baseline: [`75223f1`](https://github.com/passioncode-ai/fabric/commit/75223f1deecd254e6499a85ea1c86fdb0d0ac32d); предыдущая публикация проверена `node scripts/workspace.mjs check --require-child`: source 75223f1, workspace 561357360a4e49a0dd961239639434a6c1a782c1, 862 files, child verified. Parent pin 4875226. Ниже новый runtime срез, не выпуск приложения.

Контракт: [`managedLaunch.ts`](../../../apps/desktop/src/main/managedLaunch.ts) связывает task/run/session до OS spawn. Только caller, получивший одноразовый begin для точной generation, готовит bundle и запускает процесс. После bundle финальная проверка повторяет authority, blockers, task и lease; затем атомарный bind и существующий durable dispatch. CLI получает тот же session ID. Повторный caller не запускает и не компенсирует победителя. Потерянный receipt не разрешает новый эффект; известный pre-spawn failure и post-spawn uncertainty имеют разные компенсации.

[`migration 61`](../../../supabase/migrations/20260927000061_managed_task_launch.sql) — additive SQL owner. Известный конец разрешает следующую попытку без ожидания TTL; timeout сам по себе не разрешает забрать работу у неизвестного процесса. Старый claim/release путь также должен соблюдать unresolved ownership. Первая implementation review нашла обход этого guard, задержку retry после known end и cross-Estate session race; они исправлены в SQL-пакете `4b4ec58` → `1ce6d70` → `3c0a9d1`. Повторное независимое review не нашло нового дефекта в ограниченном launch packet. Статус приёмки определяется командами ниже, не этим описанием.

Все managed paths (создание, existing Board task, chain, routine через startTask) используют общий coordinator. Plain terminal остаётся отдельной unmanaged возможностью. Raw lease updates из native launch/chain удалены. Boot больше не отменяет все running задачи Estate и не освобождает чужие leases; [`reconcile.test.mjs`](../../../apps/desktop/test/reconcile.test.mjs) импортирует настоящий read-only lifecycle и отдельно проверяет отсутствие старого destructive wiring. Старый тест копировал удалённый цикл; его модель не считалась проверкой реального bootstrap.

Review также обнаружило consumer gaps: task→session navigation, ACK→running, task preset и финальная revalidation после длительной подготовки. Исправления проверены реальными SQL transitions и импортируемым runtime. Final validation RPC и OS spawn не атомарны: остаётся минимальное race window; bind/доставка повторно проверяют generation. Это не разрешает объявить containment native tools или observed Stop готовыми.

Текущие локальные receipts: `managed-launch.test.mjs`, `pty-launch-failure.test.mjs`, `chain-launch-failure.test.mjs`, `reconcile.test.mjs` — PASS на реальных импортируемых модулях с fake OS/RPC transport; tsc main, actor и output-cost guards — PASS. Coordinator покрывает ошибки prepare/spawn/bind/compensation/delivery, потерянные RPC replies, exact identity, двух consumers одного begin, revoked pre-spawn permission. SQL и финальный fast receipt добавляются после интеграции. Обновлённые HTTP-backed chain/run-lifecycle fixtures пока NOT_RUN; локальный PostgreSQL не заменяет HTTP/auth/provider acceptance.

### privacy-ingress

Независимый read-only audit подтвердил synthetic-data defects в настоящих модулях baseline 4875226: multi-chunk PEM сохранялся в transcript до footer и после close; cap-before-redact сохранял body в ops; structured `API_TOKEN` без узнаваемого prefix и generic Authorization Bearer не очищались. Также `identity.ts`/journal передают operator payload без очистки; прямые answer/import RPC обходят journal wrapper. Это подтверждённые дефекты, а не свидетельство утечки реальных ключей. Sink fixes и command ingress разделены в HAR-R0-06; native CEO/voice/attachments ещё не существуют как принятые producer paths. Старые данные не объявляются очищенными.

Следующий шаг после интеграции managed launch: HAR-R0-04 observed Stop и HAR-R0-06 canonical ingress; затем HAR-R0-05 host manifest/provider conformance и continuation. CO-168 остаётся открыт, вся цель R0 сохраняется. Отдельные module tests и опубликованный план не являются native acceptance.


Managed launch integration SQL: `node apps/desktop/test/run-managed-launch-db.mjs` PASS на полном migration chain в принадлежащем runner временном PostgreSQL. Проверены concurrent admission/begin, exact bind, authority changes, revoked-before-spawn validation, late/blocked ACK, session navigation, claim/release guards, known-end immediate retry и replay. Независимый reviewer повторил SQL runner и module fault probes — PASS; это не HTTP/native acceptance. Первая fast попытка обнаружила отсутствующий ops receipt для unknown delivery; добавлен безопасный diagnostic. Следующая обнаружила старый тест, требовавший auto-retry и raw DB error после потерянного admission reply; test contract исправлен: unknown не авторизует повтор с новой identity, dependency error не попадает в UI.


HAR-R0-06 sink repair: `6cc02fc` + `aaef0ae` устраняют structured credentials/auth headers, PEM до footer и cap-before-redact. Независимое review дополнительно воспроизвело ANSI-decorated PEM на диске и traversal discarded array tail; follow-up нормализует terminal controls поточно до сохранения, ограничивает структуру ops до обхода, но очищает retained strings до сокращения. Focused 39 Vitest tests и реальные transcript/ops filesystem probes — PASS у исполнителя. Canonical operator/answer/import ingress ещё не исправлен; старые данные не изменялись. Source cleanup не следует путать с полной privacy acceptance.


Последний sink review обнаружил post-redaction `toJSON` callback: сериализация могла заново создать секрет после очистки. `f08dc5b` делает callable/symbol/bigint значения инертными, использует null-prototype output; filesystem negative test проверяет, что callback не вызван и synthetic credential не сохранён. Focused suite: 41 тест + actual ops file probe PASS. Это отдельное исправление от всё ещё открытого operator command ingress.

HAR-R0-04 reconnaissance (не native acceptance): локальные `claude --version/--help` и `codex --version/--help` показывают builds 2.1.283 и 0.157.1. Установленный node-pty 1.1.0 `unixTerminal.js` вызывает signal только для root PID и по умолчанию SIGHUP; root exit не доказывает завершение descendants. Codex `--no-daemon` нужен owned foreground adapter; для shared/remote требуется provider lifecycle. Claude поддерживает отдельные background paths. [Официальные env docs](https://code.claude.com/docs/en/env-vars), прочитаны 2026-09-27, документируют выключатели background tasks и agent view; их наличие не доказывает conformance конкретного native запуска. Следующий пакет объединяет operator Stop и natural exit с одной процедурой observed quiescence, transcript commit и revoke; known root exit из migration61 ещё не является этим доказательством.


Final integrated receipt (2026-09-27): `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` exit 0 — 121 Vitest files / 1371 tests, real module fault probes, transcript/ops filesystem checks, build, actor, output-cost and documentation gates. Full isolated PostgreSQL migration chain with managed launch and dispatch suites also passed. Final independent re-review accepted the bounded launch packet and confirmed the `toJSON` fix (zero callback invocations, no synthetic secret persisted). Final receipt-only documentation update is rechecked with docs/map gates. Heavy hosted suite and native Claude/Codex stop/continuation were NOT_RUN, not PASS. The built artifact still reports no toolchain pin; reproducibility remains HAR-R0-05 work.

Handoff: primary source branch remains `codex/context-audit-2026-09-14`; SQL commits 4b4ec58/1ce6d70/3c0a9d1 and sink commits 6cc02fc/aaef0ae/f08dc5b were integrated as reviewed files into this source iteration. Those temporary member branches are not production submodule pins. Next task is HAR-R0-04 common Stop/natural-exit finalizer; additive migration62 and process-group observer are being developed separately and are not part of this receipt. Lease for this iteration: HARNESS-MANAGED-LAUNCH, run r-1d9cd5615; an older lease under another session identity is not released or impersonated. CO-168 and the complete R0 goal stay open.

## HAR-R0-04 · durable Stop contract and native primitives, 2026-09-27

Source baseline: [`5e1f26c`](https://github.com/passioncode-ai/fabric/commit/5e1f26cd33fa90967f21de1176b76fc2881b2621); publication parent `670bc94`. `node scripts/workspace.mjs check --require-child` returned source 5e1f26c, workspace f7ce8305d2092d971aa8f82b4ea93da565cd4629, 862 files, child verified. This source iteration is **not native Stop acceptance**. [Full contract, module map and exact next packet](stop.md).

### Implemented boundary

Migration62 adds `request_task_run_stop` and `record_task_run_stop_observation`, with service-only operational `run_stop_commands` and `run_launch_compensations`. Neither table is mirrored or reconstructed from raw journal events. Five typed facts, bounded evidence refs and independent terminal exit evidence are required for observed completion. Unknown retains ownership and blocks write admission even after lease expiry or a root-only `run.ended`. Claim/begin of continuation requires an active Run. The exact latest Task moves running→backlog in the verified transaction; terminal/review state is preserved.

The separate never-spawned compensation resolves Stop during preparation without inventing a terminal exit. Canonical command, reason and basis survive retry. Positive process attestation, opened/bound/closed evidence or an untrusted agent cannot create a no-process receipt. Replay cannot turn later proof into permission for an earlier rejected claim.

Native primitives: importable `managedStop.ts` sequences halt, durable request, mediated revocation, signal, bounded observations and transcript receipt. Request/observation loss never becomes success; identity mismatches refuse; another caller's command/reason is canonical. `processBoundary.ts` samples owned POSIX groups and observed descendants. `pty.ts` halts manual input as well as delivery, uses explicit SIGTERM, retains the exit signal, awaits the first terminal.closed append attempt before notifying its consumer and offers retry of that receipt.

### Checks actually run

| Command / scope | Result |
|---|---|
| `node apps/desktop/test/run-managed-stop-db.mjs` | PASS on owned temporary PostgreSQL, latest full migration chain; dispatch and Stop suite. Root log `.task-pipeline/build/harness-r0/stop-integrated-sql.log` is local-only |
| `node apps/desktop/test/run-managed-launch-db.mjs` | PASS on owned temporary PostgreSQL, latest chain includes62; expectations explicitly require trusted proof before reopening execution |
| `node --experimental-strip-types apps/desktop/test/managed-stop.test.mjs` | PASS actual coordinator: lost replies, canonical command/reason, revocation/observation/transcript faults, ownership change, repeated callers |
| `node --experimental-strip-types apps/desktop/test/process-boundary.test.mjs` | PASS synthetic snapshots: child survival, detected PID reuse, escape, unreadable source, host-group refusal |
| `node apps/desktop/test/process-boundary-native.test.mjs` | PASS actual owned local processes: ignored TERM, child surviving parent, explicit KILL and observed quiescence. No provider/account launched |
| `node --experimental-strip-types apps/desktop/test/pty-launch-failure.test.mjs` | PASS actual manager with native fixtures, includes manual input after failure fence |
| `node --experimental-strip-types apps/desktop/test/delivery.test.mjs` | PASS queue and shutdown/manual-write regressions after preserving the shutdown reason |
| `node apps/desktop/test/pty.test.mjs` | PASS actual pseudo-terminal echo; no agent semantics inferred |
| Desktop main TypeScript compiler `--noEmit -p apps/desktop/tsconfig.node.json` | PASS |
| `pnpm gates:docs` preflight | PASS, existing advisory UX warning U077 remains; full fast receipt below |

Independent review found and drove fixes for: task stuck running after acknowledged execution was stopped; Stop-before-spawn deadlock; a positive process attestation lost when Stop had already moved the Run to ending; canonical reason lost on retry; missing local ownership recheck after asynchronous revocation. Actual SQL repros, not just source inspection, established the two deadlocks. Process-group and coordinator probes were independently rerun. Review is bounded to these modules and does not certify native provider containment.

One focused delivery test initially failed because the shared halt method changed `shutdown_requested` to `stop_requested`. The shutdown reason was restored and the same suite passed; the assertion was not weakened. No global agent configuration, user project or live database was used as a test fixture.

### Limitations and next action

- `managedStop.ts` is not yet bound to the app's operator/natural-exit/failed-launch/shutdown entry points. The old task finalizer remains and must be replaced; SQL now refuses to treat its root-only end as clearance. Until HAR-R0-04B lands, native Continue can correctly remain blocked rather than silently admit a second writer.
- `ps`→signal is not atomic; process birth precision is bounded. Sampling is not containment, and it cannot prove that unseen work never escaped. Provider daemon/remote-work quiescence, persistent owned supervisor, host reboot/recovery, external effects and exact provider build conformance remain open.
- UI status/IPC receipt, detailed transcript receipt consumption, same-provider fresh execution and cross-provider continuation are not accepted. Existing mocks are target behavior; no new screen is claimed by this source iteration.
- HTTP-backed hosted acceptance/full CI was not run; nightly CI policy is unchanged. SQL fixtures prove database transactions and real local process fixtures prove their measured boundary only.
- Keep CO-168 open. Next executor starts with [HAR-R0-04B](stop.md#exact-next-implementation-packet), then provider conformance HAR-R0-05 and canonical ingress HAR-R0-06. This is ongoing authorized R0 implementation, not a request for another approval.

Member sources integrated as reviewed files: managed-launch-sql branch `5094428` → `320b7a9` → `7513a75`; root-owned native primitives developed in `codex/observed-stop-runtime`. Pending member work must be listed here before handoff; no unrelated worktree or production submodule pins are changed.

Integration checks also caught two silent-error branches without an explicit uncertainty explanation and schema column formatting incompatible with the existing scope parser. Explanations were added at the catches and both new table definitions use the repository's one-column-per-line format; the scope assertions remain unchanged. A native capture await was moved after spool opening so output arriving during process sampling is not dropped.

Pending member packet: `codex/transcript-finalization` at `c6fd0ae4c7708a205dd57b98919715f5c1b3c9ae` contains the detailed finalizer and 12 filesystem scenarios. It is not part of this Stop-contract source slice and still requires independent review and integration in HAR-R0-04B. The member worktree is isolated; no submodule pin references it.

Final review additionally reproduced a dismissal race with the real PtyManager: an exited root could be forgotten while terminal.closed or an asynchronous finalizer was pending. The manager now retains metadata until both complete; failed receipt/finalization remains recoverable. The regression covers all three cases. Repeated completed Stop requests now return the verified proof sequence, not the original request sequence, with SQL assertions for observed and never-spawned cases. Independent module and latest-chain Stop/launch reruns passed.

The transcript member branch was pushed; `git ls-remote origin refs/heads/codex/transcript-finalization` resolves to c6fd0ae4c7708a205dd57b98919715f5c1b3c9ae. It remains pending independent review and integration, not silently part of the current runtime.

Final source check: `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` exit0, including 121 Vitest files / 1371 tests, the new Stop/process module probes, PTY dismissal regressions, build, schema/scope, operation visibility, documentation and register gates. Root log: `.task-pipeline/build/harness-r0/stop-final-fast.log` (local-only). Latest full-chain Stop runner passed after the verified-sequence correction. This receipt-only documentation update is followed by docs/map checks; no runtime changes follow that fast run.

Pending transcript member review found that an unpersisted first-finalization snapshot could be evicted after 256 other closes, losing its first metadata; the executor is correcting it before integration. Shared staging-file concurrency also needs review. These are open work under CO-168/HAR-R0-04B, not accepted runtime changes.

## HAR-R0-04B · native binding and presentation · 2026-09-27

Scope: one Stop finalizer across IPC/natural exit/post-spawn failure/quit, explicit Force, detailed transcript receipts, truthful UI. Source base `d8c8044f8930785abc3fbc4ff928d7810200b629`; publication pin `bac64a3` is not new runtime code.

Reviewed member packets: native bridge `5f6ab5dd467be34b9127ea204516706a89b41241` (`codex/native-stop-runtime`, remote exact SHA verified); transcript seals `ba27dbbc77683abf56b682b3c56731d59f25b239` (`codex/transcript-finalization`). Root integration is evaluated separately.

Executed focused checks: main/web TypeScript exit 0; `native-stop-runtime.test.mjs`, `managed-stop.test.mjs`, `pty-launch-failure.test.mjs`, `transcript-receipt.test.mjs`, `close-http-server.test.mjs` PASS; transcript finalization/recovery 21 filesystem checks PASS; SessionStop + SessionWindow 13 renderer tests PASS; first-release prototype 35 tests PASS. `check-design.mjs` PASS after removing obsolete End strings and formatting the JSX branch. Full fast and final documentation receipts are recorded after the final integrated run below.

Independent review found and fixes covered: late timer dispatch after synchronous blocking ports; input accepted during slow Stop lookup; unmanaged agents refusing all termination; startup failure with uninitialized Stop runtime; natural-exit credential revocation blocked by database failure. No real Claude/Codex provider call was run for this slice. A stopped shell fixture is not provider acceptance.

Next: HAR-R0-05 exact-build provider protocol/identity/quiescence conformance; durable process recovery; HAR-R0-06 canonical privacy ingress. Full R0 remains active. Do not enable portable continuation from an unverified predecessor or mark CO-168 complete.

Transcript recovery follow-up `a2c4af2fde8b9ec8742ece6efb463bdda76787a7` pushed to `codex/transcript-finalization` with exact remote verification; independent 21 filesystem checks and legacy probes PASS. Detailed recovery retains empty/unavailable records and original exit metadata until acknowledged journal settlement. Root startup wiring is included in this slice. Worktree fast invocation was rejected by pnpm because dependency symlinks resolve outside the worktree; no dependency tree was removed. Full fast is run in the owning checkout instead.


Independent final integration review: no remaining concrete finding in the bounded native/UI slice. Review also exposed the legacy projection's null-ending substitution; unsealed crash spools now stay retained until a nullable ending contract is implemented (CO-168). A prior Stop intent remains remembered for late-exit diagnostic attribution. These diagnostics do not mutate Task/Run state.

Visual component check (local Vite fixture, actual SessionStop/StateChip/Panel and current tokens, synthetic data, no processes): RU requested/unknown/refused/verified states displayed; pending action disabled; Force opened a distinct warning and Cancel restored the same unknown state; refusal offered retry without Force. Found and fixed a legacy untranslated Dismiss label. This is a component browser walk, not whole-Electron/native-provider or WCAG acceptance. Temporary fixture stays local-only.


Final integrated `bash scripts/ci.sh fast`: **exit 0**, `fast tier green`; renderer **122 files / 1,379 tests passed**, plus the native/coordinator/transcript/host identity/HTTP probes. Stack-backed probes did not run in this binding-only iteration; migration62's isolated SQL receipts remain in the preceding section and no migration changed here. The owned POSIX native process fixture was rerun successfully. Full fast initially caught stale completeness/previews and four unexplained catch branches; all fixed without weakening gates. `build-mockup-previews.mjs` rebuilt 98 previews, `build-mockup-coverage.mjs` rebuilt completeness, and map/checks resolve current source bytes.

Handoff objective remains full release-quality R0, not completed by this slice. Exact next task: implement/review P05.1/P05.2 from [providers.md](providers.md), then actual provider adapters; preserve native profile/identity/cursor and manifest ACK boundaries. Pending member branch `codex/provider-execution` is isolated work, not integrated or a readiness receipt. Required follow-up: nullable unknown transcript-ending projection and recovery UI, durable old-process ownership, canonical privacy ingress, CEO/voice and end-to-end operator acceptance. CO-168 remains open; CO-169 remains separate. The native-binding implementation worktree is a duplicate staging area; the owning Fabric branch/commit is the durable handoff entry.

Skills actually used in this iteration: task-pipeline (bounded implementation/review and delivery); agent-harness/orchestrator/interop/evals (lifecycle evidence and provider packet); super-ux (SCN-096 transitions); sheleg-design (existing component/style audit and browser fixture); copywriting (EN/RU Stop semantics); evidence-docs (measured receipts); agent-sync (shared-document lease); maintaining-fabric-workspace (canonical projections and publication). No new public wire contract or installed plugin was released.

## HAR-R0-05 · internal provider contract and transport · 2026-09-27

Objective: replace ambiguous provider identity and request/success inference with exact execution binding and structured observation. Base source `73ac5a792b0d356954858bd9306ee2e18a994fd2`; verified publication parent `a58d4a8`, workspace `db5578dc5c72880a94065ed0003bc1d92ec2d03a`. `workspace.mjs check --require-child` exit0 before this iteration. No new screen or native capability is implied by these internal modules.

Integrated reviewed member source [`c77f5d7545d62c8b79b7052571ab71c270419e29`](https://github.com/passioncode-ai/fabric/commit/c77f5d7545d62c8b79b7052571ab71c270419e29), branch `codex/provider-execution`, exact remote verified. Only `shared/providerExecution.ts` and its fixture came from that packet. Root owns `main/providerJsonlTransport.ts`, transport fixtures, registration and documentation. [Architecture and next boundary](providers.md).

Executed checks: `node --experimental-strip-types apps/desktop/test/provider-execution.test.mjs` PASS; `provider-jsonl-transport.test.mjs` PASS, including a real owned Node child stdio fixture; `pnpm --dir apps/desktop exec tsc -p tsconfig.node.json --noEmit` exit0. Independent reviewer reran both suites and reported no remaining concrete findings in these bounded modules. Full integration gate receipt is recorded after execution, not inferred from these probes.

Review fixed: same-session Claude execution ambiguity; reopened writer admission; array-to-string enum coercion; old connection epoch reuse; asynchronous close-observer rejection; NaN deadline; serialization closing transport before effect; nested requests exceeding pending capacity. Each has a direct regression against the implemented module. No provider request, paid inference, authentication change or shared daemon was used. Locally generated Codex `0.157.1` JSON schemas were read as the exact installed protocol inventory only.

Reconcile continues to report the existing 28 post-baseline ADR and 112 CO gaps plus historical backlog; the reason remains journalled rather than declaring unrelated decisions implemented. Owned lease covers guarded documents. Pending follow-up member work on `codex/provider-execution`: scoped Codex event normalization; until its separate reviewed commit is integrated it is not part of this receipt. The old Stop staging worktree is not an additional source owner.

Exact next task: native normalization and owned supervisor, typed cancellation before transport teardown, independently verified writer coverage, load and checkpoint acknowledgements. Then exact-build isolated provider acceptance. H07 remains blocked on observed predecessor boundary; unsealed crash transcript projection, privacy ingress, CEO/voice and complete operator flows remain mandatory. CO-168 stays open; no public contract or adapter pin changed.

Skills used for this packet: task-pipeline for bounded delivery and independent review; agent-harness/interop/evals for lifecycle contract and evidence separation; evidence-docs for receipts; agent-sync for shared-document coordination; maintaining-fabric-workspace for the publication chain. Existing scenario and visual contracts are preserved; no new interface behavior is claimed.

Integrated `bash scripts/ci.sh fast`: **exit0**, 122 renderer files / 1,379 tests plus the new provider contract/transport probes and all registered fast checks. Local log `.task-pipeline/build/harness-r0/provider-contract-fast.log`. The transport calls a fire-and-forget local write `submitted`, explicitly not delivered; a pre-closed stream also refuses new requests. Both have direct regressions. No schema or database mutation in this packet; stack-backed/native provider acceptance was not run. Final receipt-only documentation is checked through docs/map gates before commit.

## HAR-R0-05 events / cancellation and HAR-R0-06 prerequisite

Base `8d6237311ed27276e5cad3006ee0c945a991b637`, publication parent `6fb03e47a75b52e678b5d0c1be3c6676bddb9b3b`; workspace `db8091d0c66fad6a389eacca2dc769ca864c0639` verified by strict child check. A fresh remote checkout of the source resolved 58 packet links and the changed map anchor. Pending member updates were not silently included in that source.

Now integrated: Codex normalizer [`da7eabc`](https://github.com/passioncode-ai/fabric/commit/da7eabc2e17d70a5900f9644e25f1266d31bcad5); Stop ordering [`dcd1de6`](https://github.com/passioncode-ai/fabric/commit/dcd1de60c742fc1594049970963bceb514156570); redaction prerequisite [`023eb2a`](https://github.com/passioncode-ai/fabric/commit/023eb2a4a7f034f1d70b987f1b9e9e4b4df942bc). Each owner branch was pushed and exact remote SHA verified. [Provider packet](providers.md) and [canonical ingress plan](ingress.md) carry boundaries and next actions.

Independent module checks passed: provider contract and Codex event fixtures; managed/native Stop suites; 39 redaction/payload/ops unit tests plus real transcript/ops filesystem probes. Reviewer additionally measured 336 synthetic redaction combinations with zero repeat-pass differences. Root runs integrated fixtures and full fast separately; none of these tests launched a real provider or mutated a live DB.

Review corrections: replay fingerprinting must precede state-dependent derivation, but cannot conflate omitted/null/invalid source values; turn completion must preserve in-progress commands; malformed receipt enums cannot coerce from arrays; typed cancellation follows canonical durable intent and precedes TERM; lost intent/deadline/changed ownership never writes cancellation. Redaction now preserves emitted markers without treating lookalike prefixes or attached suffixes as safe. These fixes do not supply a native coverage producer, a reconnect bridge or common ingress adapters.

Next owned packet: Codex control requests on `codex/provider-execution`; pure ingress policy on `codex/transcript-finalization`. They remain separate pending work until reviewed integration. Root owns runtime wiring and docs. Full R0 still requires supervisor/adapter integration, observed writer closure, load/context acceptance, privacy sink adapters, memory recovery, CEO/voice and operator flows. No native provider capability, application release or production sibling pin is promoted.

Final integrated `bash scripts/ci.sh fast`: **exit0**, 122 renderer files / 1,385 tests plus registered module probes. Local log `.task-pipeline/build/harness-r0/provider-events-fast.log`. Initial docs gate rejected line-number references in the new living ingress plan; replaced them with checked symbol references, then reran fast successfully. No migration or database change; stack-backed probes and native provider runs remain NOT_RUN. Final documentation records terminal-topology investigation as a hypothesis from installed help, not an accepted architecture or executed provider test.

## HAR-R0-05 · control-to-transport composition

Base source `ec544530b6fde2c97be2e144d97e5af239b7bbef`, publication parent `2a5967e`; workspace `f09c200a30857894c356cc7af52634201de2d6bf` passed strict child verification. Fresh remote source checkout resolved 67 relative packet links and map anchor. This iteration integrates controller member [`eb2e650`](https://github.com/passioncode-ai/fabric/commit/eb2e6503db8b7531866b0842eeb0e2197f289fb5) and transport/composition member [`4b40d1f`](https://github.com/passioncode-ai/fabric/commit/4b40d1f62a3bdf74a0c52b5da796b158377cc3e0), both pushed with exact SHA checks.

Independent control/transport/composition suites passed. Root reran `codex-provider-control.test.mjs` and `provider-control-stdio.test.mjs` against integrated modules and main TypeScript exit0. Actual composed fixture uses an owned Node child, not a native provider. Review fixed a truthy Promise granting authority and a slow synchronous permission callback outliving the transport's own deadline before write. Permission must be literal true; failed/async permission is refused without unhandled rejection. Full fast receipt follows after integration.

Canonical control caching is connection-local, not a persistence or reconnect guarantee. Host ownership snapshots are required inputs, not generated evidence. App supervisor/launch binding, writer closure and real load/resume acceptance remain open; default native provider observation is unchanged. The pure HAR06 policy remains pending separate review/integration at this point; sink adapters are not delivered. Next work stays in the [provider](providers.md) and [ingress](ingress.md) packets rather than reconstructing commands from chat.

Final integrated `bash scripts/ci.sh fast`: **exit0**, 122 renderer files / 1,385 tests and registered control/transport/owned-pipe probes. Local log `.task-pipeline/build/harness-r0/provider-control-fast.log`. Initial gate found an unexplained scope-fault catch; it now explains its fixed refusal outcome without exposing port errors. The rerun passed unchanged assertions. No database migration changed; stack-backed and native provider acceptance remain NOT_RUN. The [Claude protocol packet](claude-provider.md) records pinned official research, not an implemented Claude adapter. Next bounded work: prepared journal/answer/import adapters and their actual caller binding, plus Claude control transport with independent review; pure policy branch `codex/transcript-finalization` at `994a7ba2f1a6707f291d7bc0c9a2c8ca3792e88a` is pending, not silently integrated.

## HAR-R0-06 · desktop binding / Claude control transport

Base source `e0b0194d3e76290572cc981fc0380a233113d54a`, publication parent `19ef15c`, workspace `0ca5912b3e07feeea6efec9cb919ae67f8ec3dd7`: strict child check exit0. Fresh remote source clone resolved 77 relative packet links and the exact map anchor. Reviewed member commits: pure policy `994a7ba` + Node syntax `012a381`, sink adapters `eb46f03`, desktop binding `f314c6747a5462c93d78ba12d8d35c8fb5fa1198`, Claude transport `498e6efa568cbf5572a2eba8c012ff3f143a460d`; owner branches were pushed and exact remote SHAs verified. Links and ownership are in [ingress](ingress.md#integrated-desktop-boundary--2026-09-27) and [Claude packet](claude-provider.md#implemented-control-transport).

Independent reruns: 17 captured adapter scenarios, actual desktop Journal/chain composition, PTY launch-failure/refusal and Claude transport PASS. Implementer ran 47 focused unit tests and main TypeScript exit0; root integration runs separately below. Review corrections: repeated answer text must not masquerade as persisted original; schema sanitation must precede generic AgentSurface rewriting without losing actual removal counts; native launch references must refuse secrets before effects. Whole chain brief and search queries are prepared before outbox/clipping. Source import digest and finalized transcript/context receipt bytes are unchanged.

Updated AgentSurface/handshake/memory DB fixtures now inject the prepared boundary, but those stack-backed suites have not been executed in this packet. Pure spies do not certify database transactions or native providers. Current global goal remains active: Claude normalizer/supervisor, actual provider and load/resume evidence, durable process recovery, legacy context compilation, CEO/voice and operator acceptance remain open. No runtime release, public wire contract or production sibling pin changed. Exact next tasks remain the [provider packet](providers.md) and [ingress follow-up](ingress.md); CO-168 remains open.

Integrated `bash scripts/ci.sh fast`: **exit0**, 123 unit/renderer files / 1,401 tests plus registered Claude control, prepared-adapter, desktop composition and PTY probes. Local log `.task-pipeline/build/harness-r0/canonical-ingress-fast.log`. Gates initially required explanations for fixed-error catch paths and unambiguous full-path symbol citations; corrected without changing assertions. No migration changed. Next isolated DB acceptance fixture is being built on `codex/ingress-sql-acceptance`; it is not part of this receipt. Read-only legacy-context review reproduced a token fragment surviving clipping into an otherwise hash-consistent packet; the separate correction must clean original compiler inputs before flattening, clipping and hashing, preserving history and scoped transport credentials. That fix remains pending review/integration on `codex/transcript-finalization`.

## Context compilation, Claude events and actual boundary probes

Base source `fda95deedb66a7cea2cd9ba855fdbe678f5e8701`, publication parent `1330f81`, workspace `7299b6cd77d4c44a77ac183bff45b82c5abdcfd5`: strict child check PASS. Fresh remote source checkout resolved 92 relative packet links and the exact map anchor. Reviewed members integrated as files: [context ec114db](https://github.com/passioncode-ai/fabric/commit/ec114dbff42759454b5423f87bab1982b6dced76), [SQL acceptance eff884a](https://github.com/passioncode-ai/fabric/commit/eff884a48645e117065358514aafea7902054fe8), [native initialize 3d68005](https://github.com/passioncode-ai/fabric/commit/3d68005681da77d5d8aee6372f6aeb8be0a8a07e), [Claude events 71a0cc5](https://github.com/passioncode-ai/fabric/commit/71a0cc56e8ca63a3eaf49da1b8d2b15f6f53e2f0). Each member was pushed and exact remote SHA verified; no production sibling pin changed.

Executed: root `node --experimental-strip-types apps/desktop/test/context-privacy.test.mjs` — 7 scenarios PASS; Claude event fixtures PASS; full session-bundle fixture PASS after resolving an isolated worktree dependency link. Root `node apps/desktop/test/run-command-ingress-db.mjs` — 62 real migrations, five acceptance groups PASS, owned cluster cleanup PASS. Native Codex initialize fixture ran against 0.157.1 with isolated profile, denied network/config reads, zero model requests and observed exit 0. Independent reviewers checked the corresponding modules/probes; the normalizer review corrected active-task progress handling and the native review moved version inspection inside the sandbox. Full integration receipt follows its actual run.

What these prove: context byte identity after sanitation; SQL transaction semantics; bounded pure Claude lifecycle interpretation; real Codex initialization framing. What remains: actual provider ownership/coverage, app supervisor and native terminal topology, load/resume ACK, durable recovery, HTTP/MCP ingress acceptance, historical store cleanup, CEO/voice and end-to-end operator pilot. No full release gate is closed. CO-168 remains open. Member topology research is pending on `codex/provider-execution`, not included in this source slice.

Exact next task: resolve the owned provider launch topology in [providers](providers.md), then implement supervisor/control/event composition and native Stop evidence. Keep the preceding unknown-writer barrier in place. The canonical handoff is this packet on the Fabric source branch; member staging worktrees are not separate released implementations.

Integrated `bash scripts/ci.sh fast`: **exit0**, 123 unit/renderer files / 1,401 tests plus registered context composition and Claude event probes. Main TypeScript and all registered build/docs/schema gates passed. Local log `.task-pipeline/build/harness-r0/context-evidence-fast.log`; manual SQL/native receipts are separate above and were not silently counted as fast tests. No runtime source changed after this integrated run. Receipt-only documentation/map is checked before commit. Used skills: task-pipeline (bounded reviewed integration), agent-harness/interop/evals (provider evidence boundaries), evidence-docs (receipt scope), agent-sync (shared lease), maintaining-fabric-workspace (publication).

## Capture recovery and provider topology

Source iteration 2026-09-27; full R0 remains **not accepted**. Members reviewed and integrated: Claude control `5d27a57cebc9f4987e40516b3eb1761ba6d0abcb`; recovery SQL `380d040b87de3f0697a8825d5f4850adcb70af72` plus strict replay fix `e2d41226ab9a0f168106c4ae60545fa3bb9356ed`; topology research `42bf7ba9d7f833e415733b82e79f5d4c3134da2e`; native initialize probe `c8e927ebbfb609773e38c741dc40a498e0fe924d`. Remote SHAs verified by member owners. Root recovery/reader/UX changes are in the same source iteration; no sibling production pins changed.

Executed receipts:
- `node apps/desktop/test/run-transcript-recovery-db.mjs`: **16 groups / 63 actual migrations PASS**, owned Unix-only PostgreSQL17 deleted. Includes concurrency, scope conflicts, lost reply, rollback, @1 preservation, private @2 authorization, strict projector/dispatcher/restore negatives (19 malformed variants), journal-only restore and actual TranscriptStore → createTranscriptRecovery → SQL receipt after lost reply. This is actual SQL, not Supabase HTTP/auth-service acceptance.
- `node --experimental-strip-types apps/desktop/test/transcript-recovery.test.mjs`: **15 boundary scenarios PASS**. Monotonic timeout includes synchronous event-loop starvation; stale receipts never settle; recognized legacy secret refuses before RPC with original spool retained.
- `node --experimental-strip-types apps/desktop/test/transcript-finalization.test.mjs`: **22 checks PASS**; page selected before at most eight body reads, damaged input retained, exact sealed metadata survives retry/restart.
- `node --experimental-strip-types apps/desktop/test/pty-launch-failure.test.mjs`: **PASS**, including actual manager+store regression: exited current session with lost @1 receipt is excluded from recovery, then runtime retry still succeeds.
- `node --experimental-strip-types apps/desktop/test/context-privacy.test.mjs`: **7 scenarios PASS**, compiler revision3; already finalized context bytes unchanged. Root and independent review.
- Focused Vitest `src/shared/digest.test.ts` and `src/renderer/src/DigestSection.test.tsx`: **2 files / 22 tests PASS**, recovered/legacy provenance never fabricates completion or unknown time. Independent review repeated them.
- `node --test scripts/test/memory-workspace.test.mjs`: **16 tests PASS**; partial recovery sample is explicitly a fixture, preserves source identity and leaves runtime state untouched.
- `node --experimental-strip-types apps/desktop/test/claude-provider-control.test.mjs`: **17 scenarios PASS**, including owned Node-pipe compositions. Construct once per canonical Stop from current roster, not once per agent launch. No native Claude quiescence evidence.
- `node apps/desktop/test/codex-loopback-native.test.mjs`: **PASS**, repeated by independent reviewer on Codex0.157.1 / Node26.8.2. Absent/wrong tokens HTTP401; two initialized clients with the same request ID receive their own response/version marker; exact temporary profile; server survives view disconnect, owned process exits0. No thread/turn/resume/model calls. Sandbox restrictions inspected; forbidden access was not separately attempted.
- Direct TypeScript node/web checks: **PASS**. `node scripts/check-scope.mjs`: **PASS**, 7 raw queries / 50 projector statements.

Review findings fixed: null identity/wrong schema replay, page starvation, reading all bodies before paging, absent receipt metadata checks, replacing invalid sealed start with sidecar time, timer-only deadline, recovery stealing a pending runtime finalizer's spool, missing compiler revision increment. The initial generic password fixture did not match the documented recognizer; changed it to a recognized named token fixture. No claim that arbitrary secret text can always be detected.

Initial integration checks refused stale mockup coverage, missing changelog anchor, JSX gate ambiguity and event registration formatting. These require repair and a complete fast rerun; preliminary failures are not a passing gate. The missing `check-docs.mjs` attempt executed no check; canonical `pnpm gates:docs` is used instead.

Handoff objective: [ADR-0073](../../adr/0073-recovered-transcripts-do-not-prove-process-ending.md) and [recovery module/rollout packet](recovery.md). **Next native task:** [topology proposal](provider-topology-proposal.md), exact native TUI attachment/execution ownership without silently treating view exit as backend termination; then actual writer inventory, load/resume and provider Stop acceptance. No live schema rollout, app release, complete Electron walkthrough, actual model execution, CEO/voice acceptance or cross-provider continuation is claimed. CO-168 remains open.

Browser review through the real generated page: map → two-project fixture → Memory → after-crash sample → source → attach to Fabric. Observed unknown end/exit, separate sample capture time and an attached source in the same floating conversation. Screenshot inspected; no clipping in the inspected desktop layout. An initial empty-memory visit left scope empty after adding a first Project; initialization now selects the first valid scope once and preserves a later deliberate empty selection, with regression. This is a local prototype walkthrough, not native Electron or production auth acceptance.

Final privacy review reproduced a legitimate sealed excerpt whose 1500-character head clipped a canonical redaction marker. Recovery now verifies its exact derivation from the already checked body using the same producer function; arbitrary excerpt/annotation values still pass independent secret checks. The actual TranscriptStore positive and unrelated secret-bearing metadata negatives pass without rewriting the sealed body, excerpt or hash. The first complete fast run passed; the source correction requires a fresh integrated run before delivery. The reservation regression also required moving the still-unexecuted pipeline reservations past migration63/ADR73; ADR74 was reserved through the shared allocator, never fabricated.

Final integrated `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast`: **exit0**, `fast tier green`; 123 unit/renderer files / 1,403 tests plus registered pure, native-owned-pipe and transcript fixtures, including all 15 recovery scenarios. Log: `.task-pipeline/build/harness-r0/capture-recovery-fast.log`. Independent final review reran the 15 scenarios and found no remaining concrete issue in this bounded recovery delta. Direct DB/native-provider receipts remain separately scoped above; the full Supabase-stack tier did not run. Only receipt documentation/map changes follow this passing code run and receive canonical docs gates.

Actual skills used for this slice: task-pipeline (bounded implementation, independent review and delivery), agent-harness/orchestrator/interop/evals (execution versus capture evidence and provider boundary), super-ux (SCN-036/FLW-31/SCR-31/34), copywriting (explicit unknown-ending labels), evidence-docs (commands and limits), agent-sync (lease and ADR reservations), maintaining-fabric-workspace (source/report publication). Existing visual tokens are reused; no new visual system or full-release acceptance is claimed. Pending follow-up member work: `codex/codex-tui-startup-probe` has native TUI preflight `fb063cae002c3327411f4b4602a929277e217eb1` and a bounded message-gate draft; toolchain verification is a separate isolated packet on `codex/release-toolchain-pin`. Neither is integrated by this capture-recovery iteration.


## Schema admission and toolchain

Integrated member packets: startup consumer `5d8f3172432cde86c9b99fe403830c57658acb98` on `codex/startup-schema-readiness`, producer `6fa3953b93ed8a29687b20d519f7ebadec4cb131` on `codex/release-toolchain-pin`. Both remote identities were verified; source integration is this iteration, not a main merge or packaged release. [Admission contract and next task](release-admission.md) is the single entry.

Executed focused checks:
- `node --experimental-strip-types apps/desktop/test/schema-readiness.test.mjs`: 10 scenarios PASS, root and independent review. Includes existing JSON `null` refusing startup instead of becoming the development fallback; bounded fresh schema reads and no domain callback after refusal.
- `node --test scripts/test/toolchain.test.mjs scripts/test/build-identity.test.mjs`: 8 tests PASS, root. Strict refusal precedes the package command; malformed contracts cannot emit an apparently verified manifest.
- Member shared Vitest: 50 tests PASS; node/web TypeScript PASS. These focused member receipts do not replace integrated checks.
- `node --test scripts/test/first-release.test.mjs`: 40 tests PASS after attach-level repair. Blocked examples refuse domain actions and hide chat; Retry cannot grant admission.
- Actual root `node scripts/check-toolchain.mjs` with an explicit already installed matching pnpm executable: verified. Default PATH pnpm differs; no implicit install or version switching is counted as verification.
- Member two clean output-directory builds: 191 files each MATCHED, exact receipt [toolchain-comparison.json](toolchain-comparison.json). One checkout and one installed dependency tree only; clean-install/native-package/signing checks not run.

Local browser walkthrough: setup → review tools → startup examples → older database → Retry. Observed the same failure and no agent/chat entry after Retry. The inspected desktop screenshot uses existing components; this is an explicit prototype fixture, not native dialog or live database acceptance.

Integrated fast/documentation/publication checks are pending at this point. The previous capture-recovery publication receipt covers only source `a6ae3d3ce374e154e86a8d7aee07ca7facabae5e`, not this delta. Pending independent native work remains on `codex/codex-tui-startup-probe`; it is not integrated or accepted by this startup packet. CO-168 remains open.


Root repeated `scripts/compare-bundle-builds.mjs` with the explicitly installed matching pnpm: **MATCHED**, 191 files each, artifact `ba4173d2da909695fee0805c3c689ccd77619576220876194bf6093f678deddd`, profile digest `445599ed674da55a9d4d53f80ae719d1ed3878ea1839d12fc1d8c959a39c62b6`. [Integrated receipt](integrated-bundle-comparison.json) preserves dirty-source and one-installed-tree limitations. This does not establish native packaging or signing.

The initial integrated `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` passed (123 files / 1,405 tests plus registered pure fixtures). Independent attach-level review then found a prototype-only delayed Stop callback could mutate history after switching to a refused-startup example. The source correction and a complete new fast run are required; the earlier green result is not the final receipt. No native runtime bypass was found in that reproduction.


Independent review correction is now integrated: startup example generations fence timers, folder-picker and clipboard completions, including refused→ready; disposed handlers and direct events cannot mutate the prior example. Blocked rendering skips domain initialization. Root inspected the delta and ran `node --test scripts/test/first-release.test.mjs scripts/test/chat-workspace.test.mjs`: **53 tests PASS**, including 40 first-release tests. No other concrete integration blocker remained in the independent review. Final generated product/coverage and 98 previews are rebuilt from this source.


Final integrated `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast`: **exit0, fast tier green**, 123 unit/renderer files / 1,405 tests plus registered pure fixtures, including the 10 startup scenarios and toolchain tests. Log: `.task-pipeline/build/harness-r0/schema-admission-final-fast.log`. Prototype final focused suite: 53 tests PASS. Full stack-backed, native packaged application and hosted CI were not run. After this run only receipt/module-index documentation changes receive the canonical docs gates; no runtime source changes. Final browser replay of the rebuilt artifact again confirmed old-schema refusal and a retry retaining the same cause.

Actual skills used in this slice: task-pipeline — bounded implementation/review/delivery; super-ux — startup scenario/flow/model; copywriting — refusal and retry labels; evidence-docs — scoped build/test receipts; agent-sync — shared lease and handoff; maintaining-fabric-workspace — generated artifacts/publication. Agent-stack continues the separately owned native protocol probe; that pending packet is not a completed capability of this source iteration.


## Private conversation and original HTTP input · 2026-09-27

Baseline source/publication: `8dde15bff86b4f20d2edb5bdaa1159fa27a9cd9c` /
workspace `02c6372a5d45e8050d1c3f9f02bad27396aad0f8`, release91, parent pin
`a6df03d4d55697cbdd5bf63c84f7be8d3358b187`. That publication is verified; the
following is the next source iteration, not native/product release acceptance.

- Reviewed [HTTP/MCP member f5b5417](https://github.com/passioncode-ai/fabric/commit/f5b54170b0e949afec7b32152af447d61c3d1498):
  `node --experimental-strip-types apps/desktop/test/agent-http-ingress.test.mjs`
  **10 owned transport scenarios PASS**, root repeated; actual HTTP listener/MCP
  client/ops file, fake SQL storage. Original text is cleaned before caps and
  authority references refuse before normalization/query. Exact receipt/digest
  identities remain intact. Existing `desktop-ingress.test.mjs` also PASS.
- [Conversation contract member 636e003](https://github.com/passioncode-ai/fabric/commit/636e003a2bc47c2eba323a9416d79b448eeb4b38)
  supplied measured source seams and bounded implementation packets. Root resolved
  the architecture in [ADR-0075](../../adr/0075-private-ceo-content-and-opaque-journal-receipts.md):
  private per-Person/subject content, opaque journal receipts, mandatory private
  backup before activation. No full conversation runtime is claimed by that ADR.
- Root generic-store test invokes the actual `createScopedStore` for Estate and
  Project scopes: private tables refuse select, empty/nonempty selectIn, insert,
  update and delete **before query construction**. Focused Vitest filter PASS
  (one test executed, eighteen unrelated tests skipped); full scope inventory
  awaits the allocated migration integration. Desktop node/web typecheck PASS.

Open member work at this receipt: `codex/ceo-conversation-contract` storage64,
`codex/local-state-private-guard` local draft prerequisite, and
`codex/codex-tui-startup-probe` native view test. No sibling production pins changed.
Exact current integration receipts below supersede these pending statuses only
when committed and checked. Full CEO, voice, owner backup, native execution
ownership/load/resume/Stop and operator acceptance remain open.


Integration receipt: storage member **10b6fefde71d630ffe2c350d0f0b8a9408476866**
and local-state member **b6ec455cb07a0928d720b0277bad31aab586c355** are integrated.
Root independently reran full64 PostgreSQL **12 groups+schema RPC64+cleanup PASS**,
localState **22 filesystem/ops checks PASS**, pure CEO contract PASS, schema readiness
**10 scenarios PASS**, and scope/archive/storageContract **52 tests PASS**.
Independent storage/root privacy review: no blocking finding, pure preparation and
scope/archive **33 tests PASS**; reviewer did not claim a second SQL run.
Fixed wire-byte and whitespace parity, deep invalid-input and safe-integer issues
were identified during review and repaired before integration. The admitted build
range is64–64; no live migration was applied. Native service/IPC/UI and owner backup
are next; storage alone neither executes the CEO nor closes CO-168.


First integrated fast run refused the new message→conversation foreign key because
it named only the ID. Root strengthened the migration to bind conversation ID,
Estate and Person together, and added actual privileged-insert negatives for both
wrong Estate and wrong Person. `node scripts/check-references.mjs` PASS (nine
composite Estate references); the gate was not weakened or bypassed. Final full
SQL and fast results follow; an earlier pure/SQL pass does not replace this rerun.


Final SQL rerun after the composite FK correction: **12 groups + actual schema64
RPC + cleanup PASS**, including both privileged wrong-audience insert refusals.
The first negative run caught a missed text replacement (constraint absent), which
was corrected before the passing run. The static reference counter recognizes its
older two-column pattern; the three-column CEO constraint is proved by these real
SQL failures rather than by that count. One concurrent fast attempt saw the source
change and refused the stale map stamp; the final source is restamped and rerun.


Final integrated check: `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` **exit0**,
including **123 Vitest files /1407 tests**, registered HTTP/MCP and CEO pure checks,
local state, startup/schema, build, document/register/UX/report and planted
regressions. The unexecuted pipeline reservation now explicitly cites migration64;
its previous stale-inventory failure was corrected and the original check passed.
The stack-backed full suite was not run by fast; the owned full64 PostgreSQL run
above is separate evidence. Default build manifest honestly reports toolchain
unverified because default pnpm differs; `check-toolchain.mjs` with the explicitly
installed pinned pnpm **PASS**, profile `darwin-arm64-node26-local`, digest
`445599ed674da55a9d4d53f80ae719d1ed3878ea1839d12fc1d8c959a39c62b6`.
This is version verification, not native package reproducibility/signing.

Narrow independent follow-up confirms the final composite FK and both actual
negative assertions, without claiming another DB run. Local map entry was reloaded
and its schema64/storage-versus-activation text inspected through the browser.
Final receipt-only edits are checked again with documentation/map gates before
source commit. Exact next work remains service/drafts→trusted IPC→UI/private
backup and, independently, reviewed native view→execution ownership/load/Stop.


## Native view and private send service · 2026-09-27

Source base `b18b337caebac2963d5289fec6a3ccfff42aa73f`. This is a new implementation
iteration, not a product release. Previous private storage source
`796f6e186c97d63726b71d0c760429dd46bf1414` was published as workspace
`c25f666bf79da9f24076be1f9d961b3c7c9c5326`, release 92; strict verification found
875 matching files, both remote heads matched, and a fresh source checkout checked
172 relative harness links plus the exact map anchor. That receipt does not cover
this delta.

Native members `fb063cae002c3327411f4b4602a929277e217eb1`,
`24a062ada6fdfd3c7e1461b6aeac57b2cc25c6c8`,
`f6ea59767e8e3277ab3140dc54cd01b4afa360e8` are reviewed into root. The
[member receipt](../../../apps/desktop/test/reports/codex-tui-native-01571.md)
records one actual isolated Codex 0.157.1 empty-view lifecycle with zero inference;
root did not rerun that native provider. Root reran the actual 14-group pure policy,
26 WebSocket groups and three owned PTY fixtures. Only the pure policy joins the
fast/default suite. Native tests retain explicit manual containment and test-only
dependencies; they are not silently activated by CI.

Production view ownership, native Stop/load/resume, private send-service acceptance
and integrated source/publication gates are still pending at this entry. Subsequent
receipts below supersede only the explicitly measured parts. CO-168 stays open.


Service member `85b78459684ce9b3185c7303e9e9b446698cbd7d` integrated after fixes from
independent review. Root reran **22 actual-filesystem service groups + draft
contract PASS**. Root added `ceo-conversation-service-db.test.mjs` to the owned DB
runner: **12 existing SQL groups across64 migrations +5 real service/SQL groups +
cleanup PASS**. Initial composition's revocation fixture attempted to remove the
only Estate owner and correctly failed; retaining another test owner fixed the
fixture. No production constraint was weakened. Desktop node/web typechecks PASS.

Corrections include blank draft persistence; UUID edit identity against late ACK
ABA; stale first-attempt refusal cannot settle a newer uncertain attempt; explicit
cache cleanup cannot discard unresolved sends; atomic-write disk headroom is
checked before mutation; bounded32 in-flight requests; contiguous history and
complete cursor validation. IPC/history discovery must still let users find old
saved drafts and terminal records when local capacity fills. No model dispatch or
UI activation is inferred from durable acceptance.

Next task: trusted identity/static RPC and typed IPC integration, then owner-private
portable recovery and actual chat entry/cold-restart acceptance. Native next task:
review the separate exact-owner/native-view coordinator, then real provider
ownership/load/Stop. Pending member branches are `codex/native-view-lifecycle`
plus `codex/ceo-private-archive` and `codex/ceo-conversation-host`; they are ongoing
member work, not integrated in this source iteration or production submodule pins.
Full fast and this iteration's source/publication tuple follow after final checks.


Independent final service review on member85b7845 repeated22 actual-FS groups and
draft validation with no remaining blocking finding in the bounded core. First
root fast run correctly flagged hand-written reconstruction of a Person actor.
Root now preserves the validated data-only actor from the trusted identity port
and imports the existing LOCAL_OPERATOR_PERSON constant; it does not define a
second producer or change the gate. `check-actor.mjs` passes. The final focused
service/SQL and fast runs below cover that integrated adjustment.


The next fast attempt required explicit diagnostic handling for eight private
service catches. They already return fixed typed failures to their caller; comments
now state why raw private input/transport/filesystem error text must not be copied
into operations logs. `check-ops.mjs` passes without exclusions or new raw logging.
After the actor integration fix,22 service groups and12 SQL +5 composition groups
passed again, including owned database cleanup. These focused receipts do not
replace the final full-fast run.


Final integrated `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast`: **exit0**,
**123 Vitest files /1407 tests**, plus registered draft/service22 groups and pure
native-policy14 groups, build, actor/ops, documentation/register/UX/map gates and
planted regressions. The native WebSocket26/PTY3 fixtures and actual12+5 SQL checks
remain separately measured above. No hosted suite was dispatched; no live DB or
provider account was changed. Independent follow-up accepted the validated actor
copy/central constant adjustment. Local browser rendered the new map anchor and
its exact limitations; receipt-only final docs are restamped and checked before
commit.

Actual skills in this iteration: task-pipeline — bounded packets and integration;
agent-harness/orchestrator/interop/evals — execution versus view and acceptance
boundaries; evidence-docs — measured receipts and limits; agent-sync — shared
lease/journal; copywriting — concise map status; maintaining-fabric-workspace —
source-linked publication. No new visual design or product screen was shipped.
The exact next task is the trusted conversation host/IPC producer plus reviewed
native-view owner binding; private archive mapping is designed before its new
migration. The full release goal remains active.


## Native host and view lifecycle · 2026-09-27

Previous publication strictly verified: source193d9f57f74c5ce756b8d62b20878a82da716d33,
workspace6c10c5517fb09db921268480006d321423ae56a3, parent1e532897a13438997644df29791ae9dfa135f184,
release93. `workspace.mjs check --require-child`:876files, child verified. Parent and
child remote refs match; fresh remote source checkout resolved194 relative handoff
links and the exact previous map anchor.

This iteration integrates reviewed native lifecycle member
[76bff86](https://github.com/passioncode-ai/fabric/commit/76bff866f1a51dbfe65e2c491f405053dbd57c00),
trusted HTTP host member[80e907a](https://github.com/passioncode-ai/fabric/commit/80e907a0f7a92bb110c73fe36c16ee7a01231f58),
and proposed archive contract[593f3a3](https://github.com/passioncode-ai/fabric/commit/593f3a393b10f68e977bbc137021b0394cb1ebef)
+[cfb6c77](https://github.com/passioncode-ai/fabric/commit/cfb6c77930224b606b1b7ed29a3ca3b2a00e07d7).
No production provider descriptor, index binding, UI or schema capability changes.

- `node --experimental-strip-types apps/desktop/test/native-view-lifecycle.test.mjs`:
  **19groups PASS**. Actual imported module with owned-handle fixtures, not native PTYs.
  [Lifecycle contract and concrete next port](../../../apps/desktop/test/reports/native-view-lifecycle.md).
- `node --experimental-strip-types apps/desktop/test/ceo-conversation-host.test.mjs`:
  **11 actual HTTP groups PASS**, including write-edge timeout regression and one
  uncancellable underlying guard across timeout waves. Root repeats independent review.
  [Host contract](ceo-conversation-host.md). No TLS/database/model call in this receipt.
- `node --experimental-strip-types apps/desktop/test/ceo-conversation-service.test.mjs`:
  **22 actual local-FS groups PASS**, owned directories removed.
- Ops/actor gates PASS after comments explicitly identify typed errors and private-data
  logging exclusions. No assertion/baseline waiver and no raw error logging added.
- `python3 test/audit_regressions/fix-pf-06.03.py`: **PASS** after reserving ADR77/78
  with agent-sync and moving only unexecuted pipeline positions to66/67. Actual schema
  remains64; A0 migration65 is reserved, not part of this integrated source.

Review found the service's delayed identity read could permit a write after the total
operation deadline. Root rechecks deadline after that read; actual HTTP regression
now observes zero writes. The host bounds the otherwise uncancellable existing guard
without introducing identity caching or duplicate underlying requests. View close,
view input uncertainty and execution Stop retain separate identities and receipts.

Archive review found owner grants can be recreated by legacy restore/replay. New
[ADR-0077](../../adr/0077-restored-history-does-not-grant-membership.md) makes the A0
repair a mandatory prerequisite; [private archive](ceo-private-archive.md) remains a
proposal. The source inspection is confirmed by a separate pending member regression,
not a claim that this iteration has fixed SQL. Existing unmarked restores need explicit
reconciliation; never fabricate markers or revoke historical memberships automatically.

Exact next work: concrete view-only PTY host and owned backend record; actual HTTPS
host acceptance then IPC/composition; A0 restore-authority migration before private
archive commands. Pending branches: `codex/restore-authority-boundary` and the separately
reported concrete native-view/TLS member branches. Do not promote a provider capability
or expose incomplete CEO dispatch from these internal modules. CO-168 stays open.

Local logs: `.task-pipeline/build/harness-r0/native-host-http.log`,
`native-view-lifecycle.log`, `native-host-service.log`, `native-host-types.log`.
Full-fast/source/publication receipts are appended only after their commands finish.


TLS follow-up member[9d016bd](https://github.com/passioncode-ai/fabric/commit/9d016bdd2712727d3b764638207315a5fd45518d)
is reviewed and integrated in this source. Root independently ran
`node --experimental-strip-types apps/desktop/test/ceo-conversation-host-tls.test.mjs`:
**5 actual localhost TLS groups PASS**, all socket/server/temp-CA/private-key cleanup
verified. Unknown certificate chain and wrong hostname refuse before any HTTP write;
per-child extra CA succeeds; authority loss during actual delayed TLS refuses at
secureConnect; a hung handshake stays bounded. No production trust/SDK settings or
external network changed. Manual OpenSSL prerequisite remains explicit; these5groups
are not silently added to default fast. [Exact receipt](../../../apps/desktop/test/reports/ceo-conversation-host-tls.md).
Next chat integration still requires database-through-HTTP, trusted IPC and worker.


Integration gates caught a blank line splitting the ADR table; repaired the table.
The name-based written-field ratchet now sees `runOrdinal` in the native view owner
validator and removes `TaskRun.runOrdinal` from its unread-name baseline. This is
not proof that the TaskRun UI/production binding consumes it: the gate matches
property names across the tree. Concrete Run-to-view host binding remains the
explicit next task; no capability status is promoted by the baseline reduction.


Final integrated `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast`: **exit0**,
**123 Vitest files /1407 tests**, registered19 lifecycle +11 actual HTTP +22 service
and other focused groups, build, docs/map/register gates and planted regressions.
Main/web TypeScript also passes. Generic build truthfully reports toolchain unverified
under the default pnpm executable; this is not a strict packaged-release receipt.
The5TLS groups remain the separate measured manual receipt above. Final receipt and
handoff-only documentation is restamped and checked before source commit.

Pending exact next SQL packet is now pushed and independently reviewed:
[bea5c064](https://github.com/passioncode-ai/fabric/commit/bea5c064882695ee15e21b7db50d65b10aef9b5a),
branch `codex/restore-authority-boundary`. It is **not integrated in this source**.
Next root task: integrate65 plus explicit schema/readers/storage classification,
repeat full-chain actual SQL checks and preserve the visible prior-restore limitation.
Concrete PTY port implementation continues on `codex/native-view-host`; it is not
production wiring or a sibling pin update. The release goal remains active.

Actual skills: task-pipeline — bounded delivery/review; agent-harness/orchestrator/
interop/evals — lifecycle, identity, transport and acceptance boundaries; evidence-docs
— source/command receipts; agent-sync — lease and ADR allocation; copywriting — map
status; maintaining-fabric-workspace — immutable publication. No new visual design or
product screen is shipped in this iteration. Local browser rendered the exact changed
map anchor and its implementation limits.

## Restore boundary and native PTY · 2026-09-27

Objective: integrate reviewed A0/65 and the concrete view-only host without
promoting provider execution, replayed access or private chat dispatch.

### Source packets and applied changes

- [A0 member bea5c064](https://github.com/passioncode-ai/fabric/commit/bea5c064882695ee15e21b7db50d65b10aef9b5a)
  and [native compatibility review 0f4d7fc](https://github.com/passioncode-ai/fabric/commit/0f4d7fc3164a051ff639baedb412057e1a7fc958)
  are integrated as cf55330/21b3f93. [Restore authority](restore-authority.md) names
  the actual SQL, ownership limits and proposed usable-destination flow.
- [Native PTY host47d3e73](https://github.com/passioncode-ai/fabric/commit/47d3e73a1c92682be2a2ae28cf156bdece47bf58)
  is integrated as6efe3ce. [Host receipt](../../../apps/desktop/test/reports/native-view-host.md)
  pins macOS/node-pty1.1.0, immutable recipes and private fd identity. A local
  process-group observation is not provider quiescence or all-descendant proof.
- Root classifies `estate_restore_boundaries` as a protected primary table in
  [scope](../../../apps/desktop/src/shared/scope.ts),
  [mirror coverage](../../../apps/desktop/src/shared/storageContract.ts) and
  [archive inventory](../../../apps/desktop/src/shared/archive.ts). Generic
  select/insert/update/delete and empty/nonempty `selectIn` refuse it. It is
  retained across replay but never copied from an ordinary archive.
- [Schema contract](../../../apps/desktop/src/shared/schemaContract.json) now
  admits65–65 only; schema64/future66 cannot reach domain startup. The migration
  is in source and isolated fixtures, **not deployed to an operator database**.
  Unexecuted pipeline reservations remain66/67/ADR78.

### Focused integration receipts

Root ran these against the integrated working tree:

```sh
node --experimental-strip-types apps/desktop/test/schema-readiness.test.mjs
node --experimental-strip-types apps/desktop/test/native-view-host.test.mjs
pnpm --dir apps/desktop exec vitest run src/shared/scope.test.ts src/shared/archive.test.ts src/shared/storageContract.test.ts
pnpm --dir apps/desktop typecheck
```

Results:10 readiness groups;14 actual PTY groups with owned process/group/temp
cleanup;3 Vitest files/52 tests; main and renderer TypeScript — **PASS**.
The PTY checks use only disposable local Python fixtures, not a model or the
operator's provider profile. Manual native prerequisites are explicit through
`test:native-view`; they do not silently turn a Linux fast run green.
Local logs: `.task-pipeline/build/harness-r0/restore-native-view.log`,
`restore-inventory.log`, `restore-types.log`.

Independent SQL integration used only self-owned clusters:
`node apps/desktop/test/run-transcript-recovery-db.mjs` —16 groups/full65;
`run-managed-launch-db.mjs`, `run-managed-stop-db.mjs`, `run-dispatch-db.mjs` —PASS.
After explicit65 expectations, `run-ceo-conversation-db.mjs` —12 storage +5 service
SQL groups PASS; `run-restore-authority-db.mjs` —11 groups PASS. All owned clusters
were stopped and removed. A pre65 restoration remains visibly unmarked; applying65
does not automatically revoke rights or fabricate historical restore provenance.

### Findings and acceptance still required

The older direct node-postgres restore fixture exposes a compatibility issue:
PostgreSQL `bigint` arrives as a decimal string, while initial A0 validation only
accepted a JSON number. This is a real historical-consumer input shape; silently
changing the fixture alone would hide it. The correction must accept a strictly
canonical positive decimal string or integer number within the safe bound,
normalize both to the same bigint marker and preserve strict sequence order.
Negative cases must still reject malformed/unsafe strings. Correction [d9f14be](https://github.com/passioncode-ai/fabric/commit/d9f14be7e61fab446da871bf7c55838f38493014)
is integrated as3946312. Root reviewed the narrow type predicate and strict
canonical/bounded negative corpus. Author actual A0 now12 groups PASS; the
unchanged `packages/schema/test/restore-disposable.test.mjs` passes8 checks and
`membership-roles.test.mjs` passes10 checks in an explicitly owned PostgreSQL17
cluster, with no TCP listener and full owned cleanup. Root reruns the integrated
A0 runner separately; no historical migration56/59 was modified.

No production archive restore UI is currently wired. `backup.restore()` reports
journal restoration, not membership/readiness; native services are still scoped to
ORG1. The [proposed atomic wrapper](restore-authority.md#native-compatibility-follow-up--2026-09-27)
requires a current independently established owner, new target, destination access
postcondition and explicit active-Estate selection. This is the next bounded
restore implementation; a failed membership lookup must not create ownership.

Next native work: derive backend ownership from an actual owned process and trusted
admission, then bind a measured provider connection; never let a renderer construct
the owner or launch recipe. View close remains distinct from observed execution
Stop. Next chat work: actual host→HTTP→SQL composition, then trusted IPC, portable
private recovery and worker. Pending members `codex/native-view-host` follow-up and
owned host/SQL test work are not production pins or accepted runtime capabilities.
Voice, new-user/return/continuation flows and full R0 operator acceptance remain
required; CO-168 is open. Existing plans and postponed ideas remain intact.


Full-fast initially caught four catches in the concrete PTY host without stated
observability behavior. Root documented their existing typed-refusal, sticky
owner-loss and exact-compensation paths; raw provider output/errors stay out of
operations logs. `node scripts/check-ops.mjs` now passes. No gate was weakened.

Root independent integrated A0 rerun: `node apps/desktop/test/run-restore-authority-db.mjs`
—12 groups/full65/cleanup PASS. The final canonical-string correction was also
independently rerun and accepted by the second reviewer. Log:
`.task-pipeline/build/harness-r0/restore-authority-db.log`.

Integrated `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` —exit0,
123 Vitest files/1407 tests; registered focused suites, build, docs/map/register
and planted regressions PASS. The generic build reports schema65–65 and
**toolchain UNVERIFIED** under the default pnpm executable; no signed package,
production migration or native provider capability is attested by this result.
Log: `.task-pipeline/build/harness-r0/restore-fast.log`.

Actual skills: task-pipeline — bounded delivery; agent-harness/orchestrator/interop/evals
— ownership, transport and capability boundaries; agent-sync — shared lease;
evidence-docs — actual SQL/native receipts; copywriting — map status;
maintaining-fabric-workspace — source-to-publication handoff. Browser inspection
rendered the exact new map anchor with the unfinished runtime work visible.

## Branch consolidation and backend process registry · 2026-09-27

Objective: one branch holding every current result of the parallel wave, nothing
lost, and a plan that states where R0 stands. [Consolidation record](../../evidence/plans/2026-09-27-branch-consolidation.md)
names every branch, tag and measurement; the updated route is in [README](README.md#передача)
and [development order](development.md#after-consolidation--2026-09-27).

### What was integrated

- [Owned backend process registry](../../../apps/desktop/test/reports/owned-backend-process-registry.md)
  was an untracked member packet, present on no branch. Now in source as an
  isolated main-only module: nothing imports it, the provider is `NOT_BOUND`, the
  pipe adapter is pinned to Darwin/Node 26.8.2 and refuses to construct elsewhere.
  Not activated and not a provider or Electron receipt.
- [ADR-0079](../../adr/0079-private-conversation-archives-preserve-history-not-authority.md)
  accepts the private archive format and the atomic control-owner destination.
  Migration slot 66 is allocated, not applied; the runtime schema contract stays
  65–65. Pipeline reservations moved to 67/68/ADR-0080.

### Receipts

```sh
node --experimental-strip-types apps/desktop/test/owned-backend-process-registry.test.mjs
(cd apps/desktop && ./node_modules/.bin/tsc --noEmit --strict --target ES2022 --module NodeNext \
  --moduleResolution NodeNext --allowImportingTsExtensions --skipLibCheck --types node \
  src/main/ownedBackendProcessRegistry.ts)
```

The suite is registered as the manual native run `pnpm --dir apps/desktop run test:native-backend`,
beside `test:native-view`; `ci.sh fast` does not run it, because it spawns real
processes and the adapter refuses any platform but Darwin/Node 26.8.2.

Results on the consolidation base `ea1dfda`: 17 groups PASS with owned groups
empty and the fixture removed; `tsc` exit 0. Planted defect — an authority change
returns `false` without fencing the owner — was watched failing group 6 ("owner
loss before pipe write is sticky") with `AssertionError`, exit 1; the source was
then restored byte-identical.

Integrated `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` first **failed**, exit 1:
`check-ops` found eight `catch` blocks in the registry that neither recorded nor
explained their silence — the member packet had run only its focused checks. Each
block is fail-closed (refusal, or `outcome_unknown` with the reason in the
snapshot); each now says so in a comment. No behaviour change: the registry test
again 17 groups PASS and `tsc` exit 0. The module is not wired into the app, so
adding an `ops` sink here would have been a behaviour change outside the packet.
Rerun: exit 0, 123 Vitest files/1407 tests, `ops` 188 catch blocks each recording
or explaining, map, docs and registers PASS. The build reports schema 65–65 and
**toolchain UNVERIFIED** under the default pnpm executable; no signed package,
migration or provider capability is attested. Log:
`.task-pipeline/build/harness-r0/consolidation-fast.log`.

### Not integrated, preserved

`archive/wip/ceo-private-archive-codec` (codec, no tests) and
`archive/wip/ceo-private-archive-sql` (migration 66, no SQL check) are the A1
starting point. Neither may land before ADR-0079 §5's golden vectors and negative
corpus exist; see the next task in [README](README.md#передача).

## Owner-private archive SQL · 2026-09-28

Migration `20260927000066_ceo_private_archive.sql` with schema admission 66–66 (first-slice plan
A1-2…A1-5, ADR-0079). All database runs used owned PostgreSQL 17 clusters; the operator's local
Supabase (`supabase_db_fabric`) was stopped and was not started or touched.

| Command | Result |
|---|---|
| `pnpm --dir apps/desktop test:archive-db` | PASS — three suites, one owned cluster: migration 66 base (7 groups), `restore_estate_verified` (6 groups), private export, import and receipt (6 groups across 7 databases) |
| every `apps/desktop/test/run-*-db.mjs` and `run-ceo-host-sql.mjs` (9 runners) | PASS on the 66-migration chain; the four suites that pinned 65 now read `schemaContract.json` |
| `packages/schema` `restore-disposable`, `membership-roles`, `link-concurrency` against an owned password-protected loopback cluster | PASS, all green |
| `packages/schema` `planted` against the same cluster | NOT_RUN — stalled after its SQL probes waiting on a service the bare cluster does not provide; it runs in the full tier with the stack |
| `pnpm --dir apps/desktop test`, link by link | 66 PASS; 12 NOT_RUN because they need the local stack (`policy`, `operating-surfaces`, `workspace`, `runtime-observer`, `routine-tick`, `chain`, `run-lifecycle`, `backup-restore`, `identity`, `task-link`, `membership`, `insight-category`) |
| `pnpm -r typecheck` | PASS |

Planted defects watched failing, per packet, are recorded in the
[plan](../../evidence/plans/2026-09-27-first-slice-plan.md#a1-2--migration-66-base-and-privileges) and the
[verification ledger](../../evidence/verification.md#a1-2a1-5--migration-66-verified-restore-private-export-and-import).
No native file, IPC or UI path exists yet (A1-6).

## Electron main runtime · 2026-09-28

First-slice plan E0. `apps/desktop/test/electron-main-runner.mjs` imports one suite inside a real
Electron main process (no window; `process.type` `browser`).

| Command | Result |
|---|---|
| `ELECTRON_RUN_AS_NODE=1 electron -e 'process.versions'` | Electron 44.0.0, Node 24.18.1, libuv 1.52.1, modules 149, darwin arm64 |
| `FABRIC_BACKEND_NODE=<node> electron test/electron-main-runner.mjs test/owned-backend-process-registry.test.mjs` | PASS, 17 groups |
| `… electron-main-runner.mjs test/native-view-host.test.mjs` | PASS, 14 groups; node-pty 1.1.0 N-API prebuild, no rebuild |
| `… electron-main-runner.mjs test/runtime-admission.test.mjs` and the same under Node 26.8.2 | PASS; Electron as Node refused, registry refuses to construct there |

Code binaries hashed for `MEASURED_RUNTIMES`: `Electron Framework` `3e7bf674…e38c` (201 MB, 0.38 s),
`libnode.147.dylib` `88ff1063…b3d3`. NOT_RUN: the packaged, hardened app (N1).

## Host → HTTP → SQL composition · 2026-09-28

First-slice plan C0. `pnpm --dir apps/desktop test:ceo-host-sql` (registered beside
`test:ceo-db`; runner `run-ceo-host-sql.mjs`) on `main` after migration 66: **PASS, 7 groups**
— the real conversation host, an owned HTTP bridge and the full 66-migration chain on an owned
PostgreSQL 17, then clean shutdown of the server, sockets and cluster. The HTTP server is a test
fixture: not PostgREST, not authentication, not production wiring.

This supersedes the "next: SQL-through-HTTP composition" and "database-through-HTTP" lines in the
dated sections above (2026-09-27); those sections stay as written. What the chat still lacks is
typed IPC and the main-side binding (C1–C4).

## Private history service in main · 2026-09-28

First-slice plan A1-6a. `pnpm --dir apps/desktop test:archive-db` now runs four suites on one owned
cluster; the new `private-history-native-db.test.mjs` passes 5 groups: the real `backup.take` over a
psql-backed journal read, `ceo_export_private_archive`, the codec's decode and three private files;
a restore into a second database with the restore reply lost and then the import reply lost, each
resolved by the same operation; refusals with zero rows. The operator's local stack was not used.

## Codex thread over the owned loopback backend · 2026-09-28

First-slice plan B2b-3. `pnpm --dir apps/desktop test:codex-loopback-thread` on the installed
`codex-cli 0.157.1`, Darwin arm64: the actual owned backend registry starts `codex app-server`
from `codexLoopbackRecipe` with a per-backend token digest; the port comes from the backend's own
stderr receipt; Fabric's loopback client initializes and starts one thread. No turn, no model, no
account, no operator configuration.

| Run | Result |
|---|---|
| Node 26.8.2, three runs | PASS each: thread id a UUID, session id present, notifications `remoteControl/status/changed` and `thread/started`; wrong token `unauthorized`; a request revoked after `request()` returned `effect_fenced`; binding without a turn `codex_thread_turn_required`, a foreign thread `foreign_thread`; a reconnect is a new writer |
| Electron main (Node 24.18.1), one run | PASS, same facts |
| Backend exit after `SIGTERM` | exit code 0 each run; process group `unknown`; **one descendant in its own session** (a shell), which ended on its own each run; no process left afterwards |

The descendant is the finding: a group-wide Stop does not reach it, so B3 must read the group as
unknown until that process's end is observed. NOT_RUN: a turn (N1), Stop of the backend (B3).

## Backend exit receipts in managed Stop · 2026-09-28

First-slice plan B3-1, migration `20260928000067_backend_exit_receipt.sql`, on owned PostgreSQL 17
clusters with the full 67-migration chain; the operator's local stack was not used.

| Command | Result |
|---|---|
| `pnpm --dir apps/desktop test:stop-db` | PASS: dispatch migration suite, managed Stop suite, and `backend-stop-db.test.mjs` 9 groups |
| `test:archive-db` | PASS, 4 suites; an export now carries `source_schema_version` 67 |
| `test:restore-db`, `test:ceo-db`, `test:ingress-db`, `test:recovery-db`, `test:ceo-host-sql`, `run-managed-launch-db.mjs`, `run-dispatch-db.mjs` | PASS each on the 67 chain |
| `schema-readiness.test.mjs`, `build-manifest.mjs` | PASS with the contract at 67–67 |

NOT_RUN: main writing `backend.opened@1` / `backend.exited@1` (B3-2); the operator's database at 67 (C5).

## Native Stop over the owned backend · 2026-09-28

First-slice plan B3-2. `pnpm --dir apps/desktop test:stop-db` now also runs
`backend-stop-native-db.test.mjs`: the actual registry owning a disposable Node backend, the port
writing `backend.opened@1` / `backend.exited@1` through `append_event`, and the native Stop runtime with
managed Stop settling in SQL — **PASS, 7 groups**: stopped on the backend's own exit; unknown with a
descendant outside the group; unknown on an ignored SIGTERM, stopped with Force (exit signal 9);
a lost exit receipt retried within the Stop, and one that stays unwritable settled by a later Stop;
natural exit through the registry's hook as `natural_exit/completed`; a foreign or malformed host
identity refused; Stop commands passing after input halts.

`pnpm --dir apps/desktop test:codex-loopback-thread` on `codex-cli 0.157.1` with the owned profile's
`[features] shell_snapshot = false`: PASS twice under Node and once in Electron main, process group
`quiescent` after exit, **no descendant outside the group** — the escape recorded in the B2b-3
section above came from the shell snapshot alone (turning `allow_login_shell` off did not remove it).

## Chat activation in the real app · 2026-09-28

First-slice plan C5, on the operator's local stack.

**Migration of the operator's database, 59 → 67.** The stack had stopped with a corrupt image layer
(`public.ecr.aws/supabase/postgres:17.6.1.158`, "parent snapshot … does not exist"); the image was
re-pulled, the data volume untouched. Before migrating: a full `pg_dump -Fc` (184 MB, mode 600) in
`~/DATA/_backups/fabric-local-db/`, restored into a disposable container of the same image, where
migrations 60–67 were applied one transaction each — all passed (63 took 55 s), schema 67, 156 797
journal events kept. Then `supabase migration up` on the live database: 60–67 applied, schema 67,
the same 156 797 events. No `db reset`.

**Real app run.** `pnpm --dir apps/desktop build`, then `pnpm --dir apps/desktop test:chat-native`
(Playwright driving Electron 44): a fresh user-data directory whose active Estate is new, founded by the
app for the local operator. PASS twice — chat active; sent from the composer; "saved, no reply yet";
one `ceo.message.accepted@1` and no message text in the shared journal; a real quit (as Cmd+Q) and a
cold start read the message back without resending it.

Found and fixed on the way: the chat never opened a conversation (every real send would have been
refused, and an active chat showed "no access"); and quitting hung on Electron's modal error box after
the main window's `closed` handler read a destroyed `webContents`.

## N1 prerequisites measured · 2026-09-28

Claude Code 2.1.284 with a private `CLAUDE_CONFIG_DIR`, one stream-json turn in an empty git
repository: `system/init` then an assistant message `Not logged in · Please run /login` and a
`result` with `is_error: true`, `apiKeySource: none` — the credential is bound to the config
directory. Codex's owned profile holds no login either. The canary profiles and test Project are
created under `~/DATA/_canary/fabric-n1/` (mode 0700); logging each CLI in there is the one human
step before N1 ([plan](../../evidence/plans/2026-09-27-first-slice-plan.md#human-steps)).

## N1 provider access, corrected · 2026-09-29

The logins the previous section called missing were on the machine. Claude: `cswap run 8 -- --version`
created claude-swap's profile for account 8; the same stream-json turn in it answered `OK`, exit 0.
Codex: `codexLoopbackRecipe` with `modelAccess` (the existing `~/.codex/auth.json` linked, never copied;
the sandbox opens that file, TCP 443 and the mDNSResponder socket). Through the owned registry, the
loopback client and `startCodexThread`: `turn/start` accepted, `turn/started` and `turn/completed` for the
same turn and thread, backend exit 0 with a quiescent group after Stop. The turn itself failed:
first `workspace routing discovery failed` (DNS closed by the sandbox — fixed), then
`usageLimitExceeded` — the Codex account's usage resets 2026-10-03 19:15.

