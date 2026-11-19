# Fabric 0.3.25 release verification

Release gate ledger for 0.3.25 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02). Three
iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh model context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.25/`.

0.3.25 carries the CEO window redesigned (the call as a panel in the chat, the character's face on the CEO button),
the CEO's voice by character (male by default, male or female in Your Fabric and at the first run), and the CEO's
stop ([ADR-0197](../../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md) amendment 2).
The owner's order of 2026-11-19 (relayed by the CEO agent on the board, request `3aa89c92`): «пусть он это всё
изымплеметит быстро и выпустит. чтобы мы дальше могли голосом общаться и менеджерсессии», with «Ревьюеров не ждать».

## Protocol

- Baseline: `origin/main` `53e8c3e2` (0.3.24 and the home CEO card).
- The reviewers. Every Claude subscription of this machine and the Codex account were at their usage limits on the
  evening of 2026-11-19 (Switchboard and `codex exec` both refused; the first workflow of five Claude reviewers stopped
  at «You've hit your session limit»). The reviews ran on OpenRouter with Fabric's own key
  (`fabric/prod/OPENROUTER_API_KEY`, issued that evening, ceiling USD 100 a month): `anthropic/claude-sonnet-5.5` for
  ux, docs and plan, `moonshotai/kimi-k3.1-pro` for errors and data, each a fresh context given the candidate's diff
  against the baseline (generated reports left out), the changed CEO files in full and the map's entries. They read;
  they ran nothing. The release session ran the tests and the built app.
- A finding is fixed (with its test or check), ruled (to CO-601), not a defect (with why), not recoverable, or stopped.
- Spend: about USD 0.9 an iteration on the review key.

## What 0.3.25 carries

The `## Unreleased` section of [`CHANGELOG.md`](../../../CHANGELOG.md), renamed `## 0.3.25` at the release. No
schema step (schema 102, no migration).

## Iteration 1

