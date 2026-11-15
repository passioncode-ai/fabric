# The quality waves after 0.3.21

Date: 2026-11-15. Owner: this repository's release session. Sources: [the quality audit](../../reports/2026-11-15-quality-audit/README.md)
(inventory, interface, performance, bug tracker), the carry-over register and the board.

The operator's words, 2026-11-15: «собери это в один план и волнами ... и все это типа волнами до конца исправляем,
двигаемся волнами пока все не будет окончено до самого конца». So: every wave lands on `main` with its tests watched
failing first, its gates green (`bash scripts/ci.sh fast`, the map lane), and a release when a wave changes what a person
or an agent meets, under the release gate (three iterations of five reviewers). A finding a wave does not fix becomes a
carry-over row the same day. Each wave names its finish line; the next wave starts when it is met.

Order: what a person cannot use first (W1), what loses work or data (W2), what makes everything slow (W3), what makes
the next defect visible (W4), the board's correctness (W5), the visual layer and the words (W6), the register's hygiene
(W7), then the rest of the register by its lanes (W8).

## W1 · Переписка and the columns: nothing runs under anything

| Item | Source | Fix | Proof |
|---|---|---|---|
| A message in an opened thread is laid out in a 24 px column | ui UI-1, UI-22 | a message class of its own (head, facts, body), never `.lp-topic` | a browser suite on the thread's markup at four widths |
| The thread list's title lands in the number column | ui UI-2 | the number span, or a row modifier without it | the same suite |
| A message loses its line breaks, shows raw Markdown, is painted muted | ui UI-9 | `white-space:pre-wrap`, `overflow-wrap:anywhere`, ink colour, Markdown bodies rendered | renderer test and the suite |
| A grid's `auto` or `1fr` column grows to a wide child (78 grids; the project page at 850 px, the feed, the kanban card) | ui UI-4 to UI-6, UI-8; the operator's screenshot of the agent page (fixed in 0.3.21) | `minmax(0,1fr)` in every collapse and grid that holds user content; `overflow-wrap:anywhere` on user text | the audit's stress harness as `scripts/test/layout-stress.browser.mjs`, failing on any grid that grows past its container |
| With the side panel open the project page keeps two columns in 178 px, buttons over «Цель» | ui UI-3, UI-23 | container queries on the page, `flex-wrap:wrap` on panel heads | the suite with the panel open |
| A row of cards cut with no sign it scrolls | ui UI-7 | an edge fade or «ещё N» | the suite |

State, 2026-11-16: UI-1 to UI-6, UI-9, UI-22, UI-23 built (`comms-thread`, `layout-wide-content` suites). UI-8: every class
the stylesheets make a grid is rendered in a 600 px column with a 400-character word (`layout-stress.browser.mjs`); the 57
that grew let their items shrink, the four that size items to content cap them, seven icon or label grids are named with
their reason. UI-7: a row of cards that scrolls (directions, kanban) fades its right edge while more cards wait past it,
driven by the row's own scroll, so a row that fits never fades (`scroll-edge.browser.mjs`).

Finish line: the layout suite green at 1800, 1280, 1024, 800 and 700 px with the panel open and closed; the Board,
Переписка (list, thread, feed), a project page and an agent page read on the installed bundle. Release 0.3.22 with W2's
first rows and W3's quick fixes.

## W2 · The disk, the database and the start: no lost work

| Item | Source | Fix |
|---|---|---|
| The database went down 9 times in 7 days near a full disk, once reading a block with an I/O error | perf PF-1, PF-12 | a disk floor: under 10 GB said on every screen and through the communicator; under 5 GB no dispatcher run, routine or enrolment starts; after a Postgres I/O error a read-only `amcheck`, its result in the ops log and «На проверке»; the block `base/5/16866` checked now |
| Every schema step is a manual stop at upgrade | perf PF-13; CO-364 | Fabric's own stack: a verified backup, then the migration at start |
| Fabric stayed down hours after a reboot | CO-365 | read with the stack watch's records; fixed or ruled with its cause |
| The local database answers on the network with the default password | inventory S1; CO-219 | bind and password per the row, with a stack test |
| A crashed database left unhealed 5.5 hours | board task `369c744c`; CO-573 item 1 | the watch's heal path tested on that case |

