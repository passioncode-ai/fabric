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

*Superseded the same afternoon: 0.3.10 became the scroll patch and wave 4 is 0.3.11; read the updates below.*

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

*For 0.3.10 the person quits Fabric and opens it again once the bundle is installed; see the evening update.*

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

## Exact next task (morning, superseded below)

Land `agent/ui-scroll-0310` on `main` (its gates in the commit message), then start 0.3.10 (P-20) with CO-381 (a
failing test for the request the first tick skipped), then wave 4.

## Update 2026-10-22, afternoon

The scroll fix landed on `main` (PR #36, `297d95ba`). CO-381 is resolved, not a code defect: migration 120 expires an
older request without a deadline once its message is 7 days old and writes no deadline into the row; the notes that
said otherwise are corrected (CHANGELOG `Unreleased`, release-mac). CO-380 stays in wave 4, where the places are
rebuilt; only its misleading comment in `launch.css` was marked. Fabric's status in fabric-workspace is
`docs/reports/2026-10-22-passioncode-status/fabric.md` (PR #365, `46c40407`).

**Exact next task:** Fabric 0.3.10, the scroll patch (P-23, [ledger](../evidence/plans/2026-10-22-release-0310-verification.md)):
its three review iterations, the release and the install; then 0.3.11 (P-20, wave 4, with CO-336 and CO-372); the
0.3.9 Release close measurements after a few days of the new build.

## Update 2026-10-22, evening: 0.3.10 in review

0.3.10 is the scroll patch (P-23). Iteration 1 found that Настройки still did not scroll (fixed) and that the broker
stops Fabric when it is idle (CO-382, the broker's enrollment is the operator's). **One person step** for its rollout:
quit Fabric and open it again once the 0.3.10 bundle is installed; the agent never starts Fabric through the broker.
New rows: CO-382 (the broker's idle stop), CO-383 (board asks and 0.3.9's Release close debts), CO-384 (the keyboard
after a rail move), CO-385 (a long notice's hidden actions), CO-386 (the redaction's assignment rule), CO-387
(Diagnostics on the project page), CO-388 (the scroll position on going back). The operations log no longer hides a database refusal as «[object Object]» (iteration 2 DA-3).

**Exact next task:** the 0.3.10 release commit (version, CHANGELOG `## 0.3.10`, the release gate with the iteration-3
receipts on the final candidate), the gate's library run on it, the tag, the install and the ledger's Release close;
then 0.3.11 (P-20). (Updated after iteration 3 and its verifiers closed.)

Release commit, 2026-10-22: three iterations closed (42, 31 and 25 findings; 6, 2 and 1 blocking, every one fixed or
ruled), the verified commit `f2a0a9c5`, after six readings of its difference (four failed, the last two passed).
**Exact next task:** tag `v0.3.10`, watch the release run, install the bundle, the person's quit and open, then the
ledger's Release close; then 0.3.11 (P-20).

Released and installed, 2026-10-22: v0.3.10 published at 20:26 UTC and running on the operator's Mac (schema 95, hub
answering); the first start's statement timeout is CO-389. The operator asked for Fabric's working language (P-24).
**Exact next task:** 0.3.11 (P-20 with P-24 and CO-389): start with P-24's scenarios and decision, then wave 4.

P-24 landed, 2026-10-22 (`0a46332a`, PR #41): agents write in the language of Fabric's interface (ADR-0172); the first
run asks it first. The workspace sync's stale lock was removed and the wiki published (CO-390 for the fix in code).
**Exact next task:** 0.3.11 (P-20 with P-24, CO-389 and CO-390): wave 4's places, then the release iterations.
