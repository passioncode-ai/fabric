# Fabric 0.3.9 review iteration 1: board and home fixes (branch `agent/core-bd2`)

Base: candidate `8100be6b`. Review reports: `rv-039-out/iteration-1/2026-10-21-ux.md` (UX-1, UX-6, UX-7, UX-8, UX-10),
`2026-10-21-data.md` (DA-4, DA-5, DA-8). No migration was added or edited: every fix is in the app. Not touched:
`index.ts` startup, hub standby, `stackWatch`, `fabricMcp`, `sessionEnroll`, `workTools`.

## What changed, finding by finding

| Finding | Fix | Test (written first, watched failing against `8100be6b`) |
|---|---|---|
| UX-1 / DA-8 (blocking) | The home's board panel shows only the requests between projects that no agent can answer now, with the oldest age; nothing when there are none. The unread-deliveries line is gone from the home (Comms keeps its per-project counts). `commsOperatorRead.ts#waiting` reads past the `unread`/`oldestUnreadAt` half `board_waiting_operator` still answers, and `shared/commsRead.ts#CommsWaiting` no longer carries it; a later database without that half reads the same. | `HomeBoardWaiting.test.tsx`: "shows no unread-deliveries figure", "unread deliveries alone show nothing" (7 of 8 red on the candidate); `comms-operator-read.test.mjs` BD-2 (red) |
| UX-6 | Comms "Waiting for a project": a project with nothing unread (listed only for a read request nobody answers) reads `launch.comms.pending.rowNoUnread` ("Beacon: nothing unread; the longest wait 3d"); the row's age is labelled as the longest wait (it is the older of the unread messages and the unanswered requests); `launch.comms.pending.noResponder` is its own count in the colon form ("requests no agent answers now, read or not: 1"), never "of them". `launch/CommsParts.tsx#PendingPanel` | `CommsScreen.test.tsx` "a read request nobody answers is said on its own" (red), and the updated row pattern of "lists each project" (red) |
| UX-7 | The home hint no longer sends the operator to Agent access: "A reply from the asked project answers a request; open it in Comms to see who was asked." The agent-facing `noResponder.message` likewise says an agent of the target asks for board.respond and the operator allows it, instead of "the operator grants". | `HomeBoardWaiting.test.tsx` "the hint says a reply from the asked project answers" (red); `board-service.test.mjs` BD-1 noResponder (red) |
| UX-8 | `launch.comms.cause.target-reply`, en "by a reply from the asked project", ru «ответом проекта, которого спросили». | `CommsScreen.test.tsx` "a request answered by its target says so in words" (red) |
| UX-10 | The home's count uses the registry's colon form ("Requests between projects that no agent can answer now: 1."); an oldest time that is absent or does not parse drops the age clause (`launch.home.boardWaiting.requestsNoAge`), never "?" (and never `since()`'s fallback dash). | `HomeBoardWaiting.test.tsx` "one request reads as one, and an unknown age is left out" (red) |
| DA-4 | Decision below. Code comments (`boardService.ts` `requestState`, the receipt's optional members, `#region board-core-holds-no-responder`) and the `com.submit`, `com.list`, `com.get` descriptions now say exactly who receives what. | `board-service.test.mjs` "the tool descriptions say what changed" (red) |
| DA-5 | Not fixable here (the migration is recorded in `supabase/migration-ledger.json`); the correction is below for the integrator. | none (docs) |

Strings removed: `launch.home.boardWaiting.unread` (en, ru). Added: `launch.home.boardWaiting.requestsNoAge`,
`launch.comms.pending.rowNoUnread`, `launch.comms.cause.target-reply` (en, ru). Changed: `launch.home.boardWaiting.requests`,
`launch.home.boardWaiting.requestsHint`, `launch.comms.pending.row` (placeholder `{since}` became `{age}`),
`launch.comms.pending.noResponder`. No U+2014 in any of them.

## DA-4 decision: `noResponder` and `answered` stay always-on

Accepted as additive, not put behind an opt-in. Exactly what is sent to whom:

- `noResponder {target, capability, message}` goes only in the receipt of a `com.submit` of kind `request` whose
  capability nobody can serve now (`board_responder_possible` false), and only to that caller, the requester. No opt-in.
  No other tool and no other Project receives it. A client validating against the pinned `comms-receipt` schema
  (closed, `additionalProperties: false`) sees one member the contract does not name.
- `answered` is a request state outside the pinned enum. It appears in the `request` object of any participant's
  `com.get` and `com.list` page (`board_message_json`), and in the receipt of a later `com.cancel` by the requester.
  `com.status` carries no request state. It appears without any opt-in once a target replied, including right after
  the first tick past the upgrade.
- `marked`, `alreadyRead`, `more` appear only in the answer to a bulk `com.read_ack`, which the caller chose.

Reason: telling the requester at once is the point of BD-1, the request is stored either way, and a refusal or an
opt-in would hide the fact from the agents that most need it. Until CO-371 carries both in the contract, a strict
conformance probe will reject such receipts and pages; that is the known cost.

## What the integrator must change in docs (not touched here)

- ADR-0149's amendment and `2026-10-21-notes-board.md` decision 5: replace "a call that uses none of them gets exactly
  the contract's bytes" / "only when it asked for them" with the three bullets above (`noResponder` and `answered` are
  always-on extensions outside the pinned contract; only the bulk read-mark members are opt-in). ADR-0149 also: the
  `noResponder` message no longer says "the operator grants board.respond".
- DA-5: the header of `supabase/migrations/20261021000120_board_core_holds.sql` (its BD-1 legacy-rows paragraph) says
  the tick answers "the six requests of 2026-10-16 to 10-20". On the operator's data it answers 4 (those a target
  replied to); the other 2 wait until their 7 days pass (2026-10-26), and the six were sent 2026-10-17 to 10-19 (data
  review DA-5). The migration is immutable once recorded: correct it in the plan README and in release-mac's 0.3.9 line
  (with DO-9's sentence), not in the file.
- `board_waiting_operator` still computes the unread-deliveries half the app no longer reads. Leave it (dropping it needs
  a migration); a carry-over row can retire it with the next board migration, or turn it into a per-project figure
  that only counts projects that have ever marked anything read (DA-8's alternative).
- `docs/ux/scenarios.md` SCN-143 0.3.9 amendment: the home shows only requests no agent can answer, with the oldest
  age, and nothing when there are none; it no longer shows unread board messages. SCN-157: the row says "nothing
  unread" for a project listed only for an unanswered read request, the age is the longest wait, and the no-responder
  count is its own figure. SCN-147 step 7: the timeline names the `target-reply` cause in words.
- `docs/ux/screens.md` SCR-30 / SCR-85 (the home's new panel, requests only) and SCR-81 (request state `answered`,
  cause "by a reply from the asked project").
- `CHANGELOG.md` `## Unreleased` and the plan README "What landed": "The home shows requests nobody can answer and
  unread board messages" becomes "The home shows the requests between projects no agent can answer, and how long the
  oldest has waited".
- The user-visible strings table in `2026-10-21-notes-board.md` is superseded by the list above.
- Design map (`docs/reports/map.html`): a new top changelog entry; the stamp moves with these sources.

## Checks run here

| Command | Result |
|---|---|
| `node_modules/.bin/vitest run` (apps/desktop) | 199 files, 2342 tests passed |
| `node --experimental-strip-types --test --test-force-exit test/{board-service,board-surface,board-tool-schemas,comms-operator-read,ipc-window-policy,contract-consumer}.test.mjs` | 40, 10, 3, 19, 14, 12 passed, 0 failed |
| `pnpm -C apps/desktop typecheck` | exit 0 |
| `node scripts/check-regions.mjs`, `check-ops.mjs`, `check-list-reads.mjs`, `check-design.mjs` | each exit 0 |
| `python3 docs/ux/lint.py`; `python3 docs/brand/lint.py` | 0 errors each (brand: 1980 B022 warnings, the registry-row class, +4 for the new keys) |

No database-backed suite was run: no SQL changed, and `board_waiting_operator`'s answer is unchanged.