State, 2026-11-15: the dispatcher's floor is built (`DISK_FLOOR_BYTES`, 3 GB; the warning on every screen already
stands at the stack watch's 3 GB). The floor is 3 GB, not the audit's 10: this Mac usually runs with 4 to 7 GB free, and a
10 GB floor would hold the board most of the day, while every loss measured was under 3 GB. The block the I/O error named
reads now: `base/5/16866` is `public.journal`, a full scan read 165 920 rows and block 13145 its 11 tuples, no error
(2026-11-15, read-only). `amcheck` is available but not installed; installing it is a schema change left to that row.

Finish line: a full disk planted in a stack test stops new starts and says so; an upgrade with a migration opens without a
hand step; CO-219 resolved.

## W3 · Speed: the home, the polls, the log

| Item | Source | Fix |
|---|---|---|
| The home reading takes up to 18.6 s, serial, once per reader | perf PF-2 | one shared reading in main with a 2 to 3 s reuse, its independent stages in parallel |
| The window polls on fixed clocks while hidden: about 8 000 calls an hour at 40 agents | perf PF-3 | polls paused when the window is hidden; the feed pushed from main with a 15 s safety poll; the terminal list from PTY events |
| `stack:exposure` blocks up to 5 s every 5 minutes | perf PF-9 | answer the last value, refresh in the background |
| The log keeps 3 days, not 7; one client re-initialises every 35 s | perf PF-6, PF-7 | sample routine successes; log a dispatcher decision when it holds two passes; find the client by its binding |
| 49 `fabric-mcp` processes hold 2.7 GB | perf PF-10 | a capped heap or bundled Node, measured at 40 sessions |
| Blind spots: quiet channels untimed, `[object Object]` errors | perf PF-8 | timed, and errors formatted |

