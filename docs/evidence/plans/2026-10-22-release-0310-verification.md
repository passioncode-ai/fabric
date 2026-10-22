# Release verification: Fabric 0.3.10, the scroll patch, three independent iterations

The operator, 2026-10-22: «главный экран не скроллится … просмотреть вообще весь UI, какие есть еще нюансы, все
исправить», then «дальше до конца». Since 0.3.7 no page of Fabric could be scrolled. 0.3.10 is that patch (P-23):
everything on `main` since v0.3.9, which is the scroll fix (PR #36), CO-381's resolution with the corrected 0.3.9 notes
(PR #37), the renumbering of the simple plan's wave 4 to 0.3.11 (P-20), and the CI fixes on `main` since v0.3.9
(`ba78b7b8`, a pending workspace publication is not a broken one; `10325066`, a test fixture), and the operations log's
wording of a refused database query (iteration 2). Schema 95, unchanged.

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.10/iteration-N/`.

## Rollout on the operator's Mac

0.3.10 adds no migration (iteration 1 DA, `git diff --stat v0.3.9..HEAD`); its one main-process change is the operations
log's wording of a failure that is not an Error (iteration 2 DA-3). The upgrade is the bundle alone and so is going back
to 0.3.9.

1. The agent installs the signed 0.3.10 bundle in `/Applications`, keeping the 0.3.9 DMG of the v0.3.9 release as the
   way back. The running 0.3.9 keeps running from memory.
2. **The person quits Fabric and opens it again** (Cmd+Q, then open Fabric). This is the one person step: the running
   0.3.9 was opened by the person (`lifecycle.status`, `startedBy: person`), so the broker will not stop it, and the agent
   does not start Fabric through the broker, because the broker stops an app it started after 15 idle minutes
   (CO-382; three stops after the 0.3.9 rollout).
3. The agent checks that the broker did not start Fabric between the quit and the open (`lifecycle.status` says
   `startedBy: person`; no `ensure` for `fabric.desktop` in `~/Library/Logs/local-lifecycle/broker.log` in that window;
   iteration 2 PL-5); if the broker did start it, the person quits Fabric and opens it again, and the agent does not
   stop it through the broker (iteration 3 PL-5). Then the agent verifies the version (0.3.10), the schema (95), the hub (`hub.json` and a `fabric_whoami`), and the scroll on
   the real app (Главная, a project, Настройки, История).

## Owed from 0.3.9's Release close

Carried here so the next releases close them (the version correction goes out with 0.3.10's publication post, the rest
with 0.3.11, CO-383): the posts on the release threads with the version correction (wave 4 is
0.3.11) and the relink of threads `02bf19c5` and `a5969ac5` to `main` (CO-383); the knowledge base's plan rows
(fabric-workspace `knowledge/plans.md`); and the measurements of "How we will know it holds", which now also count the
broker's idle stops (CO-382).

## Iteration 1

Five fresh reviewers, 2026-10-22, against `49f12c9a` (`49f12c9a7d1cc28f82d3f3bfc36966fab3dba874`), read-only in a
detached checkout. Reports: [UX](../reviews/0.3.10/iteration-1/2026-10-22-ux.md),
[errors](../reviews/0.3.10/iteration-1/2026-10-22-errors.md), [documents](../reviews/0.3.10/iteration-1/2026-10-22-docs.md),
[data](../reviews/0.3.10/iteration-1/2026-10-22-data.md), [plan](../reviews/0.3.10/iteration-1/2026-10-22-plan.md).

42 findings, 6 blocking. The one that mattered most: Настройки still did not scroll (UX-1, ER-1): Settings is a `main`
beside the hidden page, outside the scroller, and `.lp`'s vertical `margin:auto` stopped it stretching. Two reviewers
found it independently; the browser test had no Settings case. The plan reviewer found that the 0.3.9 rollout's start
through the broker made Fabric an idle-stopped app (PL-2, CO-382).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1, ER-1 (blocking) | Настройки does not scroll | fixed: every `main` in `.fab-place > .shell` scrolls, with `margin-block:0` against `.lp`'s auto margins (`rail.css`); `shell-scroll.browser.mjs` cases `settings` at 1280 and 800 (watched failing on `49f12c9a`'s stylesheets) |
| V1-2 | ER-2 | `.fab-place` is `overflow:hidden`, scrollable by focus or `scrollIntoView` | fixed: `overflow:clip` (`rail.css`); browser case: focus at the foot of Settings scrolls the page, never the place (it does not tell `clip` from `hidden` once nothing overflows the place: V2-5) |
| V1-3 | ER-3, UX-3 | Notices capped one by one, not together | fixed: the page keeps at least half the place, notices shrink and scroll inside themselves (`rail.css`); browser case `notices` (three tall ones) |
| V1-4 | ER-4 | The unit test does not prove the page's reset | fixed: `Rail.test.tsx` renders `.shell > main.content` and counts resets of that element only (watched failing with the reset loop pointed elsewhere) |
| V1-5 | ER-5, DO-9, UX-6 | The browser test runs in no gate | not a defect for the local gate: `scripts/ci.sh` runs `run-browser-suites.sh`, which ran `shell-scroll.browser.mjs` (`ok` in the 2026-10-22 local `ci.sh fast` log); hosted CI says NOT_RUN without an installed Playwright and Chrome, by CO-171's rule; the stylesheet order in the test's header corrected to the bundle's, and Settings, notices and focus cases added |
| V1-6 | ER-6 | The print rule prints one page | fixed: in print the place and the page are `overflow:visible` with auto height (`rail.css`); the app has no print command |
| V1-7 | UX-2 | After a rail move the keyboard cannot scroll the page | ruled: CO-384, 0.3.11 with wave 4 (moving focus on navigation changes what a screen reader says) |
| V1-8 | UX-4 | The workspace and another project in the same place keep the old position | fixed: LaunchShell's key is App's place key with the project and the workspace (`App.tsx`) |
| V1-9 | UX-5 | Beside a side panel, the agents grid's middle column is the narrowest up to about 1350 px | fixed: one column beside a panel up to 1440 px (`styles.css`) |
| V1-10 | UX-7, DO-13 | SCN-162 has no scroll step; SCR-84 and the notes overstate | fixed: SCN-162 "Scroll (0.3.10)"; SCR-84 and the notes name Settings, the notices and the workspace |
| V1-11 | DO-1 (blocking) | `operating-surfaces.md` still says an older request gets a deadline | fixed: it says the tick expires it at 7 days by the message's time and writes no deadline |
| V1-12 | DO-2, DA-1 (blocking) | `board_request_tick` does not exist | fixed: `board_tick` in CHANGELOG, release-mac and CO-381 |
| V1-13 | DO-3, PL-3 (blocking) | The blind 0.3.10 to 0.3.11 replace rewrote records | fixed: the replace is undone in the carry-over register and the simple plan; one dated reading note at the head of the register says a pre-2026-10-22 row naming 0.3.10 means wave 4, now 0.3.11; P-20 says the renumbering |
| V1-14 | DO-4 | Stale reasons in the version cells; CO-381 kept its pre-resolution plan | fixed: with V1-13 the cells keep their words; CO-381's cell says the notes were corrected |
| V1-15 | DO-5, PL-5 | The handoff's first half still names 0.3.10 as wave 4 | fixed: those sections are marked superseded by the afternoon update |
| V1-16 | DO-6, PL-6 | fabric-workspace `knowledge/plans.md` and the status file still say 0.3.10 is wave 4 | ruled: the knowledge base page is corrected in a fabric-workspace pull request after this release lands (Release close) |
| V1-17 | DO-7 | The renumbering bullet names only wave 4 | fixed: CHANGELOG names the agents' own acts in История and CO-339 too |
| V1-18 | DO-8, PL-10 | The scope omits the CI fixes | fixed: the ledger and P-23 name `ba78b7b8` and `10325066` |
| V1-19 | DO-10, PL-13 | MERGES records a landing that has not happened | fixed: the entry is removed; it is written in the release commit |
| V1-20 | DO-11 | Two map entries link no anchor of what they changed | fixed: this iteration's map entry links the ledger and SCR-84 |
| V1-21 | DO-12 | release-mac says more than the tick does | fixed: "the others that have no deadline of their own" |
| V1-22 | DA-2 | The expiry date has no zone | fixed: "the first tick after 2026-10-28 23:19 UTC" |
| V1-23 | DA-3, PL-12 | release-mac and CHANGELOG have no 0.3.10 schema line | fixed: "0.3.10 admits schema 95" in release-mac, a schema line in CHANGELOG |
| V1-24 | PL-1 (blocking) | No rollout, person steps or Release close | fixed: "Rollout on the operator's Mac" above, with the one person step; the Release close follows the release |
| V1-25 | PL-2 (blocking) | The broker stops Fabric when idle | ruled: CO-382 (the broker's enrollment is the operator's); the rollout no longer starts Fabric through the broker; the 0.3.9 Release close says so |
| V1-26 | PL-4 | Living plan pages still put wave 4 in 0.3.10 | fixed: with V1-13's reading note; the dated plan pages keep their words |
| V1-27 | PL-7, PL-9 | Dated promises name 0.3.10; 0.3.9's V1-42 not carried out; Release close debts not carried | ruled: CO-383 and "Owed from 0.3.9's Release close" above |
| V1-28 | PL-8 | Board asks to Fabric without a row or reply | ruled: CO-383 |
| V1-29 | PL-11 | P-23 is in no lane | fixed: lane 2 names P-23 |

Exit for iteration 1: every finding is fixed or ruled to a register row or the Release close. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-22, against `b6b8d10f` (`b6b8d10fcf14cf1b0885ca32616912c0a216985d`), read-only in a
detached checkout. Four of them stopped on the account's session limit midway and were resumed from where they
stopped. Reports: [UX](../reviews/0.3.10/iteration-2/2026-10-22-ux.md),
[errors](../reviews/0.3.10/iteration-2/2026-10-22-errors.md), [documents](../reviews/0.3.10/iteration-2/2026-10-22-docs.md),
[data](../reviews/0.3.10/iteration-2/2026-10-22-data.md), [plan](../reviews/0.3.10/iteration-2/2026-10-22-plan.md).
Local `ci.sh fast` on `b6b8d10f`: exit 0.

31 findings, 2 blocking. The UX reviewer measured the real React app built from the candidate and found the window
itself still scrolled on a project page (UX-1): visually hidden labels placed against the window made the document
taller, and the wheel over the rail or PageDown moved the rail and the top bar away, down to a blank window (also in
0.3.9). The data reviewer found that the operations log wrote every failed board upkeep pass as «[object Object]»
(DA-3: 17 in the log since 2026-10-21, 13 of them while 0.3.8 still ran).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | UX-1 (blocking) | On a project page the window itself scrolls, down to blank | fixed: pages and panels in the place are `position:relative`, and the main window's document never scrolls (`html:has(.app.launch-root)`, `rail.css`); browser case "the window itself never scrolls" with a hidden label deep in a page, the wheel, PageDown and End (watched failing on `b6b8d10f`'s stylesheets) |
| V2-2 | PL-1 (blocking) | Three iteration-1 receipts say `not a defect`, which the gate refuses | fixed: `not-a-defect`, the gate's word (`scripts/lib/release-gate.mjs`) |
| V2-3 | DA-3 | A failed board tick is logged as «[object Object]» | fixed: `shared/opsLog.ts#errorParts` (named `errorShape` until the final candidate) keeps a plain object's message and code, still redacted; `opsLog.test.ts` (watched failing) |
| V2-4 | ER-1 | Print still prints one page | fixed: in print the window, the shell and the page are auto height and visible, the rail, the top bar and the act line hidden (`rail.css`); browser case (watched failing on `b6b8d10f`) |
| V2-5 | ER-2 | The test named for V1-2 does not fail without it | not a defect: since V1-3 nothing overflows the place, so `clip` and `hidden` behave the same here; `clip` stays as defence in depth, and the focus case proves the outcome (the page scrolls, the place does not) whichever value it has. V1-2's row is corrected by this one |
| V2-6 | ER-3 | The App scroll key has no test | fixed: the key is `shared/appRoute.ts#scrollKeyOf`, with tests in `appRoute.test.ts` (watched failing with the key reduced to the route's kind) |
| V2-7 | ER-4 | In a short window the act line is clipped | fixed: the act line is at most 40 % of the place and scrolls inside itself; browser case at 1280 x 360 |
| V2-8 | ER-5 | A long notice hides its own Dismiss | ruled: CO-385, 0.3.11 |
| V2-9 | ER-6 | Returning from Settings puts the page under it at its top | fixed: Settings is not part of the scroll key (`scrollKeyOf`), so closing it finds the page where it was (SCR-52) |
| V2-10 | ER-7, UX-2, DO-1, DA-4, PL-7 | The notes give 1250 px for the grid and claim the browser test holds it | fixed: 1440 px; the browser test is said to hold the scrolling; the workspace reset and the log fix are named |
| V2-11 | UX-3 | SCN-162's Scroll step names no proof | fixed: it names the browser test, `Rail.test.tsx` and `appRoute.test.ts` |
| V2-12 | DO-2, PL-2 | The reading note misses the rows of 2026-10-22 before P-23; CO-379 had no home | fixed: the note covers rows written before P-23 opened (CO-379 and earlier); P-20 names CO-379 |
| V2-13 | DO-3 | The plan pages that schedule wave 4 carry no pointer to 0.3.11 | fixed: a dated line on the simple plan, its final pass and the onboarding-036 plan |
| V2-14 | DO-4, PL-9 | P-20 dates every renumbering to 2026-10-22 | fixed: 0.3.9 and 0.3.10 from 2026-10-21, 0.3.11 from 2026-10-22 |
| V2-15 | DO-5, DA-1, PL-8 | release-mac sends a 0.3.8 install to a 0.3.9 bundle it does not have | fixed: the 0.3.8 sentence is back in the 0.3.9 paragraph; the 0.3.10 line says a 0.3.8 install copies migration 120 from the installed 0.3.10 bundle |
| V2-16 | DO-6, PL-3 | CO-383 lacks the relink and CO-371's update; the debts' close dates disagree | fixed: CO-383 names both and closes with the release after 0.3.10, as the ledger says; the 0.3.9 ledger points to where its debts went |
| V2-17 | DO-7, PL-6 | The handoff says no person step | fixed: its evening update names the quit-and-open step and CO-382 to CO-385 |
| V2-18 | DO-8 | The iteration-1 map entry overstates the dispositions and links nothing it changed | fixed: it says fixed, ruled or not a defect, and links the ledger; this iteration's entry links the ledger |
| V2-19 | DA-2 | "9 of 10 answered at the first tick" | fixed: P-22 says within two minutes, the first tick at 11:15:22 UTC failed and the next answered nine |
| V2-20 | PL-4 | The knowledge base still says wave 4 is 0.3.10 | fixed: in the same run, a fabric-workspace pull request for `knowledge/plans.md` and Fabric's status file (Release close names it) |
| V2-21 | PL-5 | Between the quit and the open an agent's ensure could make 0.3.10 broker-owned again | fixed: rollout step 3 checks `startedBy: person` and the broker log for that window |

Exit for iteration 2: every finding is fixed or ruled to a register row or the Release close. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-22, against `39b72c07` (`39b72c07ce2414658fae3584265dc6bc90c596e2`), read-only in a
detached checkout. Reports: [UX](../reviews/0.3.10/iteration-3/2026-10-22-ux.md),
[errors](../reviews/0.3.10/iteration-3/2026-10-22-errors.md), [documents](../reviews/0.3.10/iteration-3/2026-10-22-docs.md),
[data](../reviews/0.3.10/iteration-3/2026-10-22-data.md), [plan](../reviews/0.3.10/iteration-3/2026-10-22-plan.md).
Hosted `ci` on `39b72c07`: success. The UX reviewer built the candidate's renderer and ran it in 280 configurations
(20 places, 7 sizes, en and ru): the window never moved and every page reached its foot.

25 findings, 1 blocking (a ledger cell the gate refuses), and 5 more from the verifier of the final candidate's difference. Two reviewers independently found that iteration 2's
`errorShape` turned an object without a message into JSON before redaction, so a `password` or `token` field would reach
the log in clear (ER-1, DA-1; no caller passes such an object today). Its fix and the others below make the final
candidate `__FINAL__`: the reviewers read `39b72c07`, and the receipts and the release gate name the final candidate,
as 0.3.8's did. The difference is the fixes in this table, each with its test watched failing, and the documents. A
fresh verifier read the first version of that difference (`17793816`) and failed it: two rows below were not fixed in
every case the findings named, and three tests proved less than they said (V3-20 to V3-24). A second fresh verifier read
the next version (`a5ab2548`) and failed it again: the one-pass redaction had dropped the text rules (V3-25 to V3-28).
A third, on `ea9adf06`, found a third shape of the same kind (V3-29 to V3-33), and a seam verifier passed it (V3-34).
A fourth, on `1b57a73a`, found the name no longer masked and a code still written (V3-35 to V3-38); the seam verifier
passed `1b57a73a` again.
So the log now writes less instead of masking more: a plain object's values never reach it. The fixes make the final
candidate; the verifiers' reports are kept with the iteration-3 reports.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V3-1 | PL-1 (blocking) | Ledger row V2-5 says `not-a-defect`, which the gate's ledger check refuses | fixed: `not a defect` in the ledger (`scripts/lib/release-gate.mjs` DISPOSED); the receipts keep `not-a-defect` |
| V3-2 | ER-1, DA-1 | `errorShape` serializes an object without a message before redaction: a secret field reaches the log | fixed: such an object is bounded and redacted as a structure before it becomes text (`shared/opsLog.ts#errorParts` (named `errorShape` until the final candidate)); `opsLog.test.ts` "masks a secret field" (watched failing on `39b72c07`) |
| V3-3 | ER-2, DA-2 | `errorShape` runs getters and `toJSON`; a throwing getter drops the record; a huge body is serialized whole; circular and BigInt read «[object Object]» | fixed: own data properties only, `boundStructure` for the rest, a guard that keeps the record; `opsLog.test.ts` "never runs an error's getters" (watched failing) |
| V3-4 | ER-3, UX-1 | In a short window notices push the act line past the window | fixed: the page keeps `min(50%, 100% - 8rem)`; below 640 px of height the notices lose their outer spacing and take at most 15 %, the act line 30 %, the page a third (`rail.css`); browser cases at 240 and at 360 to 900 px with three notices and a refused act |
| V3-5 | ER-4, UX-2 | The short-window case does not fail without the act line's cap | fixed: the tiny-window case with a refused act fails with the cap removed (watched) |
| V3-6 | ER-5 | What App gives the shell as the key is untested | fixed: `appRoute.test.ts` checks App passes `scrollKeyOf(active, workspaceFor)` (watched failing with App's own `placeKey`) |
| V3-7 | ER-6 | `scrollKeyOf`'s tests miss the draft, start path, release and board item | fixed: covered in `appRoute.test.ts` |
| V3-8 | DO-1, DA-3 | "17 since 0.3.9": 13 of the 17 ran under 0.3.8 | fixed: 17 since 2026-10-21, 4 after the 0.3.9 rollout (CHANGELOG, this ledger, the map) |
| V3-9 | DO-2 | The reading note's boundary misses CO-380 and CO-381; CO-380's cell was rewritten | fixed: the boundary is 14:13 UTC, CO-381 and earlier; CO-380's cell keeps its words |
| V3-10 | DO-3 | release-mac gives a wrong reason for a 0.3.8 install's step | fixed: the bundle's first start copies migration 120 into the stack folder |
| V3-11 | DO-4 | The core-reliability plan has no dated 0.3.11 line | fixed: dated line added |
| V3-12 | DO-5, PL-7 | The scope statements omit the operations log fix | fixed: P-23 and this ledger name it |
| V3-13 | DO-6 | V2-17 says the handoff names CO-385; it did not | fixed: the handoff names CO-382 to CO-385 |
| V3-14 | DO-7 | Two merge-log entries carry times before their merges | fixed: 12:42:33Z and 14:30:28Z, the merges' times |
| V3-15 | PL-2 | The release gate is never run on the release commit before it lands | fixed: the release lead runs the gate's library on the release commit before landing (Release close) |
| V3-16 | PL-3 | The Owed list is stale and there is no Release close list | fixed: Owed says which release closes what; the Release close section below |
| V3-17 | PL-4 | CO-383 holds the version correction until 0.3.11 | fixed: CO-383 sends it with 0.3.10's publication post |
| V3-18 | PL-5 | Rollout step 3 says nothing for a failed check | fixed: the person quits and opens Fabric again; the agent does not stop it through the broker |
| V3-19 | PL-6 | The handoff's "Waiting on" still says the person owes nothing | fixed: it points to the quit-and-open step |
| V3-20 | final-candidate verifier (V3-4) | Above 640 px three notices and a long refusal still pushed the act line out (1280 x 720: 472 to 742) | fixed: in the place notices have no outer margin and a small padding, the page keeps `min(40%, 100% - 12rem)` and the act line its 40 % (`rail.css`); browser case at ten window sizes from 1280 x 360 to 1280 x 1200 with a 100-sentence refusal, «Вернуть» focused and in the window (watched failing on `17793816`'s stylesheet and with the act line's cap removed) |
| V3-21 | final-candidate verifier (V3-3) | A revoked Proxy still made the record throw: `instanceof Error` ran outside the guard | fixed: `errorParts` guards the whole reading, the `instanceof` included; `opsLog.test.ts` "never throws on what it is handed" (watched failing on `17793816`) |
| V3-22 | final-candidate verifier | Redaction ran twice: the structural pass's counts were lost and the text pass swallowed fields after a header credential | fixed: the plain object's bounded structure goes through the record's one redaction pass and becomes text after it; `opsLog.test.ts` "masks a plain-object error in the one redaction pass" (counted; `details` and `hint` kept) |
| V3-23 | final-candidate verifier | The DA-2 test passed with getters running; circular and BigInt untested | fixed: a call counter on a getter and `toJSON` that do not throw stays 0 (watched failing with the object serialized through `JSON`); circular and BigInt cases |
| V3-24 | final-candidate verifier | The App key test passed with the key kept only in a comment | fixed: comments are stripped and every `placeKey=` App passes must be `scrollKeyOf(active, workspaceFor)` (watched failing with the old key in a comment) |
| V3-25 | second final-candidate verifier (blocking) | The one-pass fix (V3-22) dropped the text rules over a plain-object error: a header given as a name/value pair, an `x-agw-key` header and an `apikey` field would reach the log in clear | fixed: after the field pass the body becomes JSON with one value per line and the text rules run over it, their counts merged (`opsLog.ts#opsRecord`); `opsLog.test.ts` "runs the text rules over a plain-object error too" (watched failing on `a5ab2548`) |
| V3-26 | second final-candidate verifier | An Error with a non-string message or name gave `null` or an object; a circular message threw | fixed: the name falls back to `Error`, a non-string message goes as a bounded body; `opsLog.test.ts` "says an Error with a non-string name or message as text" (watched failing on `a5ab2548`) |
| V3-27 | second final-candidate verifier | The text redaction misses a bare `PASSWORD=` and a lowercase `password=` (also in v0.3.9) | ruled: CO-386, 0.3.11 |
| V3-28 | second final-candidate verifier | With notices the page keeps 40 % of the place, not half | not a defect: the trade V3-20 states, so the act line fits at every height; the page stays reachable in all 3 780 measured configurations |
| V3-29 | third final-candidate verifier (unit, blocking) | A plain-object error carrying a `{name, value}` header pair named `cookie`, `set-cookie`, `password` or `token` reached the log in clear: a third shape, after the field rule (V3-2) and the text rules (V3-25), in which writing a value and masking it let a value through | fixed by writing less: an Error says its name and message; a plain object with a message says its message and code; any other plain object says the NAMES of its fields that read as field names, never a value (`opsLog.ts#errorParts`); the message goes through the text rules and the shared cap. `opsLog.test.ts` "never writes a value of a plain-object error without a message, whatever shape the secret has" (eight shapes, watched failing on `ea9adf06`). This replaces the body path of V3-22 and V3-25 |
| V3-30 | third final-candidate verifier (unit) | An Error's name and message were read twice; a getter changing between reads gave a number | fixed: each read once (`errorParts`); `opsLog.test.ts` "reads an Error's name and message once each" (watched failing on `ea9adf06`) |
| V3-31 | third final-candidate verifier (unit) | A detail key `__error` stood in for the error | fixed: the error is said apart from the detail; `opsLog.test.ts` "keeps a detail key named __error apart" (watched failing on `ea9adf06`) |
| V3-32 | third final-candidate verifier (unit) | One secret counted twice; a PostgREST object's `details` and `hint` dropped | not a defect after V3-29: no value of an object is written, so nothing is counted twice; `details` and `hint` can hold row data (a key's value), so a refusal says its message and code only |
| V3-33 | third final-candidate verifier (unit) | A bare `Bearer` token, and header pairs or unknown key headers in a record's `detail`, stay in clear (all as in v0.3.9) | ruled: CO-386, widened to these shapes |
| V3-34 | final-candidate verifier (seam, on `ea9adf06`: pass) | A cut message carried no truncation marker; an object whose meaning is in `toString` lost it; ProjectHome's top-of-page reset now runs before `revealSection` aligns a section | fixed: the message is capped by the shared `cap`, with its marker; not a defect: such an object now says its field names; not a defect: `revealSection` re-aligns for 1.5 s after the reset (`LaunchShell.tsx#revealSection`), the seam verifier's reading |
| V3-35 | fourth final-candidate verifier (unit, on `1b57a73a`, blocking); the seam verifier as a risk | An Error's name was no longer redacted or capped, as v0.3.9 did through its object pass: a token in a name reached the record, a 5 000-character name was written whole | fixed: the name goes through the text rules and the shared cap like the message, its counts merged (`opsLog.ts#opsRecord`); `opsLog.test.ts` "redacts and caps an Error's name as v0.3.9 did" (watched failing on `1b57a73a`) |
| V3-36 | fourth final-candidate verifier (unit, blocking) | A plain object without a message still wrote its `code`, a value | fixed: the field-names line carries no code; a code is written only beside a message, and only of a fixed shape (`^[A-Za-z0-9_.-]{1,32}$` or a number, as `causeOf` keeps it); the eight-shapes test adds four code shapes (watched failing on `1b57a73a`) |
| V3-37 | fourth final-candidate verifier (unit) | The single-read test did not watch the message half | fixed: a message getter that changes between reads, watched failing with the message read twice |
| V3-38 | fourth final-candidate verifier (unit); seam verifier (on `1b57a73a`: pass) | A key made only of letters can still be a secret; an Error's own getters run once (as in v0.3.9); a plain object without a message now says only field names (the stated trade) | not a defect: field names are the diagnosis the change keeps, and a letters-only key under 25 characters is written as a name; the Error path reads as v0.3.9 did; the trade is the CHANGELOG's |

Exit for iteration 3: every finding is fixed or ruled to a register row or the Release close. Blocking findings open: none.

## Release close

Written as each step lands: the gate's library run on the release commit; the publication (the tag, the release run,
the assets); the install and the person's quit and open with step 3's broker check; the version, the schema and the hub;
the scroll on the real app; the publication post with the version correction (CO-383); the workspace publication.
