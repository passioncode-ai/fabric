# Fabric 0.3.24 release verification

Release gate ledger for 0.3.24 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.24/`.

0.3.24 carries the CEO agent ([ADR-0197](../../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md)):
a console Fabric keeps with a mandatory fallback runner, the session control tools, the CEO window over the app, the
voice call on the person's own xAI key, the PM chain; and the board dispatcher's bound raised to 5 runs at once. The
operator's order of 2026-11-18: «доделай и когда доделаешь давай деплой и релиз чтобы тестить уже можно было», and of
2026-11-19: «Давай выпускаю версию». Board tasks `a125cc0e`, `b8fc11e4`, `3fc98668`, `e7ff5556`, `ff3fe9c3`.

## Protocol

- Baseline: `v0.3.23` (`cf834842`). The reviewers read the candidate's checkout without writing in it and record HEAD and
  `git status --short | wc -l` before and after.
- Tests are run by file under `nice -n 10`, one run at a time, on a copy made with `git archive` (the machine ran at a
  load between 25 and 130 during this review).
- The review copies are redacted for publication (ADR-0096).
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped. Every non-blocking finding not fixed in its iteration is ruled to CO-597.
- ADR-0197 and its board tasks are the plan of record (no separate spec or plan, acceptance record header).

## What 0.3.24 carries

The `## Unreleased` section of [`CHANGELOG.md`](../../../CHANGELOG.md), renamed `## 0.3.24` at the release, names every
person-visible change. No schema step (schema 102, no migration).

## Spend and prerequisites (PL-7, PL-8)

- The CEO on Claude Code runs on the person's own Claude Code sign-in; on Hermes, on the OpenRouter key the person's
  Hermes is signed in with (Hermes's own setting; no key of Fabric's). The models are those of
  [ADR-0197](../../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-ceos-models).
- The voice call spends the person's own xAI key (`userData/ceo-voice`), else Observatory's slot
  `fabric/prod/XAI_API_KEY`, at USD 0.08 a minute; a call ends by itself after three minutes of silence and at 30 minutes
  (`voiceCall.ts#MAX_CALL_MS`), so one call is at most USD 2.40. No other ceiling, by the operator's rule of 2026-11-19
  (no low limits; large ceilings only).
- Per Mac: the microphone consent, an xAI key (pasted or dropped, [`docs/launch/ceo-setup.md`](../../launch/ceo-setup.md)),
  Hermes signed in with an OpenRouter key for the fallback; a later OpenRouter key added to its workspace's BYOK list for
  `openai/*`.

## Iteration 1