State, 2026-11-15: built on `main`: the shared home reading (`shared/sharedReading.ts`, PF-2's first half), the
exposure check answered from its last value (PF-9), errors as objects said by message or code (PF-8's half), the two
home reads that need nothing from the chain run beside it, the polls paused while the window is hidden (PF-3's first
half), routine successes sampled (PF-6's first half), and the home's assembly moved out of `index.ts` into
`main/homeView.ts`. Next: the feed pushed from main, the 1 s p95 measured at 40 sessions.

Finish line: the home under 1 s at p95 on this machine with 40 sessions, measured from the ops log; the log back to 7 days.

## W4 · The bug tracker, on our own analytics

[The design](../../reports/2026-11-15-quality-audit/2026-11-15-bug-tracker-design.md), its waves in order:

- 0: agree the new events with the analytics agent; ask passioncode-platform for an intake route.
- 1: local capture and fingerprints; native crashes and a frozen main process caught.
- 2: consent (ADR-0127 amended).
- 3: `app_error`, `app_crash`, `app_hang`, `app_slow` and `problem_reported` to growth.
- 4: one «На проверке» item and one board task per fingerprint.
- 5: «Сообщить о проблеме» and the daily GitHub triage job.
- 6 (Sentry for native dumps) waits for the operator's decision: it sends data outside the estate.

State, 2026-11-15: wave 1's first part is built on `main`: the fingerprint (`shared/bugFingerprint.ts`), the local store
(`main/bugStore.ts`, `userData/bugs.json`), every failed ops record folded in, helper-process crashes recorded and
native dumps kept locally. Next in wave 1: the hang watch of the main loop and the slow-call counts in the digest.

The Observatory binding token that the daily digests need (`ops-digest-binding.token`) is issued in wave 1.

Finish line: an error planted in a build reaches growth once, under consent, as one board task and one issue.

## W5 · The board's correctness

| Item | Source |
|---|---|
| 17 % of dispatcher runs end without an answer; 1 762 failed starts in 7 days; decisions flip at the 10-minute edge | perf PF-4; CO-559, CO-562, CO-571, CO-573 |
| A session in a removed folder loops on `spawn git ENOENT` | perf PF-5 |
| A request whose work lease expired cannot be closed by any call | board finding `98eac80d` (a row filed in W7) |
| `com.submit`'s subject refusal | board task `51d3d477`, finding `4a4ac27b` (a row filed in W7) |

Finish line: a dispatcher hour watched on the installed board with no unexplained `exited-without-answer`.

## W6 · The visual layer and the words

| Item | Source | Fix |
|---|---|---|
| Yellow on white counters and selection, 1.3 to 1.45:1 | ui UI-12, UI-13, UI-14 | `--app-accent-ink` per theme; selection by weight or background too |
| Em dashes in person-facing strings: 133 in ru, 70 in en, the dash (U+2014) as the unknown placeholder | ui UI-15 | rewritten through the copywriting rules and the copy check; a gate that fails on U+2014 in i18n values and JSX text |
| One act, three words; the person in the third person; plurals; machine ids; three date styles | ui UI-16 to UI-21 | one word per act, «вы», plural keys, words for ids, one date rule |
| Literal type sizes, 37 below 11 px; no hyphenation | ui UI-10, UI-11 | the size tokens, nothing below 11 px, `hyphens:auto` on prose |
| The audit's coverage gap | ui (coverage) | `ru.ts` read line by line; every screen walked against `docs/ux/scenarios.md` and `docs/ux/screens.md` |

State, 2026-11-15: gold text and markers take the theme's ink (`gold-ink-contrast.browser.mjs`, both themes); every
interface string rewritten without U+2014 (133 ru, 70 en) and gated in both languages by `scripts/check-design.mjs` (its baseline `emdash-baseline.txt` now empty). The dash alone as a "no value" mark in the screens'
code (about 15 places) stays: the copy catalogue's AT-06-E4 exempts a dash standing for an empty cell. One word per act (UI-16): «Повторить» on every retry after a failure; «Проверить ещё раз» stays for re-reading a state, a
different act, and the Edit menu's «Повторить» stays as macOS names Redo. «Вы» for the person in the feed and decisions
(UI-17). The fixed plurals of UI-19 are filled only with constants (300, 50, the list's cap), all in the «many» form, so
no reader meets the wrong form; ruled, not changed. One rule for when something was said (UI-21, `duration.ts#whenSaid`): within a day how long ago, then a short local date,
the exact time in the tooltip; on a Переписка message and the feed, and the Pulse's days and range as short local dates
instead of ISO keys and a time-zone id (UI-20). A redacted message's id and digest moved to its tooltip. Fourteen em dashes
the components wrote themselves (between two values, in template strings) replaced, and the design gate now fails on one;
the lone "no value" dash stays (AT-06-E4). Still open: the request's raw capability on screen (UI-20), the other 23
places that format a date their own way.
Nothing below 11 px (UI-10): the 10 own rules raised, the 27 rules ported from the prototype lifted in the adaptations,
the badge token floored at 11 px, and `scripts/check-design.mjs` fails on any size under 11 px or a ported one left
unlifted; under 550 px the Pulse's bars drop their count (it stays in the title) and name every other day
(`scripts/test/type-floor.browser.mjs`). Prose hyphenates in the reader's language (UI-11). The edge of a card a person clicks (a direction, a kanban card, a
post, an agent row, a glance card, a start choice) takes `--app-line-control`, 3.33:1 dark and 4.14:1 light against its
panel (UI-14, `card-edge-contrast.browser.mjs`); dividers keep `--app-line`.

Finish line: the contrast check in both themes passes AA; the em-dash gate green; the walk's findings fixed or filed.

## W7 · The register's hygiene

- The general plan's «Now» line described 0.3.17 to 0.3.19: rewritten to this plan on 2026-11-15.
- Board tasks that are done or stale go to review with their evidence (`ae47857f`, `0680fd29`, `9c4eba4a`, `6ab1efa7`, `9a44f7b4`).
- Duplicates folded to one owner: the service's request door (`318bc4c3`, CO-568, `bf80f5c6`); temporary-folder projects (`ffc7bf62`, CO-497, CO-574); the psql hang (`b85dcd38`, CO-211).
- Board findings without a row get one.
- Items filed on Fabric's board that belong elsewhere are sent to their owner on the board.

## W8 · The rest of the register, by its lanes

The remaining open carry-over rows (315 at the audit) are worked by the general plan's lanes in their own order
(ADR-0101), each wave a release under the gate; the feature rows wait for their lane's turn, not this plan.

## Waits outside this repository

- The analytics agent's agreement on the new events (W4 wave 0).
- passioncode-platform's intake route (W4 wave 5).
- The operator's decision on Sentry for native dumps (W4 wave 6).