Candidate `91d952ded1cfe6bdd46b6ae288927471037875aa`. Reports and receipts in
[`docs/evidence/reviews/0.3.25/iteration-1/`](../reviews/0.3.25/iteration-1/). 32 findings, 3 blocking: the person's
stop had three races (ER-1 a stop during a start in flight, ER-2 a message during the stop, ER-3 a deferred fallback).
Fixed in `4b7acb6f` with tests `ER-1 (0.3.25)`, `ER-2 (0.3.25)`, `ER-6 (0.3.25)` in
`apps/desktop/test/ceo-agent.test.mjs`, each seen failing before the fix; `ER-3 (0.3.25)` guards the third.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V1-DA-1 | DA-1 | non-blocking | fixed in `4b7acb6f`: kept records validated one by one (CeoCall.tsx#readKept) |
| V1-DA-2 | DA-2 | non-blocking | fixed in `4b7acb6f`: CEO_USES names ceoAgentTakeCall; ipc-window-policy 16 of 16 |
| V1-DO-1 | DO-1 | non-blocking | fixed in `4b7acb6f`: the ceo-agent region header names the person's stop and «Перезапустить» |
| V1-DO-2 | DO-2 | non-blocking | fixed in `4b7acb6f`: SCN-187 step 3 says a message starts it on the first agent not set aside |
| V1-DO-3 | DO-3 | non-blocking | fixed in `4b7acb6f`: the CeoButton.tsx header no longer contradicts itself |
| V1-DO-4 | DO-4 | non-blocking | fixed in `4b7acb6f`: SCN-184 coverage reordered, its design rationale names the panel in the chat |
| V1-ER-1 | ER-1 | blocking | fixed in `4b7acb6f`: stop awaits a start in flight and start stops a console opened while held; test ER-1 (0.3.25), red before the fix |
| V1-ER-2 | ER-2 | blocking | fixed in `4b7acb6f`: send awaits the stop before clearing the hold; test ER-2 (0.3.25), red before the fix |
| V1-ER-3 | ER-3 | blocking | fixed in `4b7acb6f`: the stop drops a deferred fallback and fallBack and startFallback check the hold; test ER-3 (0.3.25) |
| V1-ER-4 | ER-4 | non-blocking | fixed in `4b7acb6f`: a sample that fails closes its AudioContext (VoicePicker.tsx#listen) |
| V1-ER-5 | ER-5 | non-blocking | fixed in `4b7acb6f`: a listen generation; a stale or unmounted sample is closed unplayed |
| V1-ER-6 | ER-6 | non-blocking | fixed in `4b7acb6f`: personStopEnded after the other doors' stop; test ER-6 (0.3.25), red before the fix |
| V1-PL-1 | PL-1 | non-blocking | fixed in `4b7acb6f`: calls kept on this computer, ten |
| V1-PL-2 | PL-2 | non-blocking | fixed in `4b7acb6f`: as DA-2; voice-ready and voice-sample MAIN_ONLY |
| V1-PL-3 | PL-3 | non-blocking | not a defect: personaRead is allowed to the CEO window (CEO_USES); the face and name of the chosen character were seen in the built app; setDraft spreads the draft, so voice is kept |
| V1-PL-4 | PL-4 | non-blocking | fixed in `4b7acb6f`: as ER-1 and ER-6 |
| V1-PL-5 | PL-5 | non-blocking | fixed in `4b7acb6f`: CeoPopup passes composerTools to the composer's tools slot |
| V1-PL-6 | PL-6 | non-blocking | partly fixed in 4b7acb6f (XAI_KEY_SLOT); the live sample and the vault deadline ruled: CO-601 items 3 and 4 |
| V1-PL-7 | PL-7 | non-blocking | fixed in `4b7acb6f`: the call ask is dropped when the CEO window closes (index.ts) |
| V1-PL-8 | PL-8 | non-blocking | fixed in `4b7acb6f`: an ended call without a problem shows only in the history |
| V1-UX-1 | UX-1 | non-blocking | fixed in `4b7acb6f`: role=status on the state label only (CeoCall.tsx#CallPanel) |
| V1-UX-2 | UX-2 | non-blocking | fixed in `4b7acb6f`: the listen button's name follows its state (VoicePicker.tsx); test 'Стоп: Женский' |
| V1-UX-3 | UX-3 | non-blocking | fixed in `4b7acb6f`: native radio inputs (VoicePicker.tsx) |
| V1-UX-4 | UX-4 | non-blocking | fixed in `4b7acb6f`: the last ten calls kept in localStorage (CeoCall.tsx#readKept); SCN-184 and CHANGELOG say so |
| V1-UX-5 | UX-5 | non-blocking | fixed in `4b7acb6f`: a stopped CEO shows only «Запустить»; «Остановить» only running or starting (CeoPopup.tsx) |
| V1-UX-6 | UX-6 | non-blocking | not a defect: the tokens are defined in tokens.app.css, which ceo.tsx imports; the rings were seen in the built app (walk screenshots) |
| V1-UX-7 | UX-7 | non-blocking | ruled: CO-601 item 1 |
| V1-UX-8 | UX-8 | non-blocking | ruled: CO-601 item 2 |
| V1-UX-9 | UX-9 | non-blocking | fixed in `4b7acb6f`: personStopEnded releases the hold (ceoAgent.ts); test ER-6 (0.3.25) |
| V1-UX-10 | UX-10 | non-blocking | fixed in `4b7acb6f`: CEO_USES names ceoAgentTakeCall; voice-ready and voice-sample are MAIN_ONLY |
| V1-UX-11 | UX-11 | non-blocking | fixed in `4b7acb6f`: the call time uses the app's locale (CeoCall.tsx#CallPanel) |
| V1-UX-12 | UX-12 | non-blocking | fixed in `4b7acb6f`: «Остановить» works while starting; start stops what it opened when held; test ER-1 (0.3.25) |

Exit for iteration 1: every finding disposed above. Blocking findings open: none.

## Iteration 2

Candidate `938f4b16e3a2adcb94f6ab6570ed66e81a56c79a`. Reports and receipts in
[`docs/evidence/reviews/0.3.25/iteration-2/`](../reviews/0.3.25/iteration-2/); each reviewer was given its level's
iteration-1 report to check first. Every iteration-1 finding fixed or ruled, except UX-6 (not a defect: the tokens are
defined where the CEO window loads them). 26 findings, 3 blocking, all one defect: a message, a person's restart or a
console-window stop could still race the person's stop (ER-7, ER-8) and a stop during a start could report success while
the console it opened kept running (ER-9). Fixed with one person-stop marker every door waits for, tests `ER-7 (0.3.25)`,
`ER-8 (0.3.25)`, `ER-9 (0.3.25)` seen failing first. The data reviewer of this iteration ran twice: on Kimi it spent its
whole budget reasoning and returned nothing, so it ran again on `anthropic/claude-sonnet-5.5`.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V2-DA-3 | DA-3 | non-blocking | fixed in iteration 3's candidate: the sample folders are created 0700 (index.ts voiceSample handler) |
| V2-DA-4 | DA-4 | non-blocking | fixed in iteration 3's candidate: a sample is written beside and renamed into place |
| V2-DA-5 | DA-5 | non-blocking | ruled: CO-601 item 5 (a way to clear kept calls); each kept line is now cut at 2000 characters |
| V2-DO-5 | DO-5 | non-blocking | fixed in iteration 3's candidate: ADR-0197 amendment 1 names the call component of that day in words |
| V2-DO-6 | DO-6 | non-blocking | fixed in iteration 3's candidate: CO-597 item 4 says the voice is done in 0.3.25 |
| V2-DO-7 | DO-7 | non-blocking | fixed in iteration 3's candidate: SCN-182 UI elements and rationale |
| V2-DO-8 | DO-8 | non-blocking | fixed in iteration 3's candidate: SCN-184 and SCN-186 coverage symbols carry their full paths |
| V2-ER-7 | ER-7 | blocking | fixed in iteration 3's candidate: one person-stop marker that send and a person's restart wait for (ceoAgent.ts beginPersonStop, waitPersonStop); test ER-7 (0.3.25), red before the fix |
| V2-ER-8 | ER-8 | blocking | fixed in iteration 3's candidate: the console-window door begins the same marker; the console's end or personStopEnded ends it; test ER-8 (0.3.25), red before the fix |
| V2-ER-9 | ER-9 | blocking | fixed in iteration 3's candidate: a console the stop could not end during a start stays the CEO's and the stop answers still-running; test ER-9 (0.3.25), red before the fix |
| V2-ER-4 | ER-4 | non-blocking | fixed in iteration 3's candidate: the sample's context is installed only after start and closed on every failure (VoicePicker.tsx#listen) |
| V2-ER-6 | ER-6 | non-blocking | fixed in iteration 3's candidate: personStopEnded in a finally on both other doors (index.ts) |
| V2-PL-3 | PL-3 | non-blocking | not a defect: personaRead is allowed to the CEO window (ipcWindowPolicy.ts, CEO_USES in ipc-window-policy.test.mjs); the handler's voice is xaiVoiceOf(persona().persona), xaiVoiceOf tested in persona.test.ts; setDraft spreads the draft, so voice is kept; the chosen face showed in the built app's CEO window |
| V2-PL-5 | PL-5 | non-blocking | fixed in iteration 3's candidate: CeoPopup's composerTools names its render site, ceo.tsx; the other session wires its button there |
| V2-PL-8 | PL-8 | non-blocking | fixed in iteration 3's candidate: an ended call shows its reason only; its lines live in the history |
| V2-PL-9 | PL-9 | non-blocking | fixed in iteration 3's candidate: the kept call is written outside the state updater (CeoCall.tsx useVoiceCall keep) |
| V2-PL-10 | PL-10 | non-blocking | ruled: CO-601 item 5 |
| V2-PL-11 | PL-11 | non-blocking | fixed in iteration 3's candidate: test 'the kept calls' (CeoPopup.test.tsx) for readKept |
| V2-PL-12 | PL-12 | non-blocking | ruled: CO-601 item 6 |
| V2-UX-6 | UX-6 | non-blocking | not a defect: every token named is defined in apps/desktop/src/renderer/src/tokens.app.css, which ceo.tsx imports (lines 59 to 109 of that file); the rings rendered in the built app's walk |
| V2-UX-13 | UX-13 | non-blocking | fixed in iteration 3's candidate: one hang-up, the head's (CeoCall.tsx#CallPanel); test 'the call button' |
| V2-UX-14 | UX-14 | non-blocking | fixed in iteration 3's candidate: a stopped CEO's start is the body's alone; role=status on its sentence only (CeoPopup.tsx) |
| V2-UX-15 | UX-15 | non-blocking | fixed in iteration 3's candidate: SCN-182 UI elements and rationale name the call opening in the CEO window |
| V2-UX-16 | UX-16 | non-blocking | (a) fixed in iteration 3's candidate: the no-key hint shows only once readiness says no; (b) the unused string ruled: CO-601 item 7 |
| V2-UX-17 | UX-17 | non-blocking | fixed in iteration 3's candidate: CallPanel renders nothing with no live call and no history |
| V2-UX-18 | UX-18 | non-blocking | fixed in iteration 3's candidate: the set-aside time uses the app's locale (CeoPopup.tsx) |

Exit for iteration 2: every finding disposed above. Blocking findings open: none.
