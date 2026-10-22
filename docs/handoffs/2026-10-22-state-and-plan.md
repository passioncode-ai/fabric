# Fabric: state, what is left, and the next task (2026-10-22)

The operator, 2026-10-22: review what the previous sessions did and left, check the real state, finish what is
unfinished, merge it into the project plan and into fabric-workspace as the one place every agent reads. Measured on
`main` at `747b0306` and on the operator's Mac at 11:00 to 11:40 UTC.

## State

- **Released and running.** Fabric 0.3.9 (P-22, the core holds) is published and rolled out: schema 95, started
  through the lifecycle broker at 11:14 UTC, the hub up, coding agents rejoined by themselves
  ([Release close](../evidence/plans/2026-10-21-release-039-verification.md#state-on-2026-10-22)). Before this session
  the rollout had stopped after its step 2: the 0.3.9 bundle was installed but the running app was 0.3.8 on schema 94,
  and at 11:02 UTC a restart onto 0.3.9 refused the old schema and left the hub answering 503 for 12 minutes.
- **Fixed in this session, on `agent/ui-scroll-0310`.** No page of Fabric could be scrolled since 0.3.7 (the operator:
  «главный экран не скроллится»): the shell grew past a clipping box. The page now scrolls inside a shell of the
  window's height; a review of every screen found three more blocking layout defects in the first fix and six minor
  ones, all fixed and held by `scripts/test/shell-scroll.browser.mjs` (54 checks, watched failing on `main` and on the
  first fix). CHANGELOG `Unreleased`, SCR-84, the map entry `iteration-2026-10-22-shell-scroll`.
- **CI.** Hosted `ci` green on `main` (`747b0306`, run 39713096108). `workspace publication` green.

## Left, in priority order

1. **Fabric 0.3.10 (P-20)**: the simple plan's wave 4 (the five places rebuilt to the prototype, История's filters,
   the first run, the walk from zero), enrollment on the contract's resolver (CO-339, CO-343), CO-331's aliases, the
   hardening rows P-20 names, the core audit's carried rows CO-364 to CO-375, CO-377, CO-378, and now CO-380 (dead
   rules of the old shell) and CO-381 (a board request left without a deadline after the upgrade). The scroll fix
   ships in it.
2. **0.3.9's Release close**: the posts on the release threads and, after a few days of the new build, the
   measurements of the plan's "How we will know it holds" against the audits' baselines (availability 86.9 %, 25 of
   41 sessions without hooks, 6 of 6 requests queued).
3. **CO-282** (portable harness waves, the Fabric task in backlog): N-030 closed only with a workspace publication of
   the landed candidate; N-037 native host acceptance; N-038, N-009, N-010 owner acceptance.

## Waiting on

- A person: nothing for 0.3.9 (the broker started the app it then stopped). CO-365 needs a real reboot to be measured.
- Other projects: CO-331's remainder (fabric-agent-contract, project-observatory, fabric-switchboard; thread
  `617c8cbe`); CO-371 (the hub's 503 body and the backoff, fabric-agent-adapter and fabric-agent-contract).

## Branches with nothing left to land

Every code file these branches touch already reads on `main` as on the branch (`git diff <branch> main -- <file>`
empty for each): `agent/auto-project-registration-20261017`, `agent/co328-auto-attribution`,
`agent/comms-time-filters`, `agent/harness-*-20261013` (seven), `agent/load-tests`, `agent/onboarding-036-w1`,
`fix/aptabase-build-mode`, `keep/release-031-1f5b83f0`. They are kept as refs; nothing on them is lost if removed.
The Fabric task «Довести волну 3 Fabric 0.3.7 … до main» is in review and its work is released in 0.3.7; closing it is
the operator's move.

## Exact next task

Land `agent/ui-scroll-0310` on `main` (its gates in the commit message), then start 0.3.10 (P-20) with CO-381 (a
failing test for the request the first tick skipped), then wave 4.
