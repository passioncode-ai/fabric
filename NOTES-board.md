# Fabric 0.3.9 "the core holds": the board part (branch `agent/core-bd`)

Plan and audit: [docs/evidence/plans/2026-10-21-core-reliability/README.md#board](docs/evidence/plans/2026-10-21-core-reliability/README.md#board),
[board.md](docs/evidence/plans/2026-10-21-core-reliability/board.md) (BD-1 to BD-5). Base: `024216bc`.

## What changed

### Migration 95, `supabase/migrations/20261021000120_board_core_holds.sql`

Suffix 120: 117/118 are the task pipeline's prose reservation, 119 is left to the other 0.3.9 branches. If two 0.3.9
branches land a migration, the later one is renumbered at integration, re-recorded in `supabase/migration-ledger.json`
(`node scripts/check-migration-order.mjs --record`), and its `ceo_private_archive_canonical`, `PRIVATE_ARCHIVE_LIMITS`
and `schemaContract.json` admit its own count.

- BD-1, a reply answers a request: `board_requests.state` admits `answered`; `board_insert_message` (shared by
  `board_submit` and `board_reply`) locks the request a non-request message from its TARGET names (`replyTo`) before the
  append, then journals `comms.request_transitioned@1` op `answer`, cause `target-reply`. `answered` is not open
  (`board_request_open`): it leaves `board_thread_page_operator`, `board_threads_operator`, `board_responders_json`,
  `board_pending_operator` and `board_waiting_operator`. The requester may still `com.cancel` it (answered to cancelled).
- BD-1, nothing stays queued: a request without a deadline gets `clock_timestamp() + board_request_default_ttl()` (168 h)
  written into its event. `board_tick` gains pass (a0), answering queued requests their target already replied to
  (the live database's legacy rows), and pass (a) expires a request with no deadline once its message is older than the
  default age. The tick's answer gains `answered`.
- BD-1, `board_responder_possible(estate, project, capability)`: a slot with a holder, or a live board.respond grant.
- BD-3, `board_list_reader(estate, reader, thread, after_seq, limit, unread, since)`: `board_list`'s page with a `read`
  flag per message, the unread and since filters, `participants @> array[reader]` (GIN). `board_list` is unchanged.
- BD-3, `board_cursor_keys` (RLS on, no role reads it) and `board_cursor_key(estate)`: one 32-byte key per estate.
- BD-4, `board_read_ack_many(estate, reader, principal, messages uuid[], thread, up_to)` and the event type
  `comms.read_acked_many@1` with its projector `apply_comms_reads_many` (dispatcher `apply_comms` plus one line).
  Up to 100 named messages, or one thread up to a message (at most 1000, `more: true` past it); all or nothing.
- BD-2, `board_waiting_operator(estate)`; `board_pending_operator` counts a request nobody answers from the requests
  themselves, read by its target or not (a project with such a request and no unread now appears with `unread: 0`).
- Schema 95 admitted as a private-archive source.

### App

- `apps/desktop/src/main/boardService.ts`: `commsListSchema` (`unread?`, `since?`), `commsReadAckSchema` (new),
  `requestState` (+`answered`), `commsReceiptSchema` (+`marked`, `alreadyRead`, `more`, `noResponder`), `createBoard`:
  `listKey` (the estate key from `board_cursor_key`, fallback to the run key, logged once as `board.cursor-key`),
  cursor MAC binds `unread`/`since`; `submit` adds `noResponder` after reading `board_responder_possible`; `list` reads
  `board_list_reader` when a filter is given; `readAck` takes the bulk forms. `BoardTickResult.answered`.
- `apps/desktop/src/main/boardTools.ts`: `BOARD_TOOL_INPUT['com.read_ack']`, descriptions of `com.submit`, `com.list`,
  `com.read_ack`, `com.reply` (no em dash in them).
- `apps/desktop/src/main/commsTransition.ts#COMMS_TRANSITIONS`: `answer` (queued to answered), cancel from answered.
- `apps/desktop/src/main/commsOperatorRead.ts`: `noteFailed`/`noteOk`/`down` (BD-5: every unavailable answer is
  recorded as `comms.read-unavailable` with door and reason, once per change; `comms.read-recovered` once); `waiting()`.
- `apps/desktop/src/main/ipcOutcome.ts` (new) and `apps/desktop/src/main/index.ts#handle`: a reply with `ok: false` is
  logged `failed` (code `unavailable` or none) or `unknown` (a stated refusal), never `ok`; `comms:heads` (the 5 s badge
  poll) writes a line only when its state changes. Plus one handler line, `IPC.commsWaiting`. Nothing else in
  `index.ts` was touched (no startup, no hub).
- `apps/desktop/src/shared/commsRead.ts#CommsWaiting`, `shared/types.ts` (`comms.waiting`, `IPC.commsWaiting`),
  `shared/ipcWindowPolicy.ts`, `preload/api.ts`.
- `apps/desktop/src/renderer/src/launch/HomeBoardWaiting.tsx` (new), rendered by `EstateHome.tsx` under the home board;
  `App.tsx` passes `onComms`. Reads on `comms` journal events and every 60 s.
- `apps/desktop/src/shared/scope.ts`, `shared/storageContract.ts` (`board_cursor_keys`), `main/ceoPrivateArchive.ts`
  and `shared/schemaContract.json` (schema 95).
- Not touched: `sessionEnroll`, `workTools`, `fabricMcp`, hub startup.

## Tests, each watched failing first

| Test | Red against the old behaviour |
|---|---|
| `apps/desktop/test/project-board-core-holds-db.test.mjs` (runner `run-project-board-core-holds-db.mjs`, port 58489; added to `scripts/ci.sh` full) | before the migration: 14 of 15 failed (the rebuild case passes on any chain). 16 cases now, all pass. |
| `apps/desktop/test/board-service.test.mjs`, block `board-core-holds` | 7 failed (6 new and the call-count change of the identity case). |
| `apps/desktop/test/comms-operator-read.test.mjs`, block `board-core-holds` | 2 failed (`waiting` absent; failures not recorded). |
| `apps/desktop/test/ipc-outcome.test.mjs` (added to `package.json` test) | plant `decide` returning `{outcome:'ok'}` (the old wrapper): 2 of 2 failed. |
| `apps/desktop/src/renderer/src/launch/HomeBoardWaiting.test.tsx` | plant "render nothing" (the old home): 3 of 4 failed. |

Changed expectations in existing suites, each the deliberate new behaviour: `project-board-db.test.mjs` (the target's
reply now answers `requestA`; its thread has no open request), `project-board-operator-db.test.mjs` (pending lists a
request to itself waiting on nobody), `board-service.test.mjs` (tick answer has `answered: 0`; cursor-key reads are not
page reads), `attentionHonesty.test.tsx` (stubs `comms.waiting` calm), `ceo-private-archive-codec.test.mjs` (schema 95),
`ipc-window-policy.test.mjs` (`commsWaiting`).

Run: owned-cluster suites `run-project-board-core-holds-db`, `run-project-board-db`, `run-project-board-operator-db`,
`run-project-board-responders-db`, `run-function-privileges-db`, `run-ceo-private-archive-db`, `run-estate-identity-db`,
`run-hub-upgrade-db`, `run-restore-authority-db`, `run-board-deferral-db`, `run-write-rules-db`: all pass. Unit: the five
files above, `board-tool-schemas`, `board-surface`, `contract-consumer`, full `vitest run` (197 files, 2318 tests).
Gates: `pnpm -C apps/desktop typecheck`, `check-regions`, `check-ops`, `check-list-reads`, `check-migration-order`,
`check-ipc-contract`; `bash scripts/ci.sh fast`: see the last section.

## User-visible strings (en / ru)

| Key | en | ru |
|---|---|---|
| `launch.home.boardWaiting.kicker` | Project board | Доска проектов |
| `launch.home.boardWaiting.title` | Waiting between projects | Ждут между проектами |
| `launch.home.boardWaiting.requests` | {count} requests between projects wait for an answer, and no agent can answer them now. The oldest has waited {age}. | Запросов между проектами ждут ответа: {count}. Сейчас их не может принять ни один агент. Самый старый ждёт {age}. |
| `launch.home.boardWaiting.requestsHint` | A reply from the project that was asked answers a request. To let an agent answer them, allow it under Agent access in settings. | Запрос закрывает ответ того проекта, которого спросили. Чтобы на запросы отвечал агент, разрешите это в настройках, раздел «Доступ агентов». |
| `launch.home.boardWaiting.unread` | {count} board messages are not marked read by the projects they were sent to. The oldest was sent {age} ago. | Сообщений на доске, не отмеченных прочитанными у адресатов: {count}. Самое старое отправлено {age} назад. |
| `launch.home.boardWaiting.open` | Open Comms | Открыть переписку |
| `launch.home.boardWaiting.unreadable` | What waits on the project board could not be read. | Не удалось прочитать, что ждёт на доске проектов. |
| `launch.comms.request.state.answered` | answered by a reply | получен ответ |
| `event.comms.read_acked_many@1` | a project marked several messages from other projects as read | проект отметил прочитанными несколько сообщений других проектов |

Agent-facing: the `noResponder.message` in a request receipt and the four tool descriptions (English, no em dash).

## Decisions taken here (for the ADR the integrator writes)

1. A request nobody can answer is ACCEPTED with `noResponder` in its receipt, not refused: its target can still answer it
   with a reply (which now settles it), the operator may grant board.respond later, and a refusal would lose the ask.
2. `answered` is a new request state (Fabric's, outside the pinned contract enum), reached only from `queued`, by a
   non-request message from the target naming the request. A reply to a claimed or accepted request (a responder holds
   it) changes nothing. The requester may still cancel an answered request.
3. The default deadline is 7 days (168 h, so a daylight-saving change cannot shift it), written into the event.
4. Legacy rows are settled at read time by the tick (journalled transitions), never by rewriting events in the migration.
5. `read` on a message, the `unread`/`since` filters, the bulk `com.read_ack` forms and the receipt members are optional
   additions: a call that uses none of them gets exactly the contract's bytes (`board_list` untouched). A strict client
   validating against the pinned schemas sees `read`, `answered` and the new receipt members only when it asked for them
   or when a request was answered.
6. One journal event per bulk mark (`comms.read_acked_many@1`), not one per message.
7. The cursor key lives in the database per estate (not in a file), so a restored estate (new id) resets cursors.

## Docs the integrator must update (not touched here)

- An ADR (amending ADR-0117/ADR-0149): the `answered` state and the `answer` op, `noResponder`, the default deadline,
  `com.list` `unread`/`since`/`read`, bulk `com.read_ack`, cursors that survive a restart; and a contract proposal to
  fabric-agent-contract (DEC) so the pin can carry them (`commsTransition.ts` notes `answer` is Fabric's own until then).
- `CONTEXT.md`: "answered" (a request), "waiting with no responder".
- `docs/architecture/` board pages: lock order of `board_insert_message`, the tick's passes (a0) and (a), the cursor key.
- `docs/ux/scenarios.md` and `docs/ux/screens.md`: SCN-143/SCN-157 ("Waiting for a project" now counts read requests),
  SCR-30 home (the new panel), SCR-81 request state `answered`; product model if it lists home panels.
- `AGENTS.md` lifecycle table (LC-09): the home's board read (`comms.waiting`, renderer, on `comms` events and every
  60 s, `HomeBoardWaiting.tsx#REFRESH_MS`); the badge poll's IPC line is now written only on a state change.
- `docs/evidence/backlog.md`: BD-1 to BD-5 rows; `CHANGELOG.md`; the design map (`docs/reports/map.html`), whose stamp
  this branch moves (migration, sources).
- `docs/ANALYTICS.md`: nothing (no usage event added).

## Not done, and why

- `com.status` listing the open requests addressed to the caller (audit BD-3's second half): `comms-status` is a closed
  contract shape; `com.list {unread: true}` now shows a session its requests in its first call instead.
- BD-4's fan-out half (replies to announcements reaching 15 Projects; the 16-participant cap): a product decision on an
  announcement channel, not a reliability fix.
- BD-10 in the old paths: `board_list`, `board_get`, `board_read_ack` still use `= any(participants)`; only the new
  functions use `@>`. Kept to avoid redefining the contract paths in this release.
- The renderer's badge `catch {}` in `App.tsx` stays: the main side now records the failure (BD-5); a renderer cannot
  write the operations log.
- BD-6 (log retention) belongs to the stability branch (ST-4).
- Effect on the live database at upgrade: the first tick answers the queued requests their target already replied to
  (the audit counted replies by target on 4 of 6) and the ones with no deadline expire 7 days after they were sent.
  Not run against the live database (ports 54321/54322 untouched).
