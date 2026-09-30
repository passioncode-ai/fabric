# HAR-R0-04 · Stop: команда, наблюдение и право продолжить

Статус: **SQL-контракт, native binding и интерфейс Stop реализованы; provider conformance и целостный native flow ещё не приняты.** Это уточнение [ADR-0063](../../adr/0063-ceo-first-discovery-and-explicit-continuation.md) и пакета [HAR-R0-04](development.md#har-r0-04--наблюдаемая-остановка-h03), не новая модель задач. [Общий вход](README.md), [receipts](checks.md).

## Что должен видеть оператор

Одна команда «Остановить» перекрывает ввод и доставку, затем показывает текущий результат. «Запрошено» не означает «остановлено». После доказанного завершения доступны новая сессия того же исполнителя и другой совместимый исполнитель. Если завершение неизвестно, работа, разговор и терминал остаются доступны для изучения; повтор проверяет ту же команду, а не создаёт ещё один запуск. Прекращение выполнения не отменяет саму задачу и не означает, что работа выполнена.

Это существующее целевое поведение SCN-096 / FLW-56. Итерация 27 сентября связывает `index.ts`, preload, Session/Project/Home с одним native finalizer. Макет r0-work показывает отдельное подтверждение Force. Компонентные тесты проверяют действия, но не являются приёмкой реального провайдера или визуальной проверкой всего приложения.

## Модули и единственный владелец каждого факта

| Модуль | Вход → выход | Статус / доказательство |
|---|---|---|
| Stop command | Estate + exact TaskRun/Session + authority + command UUID → canonical request receipt | `request_task_run_stop`, migration62; isolated SQL tests |
| Stop authority | trusted typed observation → stopped либо outcome_unknown | `record_task_run_stop_observation`; service-only operational `run_stop_commands` |
| Never-spawned compensation | admitted begin owner + explicit no-process attestation → separate compensation receipt | `fail_task_launch`, `run_launch_compensations`; no fake terminal exit |
| Native coordinator | exact local target → halt → request → revoke/signal → observe → transcript → receipt | `managedStop.ts`, imported module fault tests; `nativeStopRuntime.ts` связывает Stop / natural exit / launch failure / shutdown |
| Process observer | captured owned PID/PGID/start → observed group members/uncertainty | `processBoundary.ts`; synthetic identity tests and actual owned child-process fixture |
| PTY host | root output/exit, input gate, terminal.closed receipt, group sampling | `pty.ts`; root exit remains distinct from complete execution termination |
| Provider adapter | scoped background/daemon cancellation and quiescence proof | **Pending** exact-build native conformance. An empty process group is insufficient |
| Transcript finalizer | durable captured/empty receipt vs unavailable | `transcripts.ts` + `transcriptReceipt.ts`: sealed retry, captured/empty/unavailable, journal receipt before settlement |
| Presentation / recovery | canonical state with scope and evidence → operator's next action | `SessionStop.tsx` + typed IPC implemented; crash/restart ownership recovery and provider acceptance pending |

Sources: [SQL](../../../supabase/migrations/20260927000062_managed_stop.sql), [coordinator](../../../apps/desktop/src/main/managedStop.ts), [process observer](../../../apps/desktop/src/main/processBoundary.ts), [PTY](../../../apps/desktop/src/main/pty.ts). These paths contain implementation; rows explicitly marked pending are design requirements.

```mermaid
sequenceDiagram
    participant U as Operator / natural exit
    participant H as Native host
    participant D as Durable commands
    participant P as Owned process + provider
    U->>H: Stop exact Session
    H->>H: halt manual input and queued delivery
    H->>D: request_task_run_stop(command UUID)
    D-->>H: canonical command + reason + state
    alt request receipt unavailable
        H-->>U: Unknown; no signal inferred or new writer
    else still pending
        H->>H: recheck local ownership, revoke mediated authority
        H->>P: scoped termination request
        H->>P: observe root, descendants and provider boundary
        H->>H: await terminal.closed and durable transcript
        H->>D: typed facts and bounded evidence references
        D-->>H: stopped / outcome_unknown
        H-->>U: result and permitted next action
    end
```

## Durable invariants

1. First valid command for a generation owns the Stop identity and reason. Repeat returns it, including after a lost reply. A later natural-exit callback cannot turn an operator cancellation into successful completion.
2. `ending` blocks dispatch claim/begin and new admissions in the same write scope. Lease expiry, root exit, raw `run.ended` or a forged `launch_failure:true` cannot manufacture clearance.
3. Verified observation requires `rootExited`, `processTreeQuiescent`, `providerQuiescent`, `authorityRevoked`, `transcriptCommitted`, six typed evidence references and a trusted `terminal.closed` journal receipt for this Session after its admission. Missing facts leave ownership unresolved. Arbitrary tool output and extra observation fields are not persisted by this RPC.
4. Operational authority is not rebuilt from agent claims or journal payload flags. `run_stop_commands` and `run_launch_compensations` survive projection replay and are excluded from workspace import/mirror. Missing authority after restore means unknown, never permission to run.
5. Verified Stop moves only the exact current Task's `running` state back to `backlog`. Review and terminal task states survive. The runtime outcome and the work outcome remain different facts. `ACK → running → Stop → Continue` is an explicit SQL regression.
6. Stop during preparation can end without any process. Only validated service-side compensation may record `basis=never_spawned`; absence of terminal events alone is not proof. A bound/opened/closed or positively attested process refuses no-process compensation. Repeated receipt remains readable after a later generation starts.
7. `basis=observed` means actual complete stop evidence. `basis=never_spawned` means execution never began. Neither basis is inferred from a timeout. Historical ended Runs remain immutable.
8. A Stop coordinator rechecks local generation ownership after asynchronous revocation and before destructive signaling. A signal failure does not prevent observation; a revocation failure does not suppress termination attempts, but prevents a complete receipt.

Receipt fields: `command_id`, `task_run_id`, `task_id`, `session_id`, `state`, canonical `reason`, `basis`, `receipt_seq`, `repeated`; completed observations include `outcome`. Request and observation RPCs use their respective `requested` / `recorded` discriminants. Consumers validate exact identities and receipt shape; they must not render successful transport as successful Stop.

## Honest native boundary

The POSIX observer captures a separate process group, samples descendants, detects observed PID/PGID/start mismatches, and retains uncertainty when a known descendant leaves the group. It does not read process command lines or environments. It requests SIGTERM; SIGKILL requires an explicit fresh operator Force action and a verified owned group. Default Stop never escalates automatically. The real fixture proves a child can outlive its leader, ignore SIGTERM and then be observed gone after escalation.

This is **not a sandbox**. `ps` and `kill` are not atomic; `lstart` has second precision; a process can escape between samples. A retained supervisor/group anchor or a stronger platform primitive is required before stronger ownership guarantees are claimed. Provider daemons, remote work and in-flight external effects need separate proof. Until provider conformance establishes that boundary, `providerQuiescent` must remain false; no CLI release acceptance is inferred from the local process fixture.

The root PTY event invokes local cleanup immediately, independently of the journal. Its finalizer awaits the retryable `terminal.closed` receipt without awaiting its own exit callback. Manual input and queued delivery are halted before the first Stop lookup await. The old `index.ts` root-exit-only task completion is removed. Natural exit independently revokes Fabric surface credentials even if the database is unavailable; this does not revoke gateway grants or prove completion of already admitted external effects.

## Exact next implementation packet

**HAR-R0-04B: native binding and presentation — implemented locally; native acceptance pending.** Read this document, migration62, `managedStop.ts`, `nativeStopRuntime.ts`, `transcriptReceipt.ts`, current `index.ts` bootstrap/before-quit, and SCN-096 / FLW-56. The checklist below remains the acceptance contract, not an assertion that every boundary has passed.

- One host finalizer handles operator Stop, natural exit, failed post-spawn launch and app shutdown. Eliminate root-exit-only task completion and independent unordered transcript/revoke promises. Never await the Stop finalizer from the root exit callback in a way that blocks its own observation.
- Resolve exact local Run/Session before signaling. Foreign host, missing receipt, unknown start identity, expired membership and changed generation are separate refusals. Persist host/app-instance identity and recovery evidence before claiming crash recovery.
- Consume the detailed transcript finalizer: captured and genuinely empty can produce durable receipts; unreadable/missing/gapped captures cannot masquerade as empty. Retry preserves the original bytes and end metadata. Test a lost append reply and a retry after capture was closed.
- Expose typed Stop result over IPC; display requested, confirmed, unknown and refused separately. Root process liveness remains separate. Keep transcript/inspection available in unknown state; never dismiss the only recovery identity. Repeat Stop checks the canonical command. Stop execution does not cancel a task.
- Update scenarios/flows/screens/model and affected mockups only for the actual wired behavior. Validate Home, Project, detached Session, close-window vs quit, keyboard/manual input, repeat click, stale UI and restart.
- Provider quiescence is its own HAR-R0-05 dependency. Do not substitute CLI exit, a successful cancel call or a fake observation for actual provider evidence. Native fixture runs are isolated from user projects/accounts.
- Bound each asynchronous port and the total Stop deadline. A hung RPC or observer must become unknown; late completion cannot resume signaling or launch a writer. Test both thrown failures and promises that never resolve.
- Run module faults, actual PTY tests, the latest full migration-chain Stop and launch suites, then fast. Review the final diff independently. Keep native capabilities without a receipt open in CO-168.

Rollback: disable managed admission/continuation when the required Stop contract is unavailable; retain operational receipts and history. Do not roll back by deleting a lease, importing a fabricated receipt, replaying an uncertain instruction or resetting a live database.

## HAR-R0-04B delivery boundary · 2026-09-27

- `nativeStopRuntime.ts`: successful no-Run lookup permits scoped physical stopping of a free terminal. A failed lookup remains unknown and permits no signal. Free agent terminals require provider evidence; shells use their local physical boundary without invented TaskRun/command IDs.
- Total deadline uses monotonic time before and after awaited ports. A stalled event loop cannot return a late `stopped` result. Coalescing prevents Stop, natural exit and quit from starting competing finalizers; an in-flight ordinary Stop is never silently upgraded to Force.
- `stopHostIdentity.ts` persists an installation UUID and creates a separate invocation UUID. This identifies current evidence; it does **not** grant permission to signal a previous process after restart or prove crash recovery. Invalid saved identity fails bootstrap rather than being silently replaced.
- `SessionStop.tsx`: requested disables duplicate submission; unknown/refused exposes retry and separately confirmed Force; only verified Stop allows dismissal. Session inspection remains available. The old nested button/card structure in AgentTile is removed. Existing components/tokens are retained; CO-169 visual migration is untouched.
- `closeHttpServer.ts` bounds closure of this host's HTTP listener, including a hanging client. Closing transport is not proof that previously dispatched remote side effects were cancelled.
- Transcript seals are retry/process-restart evidence. File metadata is fsynced, but directory publication and spool content do not provide a power-loss durability guarantee. Provider conformance, persistent process ownership recovery, complete native continuation and egress revocation remain open in CO-168.

Primary implementation receipts: [native runtime tests](../../../apps/desktop/test/native-stop-runtime.test.mjs), [transcript filesystem tests](../../../apps/desktop/test/transcript-finalization.test.mjs), [journal receipt tests](../../../apps/desktop/test/transcript-receipt.test.mjs), [UI tests](../../../apps/desktop/src/renderer/src/SessionStop.test.tsx), [HTTP shutdown test](../../../apps/desktop/test/close-http-server.test.mjs). Latest executed outcomes live in [checks](checks.md).

Startup now invokes bounded capture recovery through [ADR-0073](../../adr/0073-recovered-transcripts-do-not-prove-process-ending.md) and [the recovery packet](recovery.md). Migration63 and upgraded readers preserve unknown end/exit separately from capture time. Historical scope and exact receipts are verified before cleanup; currently owned runtime generations are excluded. Unreadable/conflicting evidence remains on disk. This is a pre-release implementation, not a live migration receipt. This recovers captured history, not previous process ownership. Provider implementation packets: [P05.1–P05.6](providers.md).