Candidate `b2e350d3500ca599343bdd79537e87eb5a286463` (feat/ceo-agent with 0.3.23's `main` merged). 69 findings, 8
blocking (PL-1, PL-2, DO-1, DO-2, ER-1, ER-2, ER-4, UX-1 = ER-2, UX-2). Fixed in `0322c9b3` (the fixing agent's work,
checkpointed when its account's limit stopped it), `de6b49a1` (documents), `e6262564` (the person's own xAI key),
`7e0bd14c` (acts worded, redaction), `c87e2be3` (the call's bounds). PL-1 was settled by evidence: on the operator's
computer `claude-code` and `hermes` hold live bindings (`fabric_access_list`, 2026-11-19), so the CEO's own-project grant
works there; a launched session's own grant is CO-597 item 1.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V1-DA-1 | DA-1 | non-blocking | ruled: CO-597 |
| V1-DA-2 | DA-2 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DA-3 | DA-3 | non-blocking | ruled: CO-597 |
| V1-DA-4 | DA-4 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DA-5 | DA-5 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DA-6 | DA-6 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DA-7 | DA-7 | non-blocking | ruled: CO-597 |
| V1-DA-8 | DA-8 | non-blocking | ruled: CO-597 |
| V1-DA-9 | DA-9 | non-blocking | ruled: CO-597 |
| V1-DO-1 | DO-1 | blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-2 | DO-2 | blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-3 | DO-3 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-4 | DO-4 | non-blocking | ruled: CO-597 |
| V1-DO-5 | DO-5 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-6 | DO-6 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-7 | DO-7 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-8 | DO-8 | non-blocking | ruled: CO-597 |
| V1-DO-9 | DO-9 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-10 | DO-10 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-11 | DO-11 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-DO-12 | DO-12 | non-blocking | ruled: CO-597 |
| V1-DO-13 | DO-13 | non-blocking | ruled: CO-597 |
| V1-DO-14 | DO-14 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-ER-1 | ER-1 | blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-ER-2 | ER-2 | blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-ER-3 | ER-3 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-ER-4 | ER-4 | blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-ER-5 | ER-5 | non-blocking | ruled: CO-597 |
| V1-ER-6 | ER-6 | non-blocking | ruled: CO-597 |
| V1-ER-7 | ER-7 | non-blocking | ruled: CO-597 |
| V1-ER-8 | ER-8 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-ER-9 | ER-9 | non-blocking | ruled: CO-597 |
| V1-ER-10 | ER-10 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-ER-11 | ER-11 | non-blocking | ruled: CO-597 |
| V1-ER-12 | ER-12 | non-blocking | ruled: CO-597 |
| V1-ER-13 | ER-13 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-PL-1 | PL-1 | blocking | ruled: CO-597 |
| V1-PL-2 | PL-2 | blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-PL-3 | PL-3 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-PL-4 | PL-4 | non-blocking | ruled: CO-597 |
| V1-PL-5 | PL-5 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-PL-6 | PL-6 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-PL-7 | PL-7 | non-blocking | fixed: section Spend below |
| V1-PL-8 | PL-8 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-PL-9 | PL-9 | non-blocking | fixed: the five board tasks moved to review at the release close (journal seq 199297 to 199305) |
| V1-PL-10 | PL-10 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-PL-11 | PL-11 | non-blocking | ruled: CO-597 |
| V1-PL-12 | PL-12 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-PL-13 | PL-13 | non-blocking | ruled: CO-597 |
| V1-PL-14 | PL-14 | non-blocking | fixed: this ledger |
| V1-UX-1 | UX-1 | blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-UX-2 | UX-2 | blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-UX-3 | UX-3 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-UX-4 | UX-4 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-UX-5 | UX-5 | non-blocking | ruled: CO-597 |
| V1-UX-6 | UX-6 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-UX-7 | UX-7 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-UX-8 | UX-8 | non-blocking | ruled: CO-597 |
| V1-UX-9 | UX-9 | non-blocking | ruled: CO-597 |
| V1-UX-10 | UX-10 | non-blocking | ruled: CO-597 |
| V1-UX-11 | UX-11 | non-blocking | ruled: CO-597 |
| V1-UX-12 | UX-12 | non-blocking | ruled: CO-597 |
| V1-UX-13 | UX-13 | non-blocking | fixed in `0322c9b3`..`7e0bd14c` |
| V1-UX-14 | UX-14 | non-blocking | ruled: CO-597 |
| V1-UX-15 | UX-15 | non-blocking | ruled: CO-597 |

Exit for iteration 1: every finding disposed above. Blocking findings open: none.

## Iteration 2

Candidate `2daa1d494321783ca077fe9d51cf33d7bc0a3608`. 28 new findings, 6 blocking (ER-14, ER-15, UX-16, DO-15, DA-10,
PL-15): the console's last line was not redacted; an act on a Switchboard session threw and never reached История; a
limit was read only in the first 20 s; the plan projection was stale. Fixed in `7f04d0ad` and `3781c2ab`, every new test
watched failing on the old code; the CEO's key moved out of its own folder (DA-11).

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V2-DA-10 | DA-10 | blocking | fixed: `7f04d0ad` |
| V2-DA-11 | DA-11 | non-blocking | fixed: `7f04d0ad` |
| V2-DA-12 | DA-12 | non-blocking | ruled: CO-597 |
| V2-DO-15 | DO-15 | blocking | fixed: `7f04d0ad` |
| V2-DO-16 | DO-16 | non-blocking | fixed: `7f04d0ad` |
| V2-DO-17 | DO-17 | non-blocking | ruled: CO-597 |
| V2-DO-18 | DO-18 | non-blocking | fixed: `7f04d0ad` |
| V2-DO-19 | DO-19 | non-blocking | ruled: CO-597 |
| V2-DO-20 | DO-20 | non-blocking | ruled: CO-597 |
| V2-ER-14 | ER-14 | blocking | fixed: `7f04d0ad` |
| V2-ER-15 | ER-15 | blocking | fixed: `7f04d0ad` |
| V2-ER-16 | ER-16 | non-blocking | fixed: `7f04d0ad` |
| V2-ER-17 | ER-17 | non-blocking | ruled: CO-597 |
| V2-ER-18 | ER-18 | non-blocking | ruled: CO-597 |
| V2-ER-19 | ER-19 | non-blocking | ruled: CO-597 |
| V2-ER-20 | ER-20 | non-blocking | ruled: CO-597 |
| V2-ER-21 | ER-21 | non-blocking | fixed: `7f04d0ad` (ADR-0197, the person's own key) |
| V2-ER-22 | ER-22 | non-blocking | fixed: this ledger |
| V2-PL-15 | PL-15 | blocking | fixed: `3781c2ab` (plan projection rebuilt) |
| V2-PL-16 | PL-16 | non-blocking | fixed: this ledger |
| V2-PL-17 | PL-17 | non-blocking | ruled: CO-597 |
| V2-PL-18 | PL-18 | non-blocking | ruled: CO-597 |
| V2-UX-16 | UX-16 | blocking | fixed: `7f04d0ad` |
| V2-UX-17 | UX-17 | non-blocking | ruled: CO-597 |
| V2-UX-18 | UX-18 | non-blocking | ruled: CO-597 |
| V2-UX-19 | UX-19 | non-blocking | ruled: CO-597 |
| V2-UX-20 | UX-20 | non-blocking | ruled: CO-597 |
| V2-UX-21 | UX-21 | non-blocking | ruled: CO-597 |

Exit for iteration 2: every finding disposed above. Blocking findings open: none.

## Iteration 3

Candidate `24e6bdda62362e8cf449e394ed237a17aa3cafff`, the `verifiedCommit`. Iteration 3 ran twice. Run one read candidate `f69917e015f43c2dacd1ab8f6fb2afe1528908c7`. Every iteration-2 finding is fixed or ruled to CO-597 at every
level. 9 new findings, 2 blocking, one defect seen twice (ER-23 and DO-21): the reply window of iteration 2's DO-15 fix
was in the code but not in the CHANGELOG, ADR-0197 decision 2, the AGENTS.md CEO row and the header of
`main/ceoAgent.ts`, which still said a limit counts only before the first answer. Fixed in `24e6bdda`, with ER-25 (a key across the 200-character cut of a console's last line,
now redacted before the cut; test `DA-13 / ER-25` watched failing on the old line), DA-13 (that test) and DO-22
(SCN-182 names the interface's language, SCN-183 an act with no undo). Iteration 2's summary overstated two things
(PL-19): DA-10's fix had no test until DA-13, and DO-18 was half done until DO-22. The local `ci.sh fast` on the
candidate also found `ceoAgent.call.why.microphone` naming macOS on every platform (`platformWords.test.ts`); the
string now names the system settings (the copy check: en `92b4d920`, ru `d101d3f7`, no finding).

Run two read `24e6bdda62362e8cf449e394ed237a17aa3cafff` in fresh contexts (errors and ux; docs, data and plan), each
checking run one's dispositions and then the whole candidate: every run-one finding fixed or ruled, one new
non-blocking finding (DO-23: SCN-184's precondition still names macOS for the microphone while the error string no
longer does), no blocking finding; tests on a copy of the candidate: `ceo-agent` 38, `acts` 15, `ipc-window-policy` 16,
`voiceCall` 11, `actWords` 5, `platformWords` 4, all passing; the read-only gates exit 0. The receipts in
`docs/evidence/reviews/0.3.24/iteration-3/` name run two's candidate; each report carries run one's text after its own.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-DA-13 | DA-13 | non-blocking | fixed: test `DA-13 / ER-25` in `test/ceo-agent.test.mjs` |
| V3-DO-21 | DO-21 | blocking | fixed: CHANGELOG, ADR-0197 decision 2, AGENTS.md CEO row |
| V3-DO-22 | DO-22 | non-blocking | fixed: `docs/ux/scenarios.md` SCN-182, SCN-183 |
| V3-ER-23 | ER-23 | blocking | fixed: the same texts and the `main/ceoAgent.ts` header |
| V3-ER-24 | ER-24 | non-blocking | ruled: CO-597 (a limit quoted by a tool within the 10 s reply window) |
| V3-ER-25 | ER-25 | non-blocking | fixed: `main/ceoTools.ts` `consoleRow` redacts before the cut |
| V3-PL-19 | PL-19 | non-blocking | fixed: this paragraph |
| V3-UX-22 | UX-22 | non-blocking | ruled: CO-597 (the act words for a Switchboard session) |
| V3-UX-23 | UX-23 | non-blocking | ruled: CO-597 (the same case as ER-24, seen by the person) |
| V3-DO-23 | DO-23 | non-blocking | ruled: CO-597 (SCN-184's microphone precondition names macOS) |

Exit for iteration 3: every finding disposed above. Blocking findings open: none.
