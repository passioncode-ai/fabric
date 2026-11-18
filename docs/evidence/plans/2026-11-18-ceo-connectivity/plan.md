# Plan: CEO connectivity in waves

**Status:** plan, 2026-11-18 (task-pipeline stage 4). Spec: [CEO connectivity](../../specs/2026-11-18-ceo-connectivity.md).
Stage 1: ADR-0197 on branch `feat/ceo-agent`. Every wave lands on its own branch from `main`, behind the gates, with
nothing that works today broken by it, and is shipped by the repository's release process.

## Board tasks

| Wave | Fabric board task |
|---|---|
| W0 | `97ec1461` |
| W1 | `6a3de0c8` |
| W2 | `88703f32` |
| W3 | `61850408` |
| W4 | `f7867a3e` |
| W5 | `c09c1336` |
| W6 | `efdb4ef0` |
| W7 | `912f08ab` |
| W8 | `719dc390` |

Each carries its brief (what, why, expected) and points at this plan. They were filed on 2026-11-18 and the board
linked them as spawned from the 0.3.23 release task `3ff9a3e2` (the claim the filing session's project held); their
goal is the CEO task `a125cc0e`, which W1 follows on the board; W0 blocks W2 and W3 blocks W4.

## Gates for every wave

- TDD: each behaviour starts as a failing test; each fixed defect is planted in valid code that behaves like the defect
  and watched being caught (the repository's rule).
- `bash scripts/ci.sh fast` (exit code read directly, never piped), `node scripts/check-registers.mjs`,
  `bash scripts/check-docs.sh`, `node scripts/check-design-map.mjs --refresh` then `node scripts/check-design-map.mjs`,
  `node scripts/check-regions.mjs` (new code fenced with `#region ... docs:` pointing at the spec's headings).
- The design map's `#changelog` entry and the merge-log line in the same change (AGENTS.md, iteration contract).
- New journal event types: an `event_types` row and `event.<type>` in `i18n/en.ts` and `ru.ts`.
- New user-facing strings: the copywriting skill, the copy checker's `check` (roles title, label, button, body), and
  `grep -n "$(printf '\342\200\224')"` over changed files prints nothing.
- Guarded files (`docs/architecture/*`, `docs/adr/**`, `CONTEXT.md`, `docs/vision.md`, `docs/evidence/**`) under an
  agent-sync lease; ADR ids by `agent_sync.py reserve ADR`.
- The machine's load: heavy steps under `nice -n 10`; no full `ci.sh full` while load is above 100.

## W0. Asks to other owners (no Fabric code)

| Ask | To | What | Why it is first |
|---|---|---|---|
| W0.1 | the communicator's repository | command kind `ceo.ask` (spec §4.1), one `deviceId` per computer with commands addressed to a device and the 2-minute forward rule (§4.2), the thread watcher forwarding `fabric-ceo-result/1`, questions and `tell` notes, attachments as local paths with sha256; and a look at why 14 of its last 20 commands failed on 2026-11-18 | the riskiest dependency (spec §15.6) |
| W0.2 | the host agent (studio-agent) | a Fabric board service in the Studio's operator space, so a CEO can run there (spec §5) | the always-on CEO |
| W0.3 | Fabric itself (row CO-568) | `board.submit` for registered services, ADR by 2026-11-21 | the communicator and the peer door file through it |

Exit: each ask is filed on the board with `com.submit` (kind request) and its answer read; the dates they give are
written into this plan's dependency table (spec §17).

## W1. The CEO's mailbox

**Builds:** spec §3 and §4.4.

| File | Change |
|---|---|
| `apps/desktop/src/shared/ceoTask.ts` (new) | `fabric-ceo-task/1` and the four reply blocks: parse (last block wins), validate, refusals `invalid-envelope`, `ceo-loop`, `hops-exceeded`, `cross-context`; UUID v5 child keys; priority order |
| `apps/desktop/src/shared/ceoTask.test.ts` (new) | vitest: every field's bounds, a planted loop, hops 3, a 65 KB body, a missing `operator` scope |
| `apps/desktop/src/main/hubPorts.ts` | a `ceo` port with `ensure()` (one implementation in the window's process) |
| `apps/desktop/src/main/boardCycle.ts` | a `ceo.task` request with no live responder calls `ceo.ensure` at once when the port answers, else the dispatcher's path |
| `apps/desktop/src/main/ceoAgent.ts` (stage 1) | the brief written at admission and at every board start; the brief names the envelope, I-8 and the floors |
| `apps/desktop/src/main/ceoTools.ts` (stage 1) | `session_start` takes `key` (`ceo-start:<task>:<project>`); a repeated key answers the first session |
| `supabase/migrations/<next>_ceo_task_events.sql` | `event_types` rows `ceo.task.received@1`, `ceo.task.delegated@1`, `ceo.task.settled@1`, `peer.link.changed@1` |
| `apps/desktop/src/renderer/src/i18n/en.ts`, `ru.ts` | `event.<type>` sentences |
| `apps/desktop/test/ceo-mailbox.test.mjs` (new) | node:test with fakes of the board door: a request wakes the console through the port; without the port, the dispatcher path; a repeated start key starts once (planted: a start with no key starts twice) |

**Acceptance:** spec A-5; a `ceo.task` from a fake service lands, wakes the console, is claimed once, and its result is
posted with `ceo-result:<task>`.
**Depends on:** stage 1 landed.

## W2. Telegram to this computer's CEO

**Builds:** spec §4.1 to §4.3 (Fabric's side).

| File | Change |
|---|---|
| `apps/desktop/src/main/boardService.ts`, `hubTools.ts` (with CO-568) | `board:<Fabric CEO>/ceo.task` grantable to the communicator's binding; its requests marked `trusted` |
| `apps/desktop/src/shared/ceoTask.ts` | attachment checks: an absolute path under the same OS account, sha256 matches, at most 25 MB; else the attachment is named as missing, never read |
| `apps/desktop/src/main/ceoAgent.ts` | the brief's Telegram rules: questions through `fabric_question_ask`, `tell` at most hourly, results with receipts, 3500 characters |
| `apps/desktop/test/ceo-telegram.test.mjs` (new) | the communicator's fake binding files twice under one key: one request (planted: a key dropped on retry); a stack 503 then success with the same key |

**Acceptance:** spec A-1 to A-4, A-6 and A-7 in a live walk with the communicator once W0.1 is delivered; until then A-1
to A-4 against a fake communicator.
**Depends on:** W1, W0.1, W0.3.

## W3. The peer door and pairing

**Builds:** spec §6.2 to §6.4.

| File | Change |
|---|---|
| `apps/desktop/resources/bin/fabric-peer-serve` and `apps/desktop/src/main/peerServe.ts` (new) | the forced-command entry: JSON lines on stdin, six operations, `NOT_ALLOWED` otherwise, the credential from stdin only, `hub.json` read locally with the pid check, rate limits, exit codes |
| `apps/desktop/src/main/accessService.ts` | a peer binding kind with its computer and tier (T1 on the operator's computer, T2 when an organization's administrator allows); the principal `peer:<computer>` |
| `apps/desktop/src/main/peerPair.ts` (new) | pairing and unpairing (spec §6.3): the dedicated key, `--pair` over the existing login, the `authorized_keys` line under a lock and idempotent, the credential into the vault by `vault.py` on stdin |
| `apps/desktop/test/peer-serve.test.mjs` (new) | a malformed line exits 2; an unknown op is `NOT_ALLOWED`; a credential in argv is refused; a T2 binding's `operator` dropped (planted: the principal read from the request) |
| `apps/desktop/test/peer-pair.test.mjs` (new) | two data folders and `ssh localhost` in a disposable `HOME`: pairing writes one line; a second pairing writes none; unpairing removes it and revokes the binding |

**Acceptance:** spec A-12; R-4 over the door.
**Depends on:** W0.3 (the board door for a binding), W1.

## W4. CEO to CEO

**Builds:** spec §6.5 and §7.

| File | Change |
|---|---|
| `apps/desktop/src/main/ceoPeerLink.ts` (new) | the client in the board's process: transport order, the outbox file, backoff from 30 s to 10 minutes, link states, `peer.link.changed@1` |
| `apps/desktop/src/main/ceoChildren.ts` (new) | `remote.*` operations; the child envelope built by code; the poller (60 s, 10 minutes after 2 hours, on wake); the mirror into the parent's thread; the model woken only on a question, a result or a refusal; the cancel cascade; questions up and answers down |
| `apps/desktop/src/main/ceoTools.ts` | `remote.submit`, `remote.get`, `remote.events`, `remote.answer`, `remote.cancel`, `computers.list` |
| `apps/desktop/test/ceo-children.test.mjs` (new) | R-1, R-3, R-8, R-10, R-11 with two data folders over `ssh localhost` (planted: a poller that wakes the model on every note; a child path that omits this computer) |

**Acceptance:** spec A-8 to A-10; R-1, R-3, R-8, R-10, R-11.
**Depends on:** W3.

## W5. Two doors and the interface

**Builds:** spec §9 and §11.

| File | Change |
|---|---|
| `apps/desktop/src/main/ceoTools.ts` | `ceo.search` and `ceo.execute` over one operation table; stage 1's tool names kept callable for one release and out of the listing |
| `apps/desktop/src/renderer/src/ceo/CeoPopup.tsx` (stage 1) and `ceo/CeoTasks.tsx` (new) | the head's computers, the «Поручения» and «Сессии» tabs, in-place answers, the acts |
| `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx` | the «CEO» section (spec §9.2) |
| `apps/desktop/src/shared/ipcWindowPolicy.ts`, `preload/api.ts` | the popup's acts call the same operations |
| `docs/ux/scenarios.md`, `docs/ux/product-model.json`, `scripts/product/` | the scenarios and routes for «Поручения» and Settings, then `node scripts/sync-product-ux.mjs` and `node scripts/build-product-report.mjs` |
| tests | `CeoTasks.test.tsx` (states, empty and failed lines), a parity test: every popup act is an operation in `ceo.search` (A-13) |

**Acceptance:** A-13, A-15; the screens stand and a design review over the new screens.
**Depends on:** W1; W4 for the computers' rows.

## W6. Observability and the resilience walk

**Builds:** spec §12 and §14.

| File | Change |
|---|---|
| `apps/desktop/src/main/ceoHealth.ts` (new) | the five `agent-health/1` checks; one Telegram message per episode through the communicator |
| ops records in W1 to W5's code | `ceo.inbound`, `peer.call`, `peer.pair`, `ceo.delegate`, `ceo.loop-refused`, `decision-dropped-t2`, `ceo.ensure`, each with `trace` |
| `apps/desktop/test/ceo-resilience.test.mjs` (new) | R-2, R-5, R-6, R-7, R-9 and the marker test of A-14 |
| `docs/evidence/plans/2026-11-18-ceo-connectivity/acceptance.md` (new) | the walk of A-1 to A-16 on a development build with its own data folder and a disposable stack, each line with its receipt |

**Acceptance:** A-14, A-16 and the whole walk.
**Depends on:** W1 to W5.

## W7. Organizations

**Builds:** spec §8.

| File | Change |
|---|---|
| `apps/desktop/src/main/ceoAgent.ts` | one CEO per (computer, context) that enabled one, after CO-422 C1 and C2 |
| `apps/desktop/src/main/peerServe.ts` | `ceo.intake` on T2 bindings; the payload projection; `operator` dropped |
| `apps/desktop/src/shared/ceoTask.ts` | the scope gate's check at the sender and at the door (the private denylist read from the routes file, never named in the repository) |
| tests | A-11; a personal record planted in an intake payload is refused at the sender |

**Acceptance:** A-11.
**Depends on:** CO-422 C1 and C2, CO-552, CO-513 (an organization's Fabric on the Studio), the people-ask routes.

## W8. The relay transport

**Builds:** spec §6.1 (the relay row) and §6.5 step 1.

| File | Change |
|---|---|
| `apps/desktop/src/main/ceoPeerLink.ts` | the same six operations as sealed envelopes over `fabric-relay/0.1`; the relay first, ssh as the fallback |
| tests | R-3 and R-11 over the relay; a device reported offline shows `asleep` |

**Acceptance:** A-8 with the MacBook asleep through the whole child's work.
**Depends on:** RLY-05 (hosted relay), CO-453 (Fabric's relay client).

## Order

W0 now. W1 as soon as stage 1 lands. W2 and W3 in parallel after W1 (W2 needs W0.1 and W0.3 to finish live). W4 after
W3; W5 after W1, finishing its computers' row after W4. W6 closes W1 to W5. W7 and W8 wait on their dependencies and
take nothing from W1 to W6 that is not already built.

## Open questions, each with the answer chosen

Decided by the operator's recorded decisions, then the project's goal, then the safest reversible option, so the waves
proceed without asking.

| # | Question | Answer | Why |
|---|---|---|---|
| Q-1 | Which computer answers an unpinned Telegram order? | The default device (this MacBook), and after 2 minutes without a poll the Studio's operator space; a pinned order waits up to 6 hours | The operator works on the MacBook; the Studio is the always-on place (north-star §2); a forward is withdrawn from the first device, so it is reversible and never doubled |
| Q-2 | Does every free-text Telegram message go to the CEO? | No: an order naming a project goes to that project (BL-1506); a reply goes to its thread; commands stay; the rest goes to the CEO | The CEO must not become a bottleneck for what the board already routes |
| Q-3 | Delegate by board request or by typing into a console? | Board request by default; a console only to answer it or on the operator's explicit order | Tracked, survives restarts, wakes absent agents, returns receipts |
| Q-4 | How many hops? | Two (person, CEO, CEO) | Enough for a laptop CEO to use the Studio; bounds loops |
| Q-5 | How often does a parent poll a child? | 60 s while open, 10 minutes after 2 hours without change, at once on wake | ssh plus a read costs no model; the slower rate after 2 hours keeps a forgotten child cheap |
| Q-6 | Who approves a pairing? | On the operator's own computers, allowed at once and recorded (ADR-0115 amendment); on an organization's computer, its administrator | The operator's computers are T1; an organization decides its own door |
| Q-7 | Do CEOs of different organizations delegate to each other in v1? | Only through `ceo.intake` at T2, paired by the receiving administrator, with no operator words crossing | North-star §11: organizations accept calls only from their own agents unless granted |
| Q-8 | Who tells the operator a result? | The root CEO, through its thread and the communicator; a child never | I-8 |
| Q-9 | Telegram voice? | Transcribed on the communicator's side; the envelope says `voice` | The PM agents already do it; Fabric keeps no audio |
| Q-10 | Attachment size? | At most 20 MB through Telegram (its bot limit; stage 1's own cap is 25 MB); larger as a link | The lower of the two limits |
| Q-11 | Where does the Studio's CEO run before ADR-0195 W3? | On demand, as the dispatcher's run in its CEO folder | Uses only what exists; replaced by a hosted console after W3 |
| Q-12 | ssh or the relay first? | ssh now; the relay first once RLY-05 and CO-453 pass this spec's A-8 over it; ssh stays as the fallback | Ship what works today; move to store-and-forward when it is real |
| Q-13 | Is an ADR needed? | Yes, the draft below; it needs an ADR id from `agent_sync.py reserve ADR` and a lease before it lands, in W1's change | A new channel into the board and a new principal kind are settled choices |

## Risks

| Risk | Answer |
|---|---|
| The communicator's reliability (14 of 20 commands failed on 2026-11-18) and its single device | W0.1 asks first; Fabric's own paths keep working without it; the walk measures it |
| Many dependencies on other owners (CO-568, CO-422, CO-552, RLY-05, the Studio's Fabric) | Each wave names its own and builds nothing on an unbuilt one; W1, W3, W4, W5 and W6 need only Fabric |
| A CEO model misreading an order stops a session | Stage 1's reason and read-first rules stay; kill asks once in the window; the floors hold |
| `authorized_keys` edits on another OS account | Only the forced-command line, under a lock, idempotent by comment, removed on unpairing; done by that account's own `--pair` |
| A credential leak in a log or message | Stdin only; the marker test of A-14 |
| The machine's load (around 140 on 2026-11-18) breaks timing tests | Fake clocks in tests; timing tests carry their own deadlines, not wall-clock sleeps |

## Appendix: ADR draft (needs an id and a lease)

**Title:** CEOs are reached through their board, and computers through a peer link

**Status:** proposed, 2026-11-18. Extends ADR-0197 (the CEO is a console session), ADR-0149 (the board's participants),
ADR-0115 (bindings) and CO-568 (`board.submit`).

**Context.** Stage 1 gave each computer one CEO reached only from Fabric's window. The operator's order of 2026-11-18
asks for the CEO from his Telegram connector, from other computers, between CEOs and between organizations. The hub is
loopback only, each Fabric keeps its own board, the communicator serves one device, and the relay is not deployed.

**Decision.**

1. Everything that reaches a CEO is a board request `ceo.task` on its own computer's board, carrying the envelope
   `fabric-ceo-task/1`; no channel types into the CEO's console.
2. Computers reach each other's boards through a peer link: an ssh forced command `fabric-peer-serve` that names the
   calling computer from its key and calls the local board door as a peer binding with six operations; the relay
   (`fabric-relay/0.1`) becomes the first transport once deployed. The hub never listens on a network.
3. Status is pulled, never pushed; a child CEO never contacts the operator; delegation is at most two hops.
4. The operator's words are believed only from T0 or T1; a T2 peer's `operator` block is dropped.
5. Across organizations only an intake `ceo.intake` at T2, paired by the receiving organization's administrator, carries
   a request; an organization's CEO reports to its own administrator through its PM agent.
6. The CEO's operations are served behind `ceo.search` and `ceo.execute`.

**Consequences.** One history per task across every channel; a sleeping computer delays and never loses a task; a
communicator device per computer and CO-568 are prerequisites owned elsewhere; the forced-command line is a new artefact
on each paired account, managed only by pairing and unpairing.
