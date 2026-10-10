# Release verification — Fabric 0.3.3, the onboarding release: three independent iterations

Run `2026-10-08-release-033-verification`. The operator's rule (2026-10-03, plan row P-02, kept for every release):
before the DMG and the release, three independent testing iterations across every level of the project, every
finding fixed, and only then the release. This file is the ledger for **Fabric 0.3.3** — plan row
[P-14](../backlog.md#general-development-plan): the onboarding into PassionCode.ai as four actions
([brief](2026-10-08-onboarding-four-actions.md), operator decisions D1–D4 of 2026-10-08) plus what landed on `main`
after 0.3.2 — the launch screens drawn from the prototype and in Russian, the scan's repository summary, the
"Set up this project with the agent" shortcut, the fallback order (ADR-0125) and usage counts held until the
person answers (ADR-0127). No schema change: 0.3.3 runs on schema 79. 0.3.2 was cleared by its own ledger,
[2026-10-06-release-032-verification.md](2026-10-06-release-032-verification.md).

## Protocol

The protocol is 0.3.2's, unchanged ([0.3.2 ledger, Protocol](2026-10-06-release-032-verification.md#protocol)):

- **Independent** — each iteration is read by fresh reviewer agents that have not seen an earlier iteration's
  findings or fixes; they read the product and the code first, and a finding an earlier iteration closed is
  checked again, not skipped.
- **Levels**, one reviewer each: scenarios, UX and UI (UX-n); errors and boundaries (ER-n); code ↔ documentation
  (DO-n); data, memory, orchestration, harness (DA-n); plan and roadmap (PL-n).
- **A finding** gets an id `V<iteration>-<n>`, its source, evidence and a disposition: **fixed** (with the test that
  now catches it, its planted defect watched), **ruled** (a register id and the reason it is not a release blocker),
  or **not a defect** (with the measurement).
- **Exit** — the release proceeds only after iteration 3 ends with zero open findings marked blocking.

Reviewers work read-only in a detached checkout of the candidate. Their reports are committed as written, with
machine paths replaced by `<scratchpad>/`, `<worktrees>/` and `~/`; their probes and screenshots stay outside
the repository (the operator's rule of 2026-10-06: media does not go into git). Iteration 3's reports are
committed under `docs/evidence/reviews/0.3.3/iteration-3/`, because after `verifiedCommit` the release gate admits
review artifacts only under `docs/reports/` or `docs/evidence/reviews/`.

## Release close

What 0.3.3's release has to do besides the gate, in one list (0.3.3 verification, iteration 2, PL-10). Each line is
checked off with its receipt when it is done.

0. **Before the release commit:** the operator accepts the run's reading of REQ-08 recorded in the brief (renderer
   strings in Russian; main-process messages still English, CO-225) — or rejects it, which makes it a code fix and
   a new candidate (iteration 3, PL-3).
1. The release commit: `apps/desktop/package.json` 0.3.3 (nothing else in that file), `## 0.3.3` finalized in
   `CHANGELOG.md`, `docs/launch/release-gate.json` (version, this ledger, `verifiedCommit` = the iteration-3
   candidate, three receipt groups), this ledger's iteration-3 section and the iteration-3 receipts under
   `docs/evidence/reviews/0.3.3/iteration-3/`, a new top entry in `docs/reports/map.html` (then
   `check-design-map.mjs --refresh`) and the `docs/MERGES.md` entry; landed on `main` by fast-forward after
   `bash scripts/ci.sh fast`. A provider re-pin (Claude Code or Codex updating itself before that run) edits a file
   the gate does not admit after `verifiedCommit` and means a new candidate (iteration 3, PL-1, PL-9).
2. **Before the tag:** fabric-workspace [PR #81](https://github.com/passioncode-ai/fabric-workspace/pull/81) merged — the
   roadmap names 0.3.3 as the onboarding release (CO-196).
3. The tag `v0.3.3`; the release run's two protected approvals (macOS build, publish), each given to the operator as
   a direct link once it waits.
4. The packaged smoke (runbook step 7), plus the first-run boot on the operator's own database (CO-228).
5. The website's release PR (runbook step 9) and the workspace publication after the tag, as 0.3.2 did
   (`f2ec0587`): `node scripts/workspace.mjs publish`, then `check --require-child` (CO-197).
6. The knowledge base after publication (CO-196): the roadmap's released column for Fabric, `products.md` and
   `plans.md` Now in fabric-workspace; then the close commit here marking P-14 done, with its handoff (iteration 3,
   PL-2).

<a id="release-close-state-2026-10-10"></a>
### Release close — state on 2026-10-10

Appended, not rewritten (a dated ledger). Item 0: no explicit answer was given before the tag; the REQ-08 reading (renderer
strings in Russian, main-process messages still English, CO-225) shipped as recorded and stays the operator's to
reject (0.3.4 verification, iteration 2, PL-7: the approvals of the release run are not that answer). Item 1: release commit `1404dffe`, landed. Item 2: PR #81 merged before the tag. Item 3: tag
`v0.3.3`; release run [37979209160](https://github.com/passioncode-ai/fabric/actions/runs/37979209160) green after
both approvals, published 2026-10-09T22:20Z. The downloaded DMG checked 2026-10-10: `SHA256SUMS` OK, its GPG
signature good (key `63B30DC3…C803B6A7`), `spctl` "Notarized Developer ID", staple valid. Item 4: installed over 0.3.2
(0.3.2 kept aside for a rollback) and started through the lifecycle broker on the operator's database; it stopped at
"identity could not be established: that person is not a member of this estate" — CO-228 observed, and the cause
is CO-241, which 0.3.4 fixes ([0.3.4 ledger](2026-10-10-release-034-verification.md)). The runbook's Playwright
smoke was not run: it launches the enrolled app directly, which this machine's lifecycle rule forbids. Item 5: the
website needed no PR — its resolver followed 0.3.3 by itself (site `d19bd337`, 2026-10-09T23:23Z) — and so now
offers a build a new Mac cannot start; 0.3.4's close changes the site's asset pattern. The workspace publication and
item 6's knowledge base fold into 0.3.4's close.

## Iteration 1

Five fresh reviewers, 2026-10-08, against `ece98797` (`ece987975a1b2a491f86f5e528f96920b04aa4c5`, the head of `agent/release-033-candidate`). Reports:
[scenarios/UX/UI](2026-10-08-release-033-verification/iteration-1/2026-10-08-ux.md) (UX-n, 0 blocking + 12),
[errors and boundaries](2026-10-08-release-033-verification/iteration-1/2026-10-08-errors.md) (ER-n, 1 + 8),
[code ↔ documents](2026-10-08-release-033-verification/iteration-1/2026-10-08-docs.md) (DO-n, 2 + 14),
[data, memory, orchestration, harness](2026-10-08-release-033-verification/iteration-1/2026-10-08-data.md) (DA-n, 2 + 7),
[plan and roadmap](2026-10-08-release-033-verification/iteration-1/2026-10-08-plan.md) (PL-n, 3 + 9).
58 findings; where two reviewers found one thing they share a row. Every "fixed" row whose evidence says *watched* had its
test run with the fix reverted in place and seen failing, then restored. Probes and screenshots stay in the session
scratchpad, outside git (the operator's media rule).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | DA-1, ER-2 (blocking) | A retry brought forward a session that had ended and reported success; the task never started again | fixed: `taskRetry.ts#liveSessionOf` answers only a session still running (`ptys.get(id)?.running`), newest first; `task-retry.test.mjs` "the newest RUNNING session of the task, never an ended one" (watched: planted lookup without the running check failed) |
| V1-2 | DA-2 (blocking) | The usage notice told every 0.3.2 upgrader "nothing has been sent yet", which 0.3.2 had | fixed: `analytics.sentBefore()` (state has `installed_at`), `AnalyticsStatus.sentBefore`, `analytics.notice.sentBefore` (en, ru); `analytics.test.mjs` A7-012 upgrade test and `UsageCountsNotice.test.tsx` "an install that already sent counts" (watched: `sentBefore` planted false failed); ANALYTICS.md unchanged in claim, ADR-0127 §5 holds |
| V1-3 | DO-1 (blocking) | README said counts are sent from the first start | fixed: `README.md` §Usage analytics: nothing until the switch is answered (notice or Settings), ADR-0127 linked |
| V1-4 | DO-2, PL-2 (blocking) | The release notes said "Russian throughout"; CO-225 (4) required the English remainder be named; new task refusals reached Russian sentences raw | fixed: CHANGELOG §0.3.3 «Russian» names what is still English (main-process messages, ACP prompts; CO-225); task refusals are codes `task-refused:*` said by `startParts.tsx#explainError` in both languages, also on the task panel (`Tasks.tsx`); CO-225 (4) updated |
| V1-5 | PL-1 (blocking) | ADR-0123 dated the CEO chat's retirement to 0.3.3, which ships it and adds «Discuss with Fabric» | fixed: ADR-0123 amendment 1 (retirement after 0.3.3, operator scope D4); P-13 "planned after 0.3.3"; CHANGELOG first paragraph says the CEO chat stays |
| V1-6 | PL-3 (blocking, release close) | The organization roadmap named 0.3.3 the self-update release and did not mention the onboarding | fixed: fabric-workspace PR [#81](https://github.com/passioncode-ai/fabric-workspace/pull/81) (Fabric row, RM-09, RM-13 title, RM-19, LC-16; `npm test` 65 pass); merged at the release close, before the tag (CO-196) |
| V1-7 | PL-7, DO-4 | The four actions reversed ADR-0100 §5/§6 with no decision record | fixed: [ADR-0129](../../adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md); ADR index row for 0100 and 0129; pipeline reservation moved 0128 → 0130 (`fix-pf-06.03.py` green) |
| V1-8 | ER-1 | Regression since 0.3.2: a pre-spawn check that threw left the session credential valid | fixed: `pty.ts` discards the bundle when `beforeSpawn` throws; `pty-launch-failure.test.mjs` ER-1 case (watched: planted unwrapped call failed) |
| V1-9 | ER-3 | A failed launch locked the coding agent and the only way out abandoned the folder | fixed: «Use another coding agent» (`AgentPaths.tsx#anotherAgent`): a new task in the same Project; `StartPaths.test.tsx` "a coding agent that failed to start can be swapped" (watched) |
| V1-10 | ER-4, DA-6 | Leaving the agent screen mid-request or after a failure lost the attempt; the folder was then refused as existing | fixed: `keptCreate` / `keptConvert` keep the attempt for the window's life; a late success does not navigate away; `StartPaths.test.tsx` "leaving the screen after the folder was made and coming back" (watched) |
| V1-11 | ER-5, DA-4 | Repository text became the Project purpose as if the owner had said it | fixed: `shared/startPaths.ts#purposeFromRepository`: «From README.md: …» with the file named (`summaryFile`); `project-discovery.test.mjs` summaryFile, `StartPaths.test.tsx` purpose expectations |
| V1-12 | ER-6 | The summary read the whole file before keeping 64 KiB | fixed: `projectDiscovery.ts#readHead` reads at most 64 KiB; `project-discovery.test.mjs` 8 MiB README read by a bounded head (watched) |
| V1-13 | ER-7 | The skills check could hang on a FIFO, called unreadable files missing, and threw on ids like `constructor` | fixed: `adapterSkills.ts`: regular-file and size check before reading, 3 s per read, `unreadable` named on screen, `Object.hasOwn`; `adapter-skills.test.mjs` FIFO, mode 000 and prototype ids (watched both) |
| V1-14 | ER-8 | New renderer code swallowed picker and settings failures; check-ops scans only main | fixed: pickers and the settings read say what failed (`start.pickFailed`, `start.builder.orderUnread`); `StartPaths.test.tsx` "a folder picker that fails is said" (watched); the gate's scope is ruled CO-230 |
| V1-15 | ER-9 (low) | Two fallback launches at once can attach to one idle session | ruled CO-229: reached only by two windows launching within one walk; before the fallback order attaches for chains or routines |
| V1-16 | DA-3 | The setup preset was offered to agents without Fabric's tools | fixed: `Tasks.tsx` disables it, with the reason, for a runner that does not connect to the surface, and a loaded setup does not run on one; `Tasks.test.tsx` "is not offered to an agent that does not connect" (watched) |
| V1-17 | DA-5 | ADR-0127's tests ran only in the full tier | fixed: `scripts/ci.sh` fast tier runs `analytics.test.mjs` (16 pass) |
| V1-18 | DA-7 | The adapt instruction could commit secrets in a folder that was not a repository | fixed: `start.convertAgent.instruction` (en, ru): the plan lists the first commit, secrets go to `.gitignore` and are named, the commit waits for yes; `StartPaths.test.tsx` adapt test asserts it |
| V1-19 | DA-8 | Two starts with one new task id journalled two `task.created@1` | fixed: `taskRetry.ts#createKeyedQueue` serialises `tasks.start` per task id in main; `task-retry.test.mjs` queue case (watched: planted unqueued run failed) |
| V1-20 | DA-9 | The skills check ignored `CLAUDE_CONFIG_DIR` | fixed: `adapterSkills.ts` reads Claude Code's config from `CLAUDE_CONFIG_DIR` when set; `adapter-skills.test.mjs` DA-9 case (watched) |
| V1-21 | UX-1 | The coding-agent hint claimed the fallback order chose, also with no order | fixed: hint names the rule: `start.builder.fromOrder` / `fromFound` / `orderUnread`; ru uses «очерёдность агентов»; `StartPaths.test.tsx` "the hint says how the coding agent was chosen" (watched) |
| V1-22 | UX-2 | Field problems rendered in the hint grey; invalid fields had no border | fixed: `start/start.css`: `.lp .field-problem, .lp .st-warn` danger colour above `.lp small`, invalid border |
| V1-23 | UX-3 | "Create and open the console" never looked unavailable and a refused press said nothing | fixed: `.lp .lp-button[aria-disabled=true]` style; a press names what is missing (`start.blocked.*`); `StartPaths.test.tsx` "a press that cannot go says what is missing" (watched) |
| V1-24 | UX-4 | A failed read of the agents or skills was a dead end in raw English | fixed: both failure states carry Try again / Check again and pass through `reasonOf`; `StartPaths.test.tsx` "a failed read of the coding agents … can be tried again" |
| V1-25 | UX-5 | A session that started but whose console did not open was called "not created"; a double full stop | fixed: `start.consoleNotOpened`; `reasonOf` drops the reason's own full stop; `StartPaths.test.tsx` UX-5 case (watched) |
| V1-26 | UX-6 | The Adapt card's button promised a picker but opened a page | fixed: `start.card.convert.go` «Adapt an agent» / «Адаптировать агента» |
| V1-27 | UX-7 | The fallback order in Settings was unstyled; row buttons did not name their agent | fixed: `.settings-fallback*` layout (registered in `components/registry.ts`), `settings.fallback.upFor/downFor/removeFor` aria-labels; `FallbackOrderSetting.test.tsx` 3 pass |
| V1-28 | UX-8 | The language menu called Russian partial / untranslated | fixed: `settings.localeRuUntranslated` «Русский»; what remains English is named in the release notes (V1-4) |
| V1-29 | UX-9 | Inconsistent terms on the new surfaces | fixed: (a) visible «эстейт» → «пространство» (dictionary row ruled CO-231); (b) «Открыть проект: одна папка / папка с проектами»; (c) «Проверка совместимости»; (d) «Настроить {name} с агентом», «Открыть {name}»; (e) notice title «Счётчики использования: делиться ли ими?» |
| V1-30 | UX-10 | Focus fell to the page after a folder was read, scan results arrived or a refusal | fixed: focus moves to the facts section, the scan results and the Name field (`AgentPaths.tsx`, `StartPaths.tsx`) |
| V1-31 | UX-11, DO-3, DO-6, DO-7 | Screens, scenarios, design map, product model and prototype lagged the build | fixed: SCR-74/75 `built`; SCN-126 step 3, SCR-70, SCN-130 rewritten; map `#screens-start` cards; `product-model.json` views start-agent/start-convert and SCN-131/136 screen refs; prototype notes; drawing the notice and the fallback order in the prototype is ruled CO-225 |
| V1-32 | UX-12, DO-14 | Stale "designed, not yet built" headings in `StartPaths.tsx` | fixed: headings replaced by a pointer to `AgentPaths.tsx` |
| V1-33 | DO-5 | The glossary kept the old start paths and lacked the 0.3.3 terms | fixed: `CONTEXT.md`: Start path, Ecosystem agent, Fabric Agent Adapter, Fallback order |
| V1-34 | DO-8 | SCN-136 gave an allow-list the code does not enforce | fixed: SCN-136 step 1 states the real refusals (`folderNameProblem`) |
| V1-35 | DO-9 | SCR-74/SCN-136 overstated where `exists` shows, when the agent is fixed and that the Project is kept | fixed: rows aligned with the code; `start.createAgent.madeKeptFolder` when no Project was made |
| V1-36 | DO-10 | Scenarios named the adapt action with a label the person never sees | fixed: SCN-131, FLW-74, SCR-75 titles and entries use «Adapt an existing agent» |
| V1-37 | DO-11 | The release notes overstated where the skills are checked | fixed: CHANGELOG names Cline and Kimi Code as shared-folder only |
| V1-38 | DO-12, PL-10 | The release notes omitted Kimi Code, the launch chrome, the startup dialog, «My workspace», pins, licensing and the 75/78 upgrade | fixed: CHANGELOG §0.3.3 «Upgrading» and the added bullets |
| V1-39 | DO-13 | The analytics disclosure was undocumented in the lifecycle row, SCN-134 coverage and the screens | fixed: `AGENTS.md` lifecycle row, SCN-134 coverage, SCR-52 amendment; `usage-analytics-ipc` region points at `#nothing-before-the-disclosure` |
| V1-40 | DO-15 | The four-actions merge entry under-reported its scope | fixed: this iteration's `docs/MERGES.md` entry lists `taskRetry.ts`, the PF-07.01 regression and the IPC additions; the dated line is not rewritten |
| V1-41 | DO-16 | `node_modules/` in .gitignore let symlinked node_modules into the map fingerprint | fixed: `.gitignore` `node_modules` (`git check-ignore -v --no-index packages/x/node_modules` matches) |
| V1-42 | PL-4 | CO-218 stayed open although ADR-0127 decided it | fixed: CO-218 resolved by ADR-0127; lane 12 no longer schedules it |
| V1-43 | PL-5 | ADR-0121 and the UI/RU plan still dated self-update to 0.3.3 | fixed: ADR-0121 amendment 1; dated state section appended to the UI/RU plan (the dated record is not rewritten) |
| V1-44 | PL-6 | CO-220 and CO-179 fell due at 0.3.3, neither done nor re-dated | ruled CO-220 (after 0.3.3; only the Kimi Code row ships) and CO-179 (next visual iteration after 0.3.3), both with the operator's scope D4 as the reason |
| V1-45 | PL-8 | P-14 sat in no lane; lane 1 and P-01 described the old start; Now/Next contradicted itself | fixed: lanes 1 and 2 cite P-14; lane 1 outcome and P-01 say the four actions; Now/Next corrected; dispatch note re-dated; `check-plan-ids.mjs` PASS |
| V1-46 | PL-9 | R3b and R1's boot check had no carry-over row | fixed: CO-227 (R3b) and CO-228 (boot check, at the packaged smoke) |
| V1-47 | PL-11 | The runbook's upgrade section and gate paragraph were 0.3.2-specific | fixed: `release-mac.md` upgrade section is release-neutral (`X.Y.Z`, 0.3.3 adds no migration); gate paragraph says each bump points at its own ledger |
| V1-48 | PL-12 | The brief's modules, next task and REQ-08/09 receipts ran ahead of the evidence | fixed: dated state section appended to the brief: modules landed, REQ-08's receipt is each iteration's UX review plus the runtime walks, REQ-09's knowledge base is the release close |
| V1-49 | DO (note) | Claude Code updated to 2.1.295 after the candidate was cut; the capability check failed against 2.1.294 | fixed: `repin-provider-builds.mjs` → 2.1.295, every row still unverified; `check-provider-capability.mjs` PASS |

Exit for iteration 1: every finding above is fixed, ruled with a register id or not a defect in the iteration-2 candidate. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-09, against `6d6d039d` (`6d6d039d831051eae3889cae4f6b75dfc38e7eb3`, the head of `agent/release-033-candidate` after iteration 1). Reports:
[scenarios/UX/UI](2026-10-08-release-033-verification/iteration-2/2026-10-08-ux.md) (UX-n, 2 blocking + 10),
[errors and boundaries](2026-10-08-release-033-verification/iteration-2/2026-10-08-errors.md) (ER-n, 2 + 6),
[code ↔ documents](2026-10-08-release-033-verification/iteration-2/2026-10-08-docs.md) (DO-n, 2 + 7),
[data, memory, orchestration, harness](2026-10-08-release-033-verification/iteration-2/2026-10-08-data.md) (DA-n, 1 + 4),
[plan and roadmap](2026-10-08-release-033-verification/iteration-2/2026-10-08-plan.md) (PL-n, 1 + 9).
44 findings; where reviewers found one thing they share a row. Three reviewers (ux, errors, data) were stopped by the
API spend limit after writing their reports; each report is complete (findings and "Not checked") and is committed as
written. Every "fixed" row marked *watched* had its test run with the fix reverted and seen failing, then restored.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | DO-3, UX-1, ER-4 (blocking) | Coming back to an agent screen showed, and checked skills for, a coding agent other than the one the recorded task runs; Adapt lost its failure | fixed: the attempt keeps `agentId` and `failed` (`AgentPaths.tsx#launch`, `useBuilders(fixed)`, Adapt restores both for the same folder); `StartPaths.test.tsx` "coming back after a failed launch shows the coding agent" and "the same folder chosen again in Adapt" (both watched) |
| V2-2 | UX-2, ER-5, DA-1, DO-4 (blocking) | The setup preset ran on agents without Fabric's tools through the fallback order or a created agent | fixed: the walk passes over a runner without the surface for a `needsSurface` launch (`shared/runnerRoute.ts`), and main refuses `preset: setup` on any runner without it (`taskRetry.ts#refuseSetupWithoutSurface`, called from `tasks.start` for a named runner, a created agent's runner and the walk's pick); `runnerRoute.test.ts` "passes over a runner that does not connect" (watched), `task-retry.test.mjs` setup case; the refusal `task-refused:setup-needs-surface` is said in both languages; CHANGELOG reworded |
| V2-3 | ER-1 (blocking) | Unclosed markup in a README made the summary's stripping quadratic and froze the main process for tens of seconds | fixed: `projectDiscovery.ts#plain` cuts its input to 4 KiB and the patterns stop at the next bracket; `project-discovery.test.mjs` 60 000 × `<`, `[`, `![` under 500 ms (watched: planted old patterns took 4641 ms) |
| V2-4 | DO-1 (blocking) | ANALYTICS.md and SCN-134 told every upgrader "nothing has been sent yet" | fixed: `docs/ANALYTICS.md` and SCN-134 (UI elements, states `pending-disclosure`, `pending-disclosure-sent-before`) name the upgrader's sentence; ADR-0127 amendment 1 |
| V2-5 | PL-1 (blocking, release close) | V1-6's roadmap fix was an open PR with nothing tying its merge to the tag | fixed: CO-196 dated "before the `v0.3.3` tag"; the ledger's *Release close* item 2 and the runbook's step 7 name it; PR #81 extended (V2-30) |
| V2-6 | ER-2 | A retry still brought forward a process left by a launch that failed after spawning | fixed: `planTaskStart` brings a session forward only for a task whose receiver acknowledged it (`status: running`); `task-retry.test.mjs` "a process left by a failed launch, with the task still in backlog, is not running" (watched) |
| V2-7 | ER-3 | A session that started but could not be read back was called "not created" and offered a second agent in the same folder | fixed: `startTask` returns the running session with the row it journalled when the read-back fails, and records the failure (`ops.failed('tasks.readback')`); the window never sees "not created" for a running session. No unit test: the read-back runs inside `startTask`, which only the stack-backed tier drives |
| V2-8 | ER-6 | Leaving while the folder was being made lost the attempt; the same name was then refused as existing | fixed: the attempt is kept before `createFolder` with the request in flight (`KeptCreate.making`); a screen mounted meanwhile waits for it; `StartPaths.test.tsx` "leaving while the folder is being made" (watched) |
| V2-9 | ER-7 | An unreadable Claude Code settings file made an installed plugin read as missing, unnamed | fixed: `adapterSkills.ts#claudePlugin` names unreadable settings files in `unreadable`; `adapter-skills.test.mjs` ER-7 case (watched) |
| V2-10 | ER-8 | A failed fallback-order save was an unhandled rejection with nothing on screen; a menu rebuild failure could fail a committed write | fixed: `App.tsx` says `settings.notSaved` for a rejected write; `FallbackOrderSetting.tsx` handles the rejection; main rebuilds the menu in its own try; `FallbackOrderSetting.test.tsx` "a save that fails is not an unhandled rejection" (watched) |
| V2-11 | DA-2 | Two Fabric processes on one database can journal two `task.created@1` for one caller id | ruled CO-233: no corruption (the projection keeps the first, admission runs one launch); the fix is an idempotent create at the write boundary, a migration |
| V2-12 | DA-3 | A repository-quoted purpose is localized prose without a structured source, and no tool makes a confirmed purpose the Project's | ruled CO-227 (an agent proposes a project's configuration, with its ADR) now carries both |
| V2-13 | DA-4 | The `sentBefore` comment and notice overstated delivery: `installed_at` is written when queued | fixed: comment corrected; the notice says an earlier version "may already have sent" them (en, ru) |
| V2-14 | DA-5 | A task abandoned by «Use another coding agent» or «Start over» stayed in the backlog as open work | fixed: `AgentPaths.tsx#abandon` cancels it with a reason (`start.abandoned.*`); the note says it is cancelled; `StartPaths.test.tsx` "a task the person walks away from is cancelled" (watched) |
| V2-15 | UX-3 | On Adapt the "console did not open" sentence named a button the screen does not have | fixed: `start.consoleNotOpened` takes the screen's own button name (`{retry}`) |
| V2-16 | UX-4 | Regression from V1-30: the folder facts lost their two-column layout | fixed: the focusable wrapper has its own class `.st-facts-block`; `.st-facts` (the `<dl>`) keeps its grid |
| V2-17 | UX-5 | Focus did not reach the Name field after `exists` or Start over | fixed: focus moves once the field is enabled again (`requestAnimationFrame`, `AgentPaths.tsx`); checked by the next walk |
| V2-18 | UX-6 | "Set up {name} with the agent" left the task field out of view | fixed: `LaunchShell.tsx#revealSection` keeps the section aligned while the page above it settles (1.5 s), until the person scrolls or types; checked by the next walk |
| V2-19 | UX-7 | On the first run a field problem still had the hint's grey | fixed: `start/start.css`: `.st-first .lp-field .field-problem` takes the danger colour |
| V2-20 | UX-8 | In Settings the usage-counts switch cannot say yes to the disclosure while pending | ruled CO-232: the first-run notice answers yes in one press; a pending state for the Settings switch belongs to SCR-52's next pass |
| V2-21 | UX-9 | Focus fell to the page after moving a fallback row; two copy buttons shared one name | fixed: focus follows the moved row to a working button (`FallbackOrderSetting.tsx`), and `CopyButton` takes `what` («Copy for OrbStack» / «… Docker Desktop»); `FallbackOrderSetting.test.tsx` and `StackExposureNotice.test.tsx` assert both |
| V2-22 | UX-10 | The feed's verification tooltips are renderer English in a Russian window, not named in the release notes | fixed: CHANGELOG «Russian» names them; CO-225 (5) |
| V2-23 | UX-11, DO-8 | Docs and prototype drift: FLW-74 node, prototype wording, the start-add summary row, SCN-128 and SCN-134 text, FLW-73 and SCN-134 states, SCR-52 coverage, a duplicated strings row, receipt links | fixed: each corrected (`flows.md`, `renderers.mjs` start views, `scenarios.md`, `screens.md` SCR-52 coverage, `strings.md`, iteration-1 receipt links); resolution-matrix renderer and SRC-02 pins re-pinned |
| V2-24 | UX-12 | «Что о себе пишет» read as broken Russian; the exposure restart lines differ with no reason | fixed: the label is «Описание из репозитория» / "What its repository says"; the restart lines are ruled CO-231 (the Russian copy pass) |
| V2-25 | DO-2 | "Off at the notice sends nothing, ever" overstated: another PassionCode app can turn the shared switch back on | fixed: ANALYTICS.md says it holds while the shared switch stays off |
| V2-26 | DO-5 | Code regions on the four actions still pointed at the ADR-0100 clauses ADR-0129 replaced | fixed: `start-screens` and `start-paths-ipc` point at ADR-0129 (`#decision`, `#boundary`, which names the skills check's reads); ADR-0100 amendment 1; `StartPaths.tsx` header; `check-regions.mjs` PASS |
| V2-27 | DO-6 | Stale numbers in ADR-0127 and the ADR-0121 index row | fixed: ADR-0127 amendment 1 (7 notice tests, measured); ADR index rows for 0121 and 0127 |
| V2-28 | DO-7 | The hint said "the first found" when the code prefers the first that connects | fixed: `start.builder.fromFound` says both rules |
| V2-29 | DO-9 | The `adapterSkills.ts` header still said an unreadable file is "not found" | fixed: header comment corrected |
| V2-30 | PL-2 | PR #81 left out RM-05, RM-20 and RM-25, and said "in verification" | fixed: fabric-workspace `ad6c1f7` on PR #81 (`npm test` 66 pass) |
| V2-31 | PL-3 | CO-177 fell due when the start lane was touched | ruled CO-177 re-dated after 0.3.3 with the operator's scope D4 |
| V2-32 | PL-4 | CO-178 described a state that is gone; CO-231 recorded the same decision | fixed: CO-178 resolved; CO-231 keeps the dictionary row; lane 1 no longer schedules CO-178 |
| V2-33 | PL-5 | CO-197 and CO-221 still dated to 0.3.1/0.3.2; `workspace.mjs check` exits 1 | ruled CO-197 (the candidate's workspace is published and pinned at the release close, *Release close* item 5) and CO-221 (re-dated after 0.3.3) |
| V2-34 | PL-6 | REQ-08 ("no English in the Russian window") not fully met and not narrowed | fixed: the brief's state section records the run's reading of REQ-08 against D4 for the operator's review at the release, with the remaining English named (CO-225) |
| V2-35 | PL-7 | CHANGELOG missed three user-visible changes | fixed: toolbars wrap, the task subtitle, Home's «+ Add a topic» |
| V2-36 | PL-8 | `origin/main` does not carry the plan fixes yet; two merge-log entries name landings not done | not a defect: the runbook lands the release on `main` before the tag ("Land, then release", step 1); the merge-log entries are written inside the change as the iteration contract requires, and the landing is *Release close* item 1 |
| V2-37 | PL-9 | P-14's status, ADR-0129 and track; RM rows with no lane | fixed: P-14 cites ADR-0129 and RM-09 and says iteration 3 next; the plan header maps RM-13, RM-19, RM-20, RM-25 |
| V2-38 | PL-10 | 0.3.3's release-close duties were spread with no single list; the smoke did not include CO-228 | fixed: the ledger's *Release close* section; the runbook's step 7 points to it |

Exit for iteration 2: every finding above is fixed, ruled with a register id or not a defect in the iteration-3 candidate. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-09, against `92a52259` (the candidate after iteration 2). Reports, committed under
`docs/evidence/reviews/0.3.3/iteration-3/` because this candidate becomes `verifiedCommit`:
[scenarios/UX/UI](../reviews/0.3.3/iteration-3/2026-10-08-ux.md) (UX-n, 2 blocking + 11),
[errors and boundaries](../reviews/0.3.3/iteration-3/2026-10-08-errors.md) (ER-n, 1 + 7),
[code ↔ documents](../reviews/0.3.3/iteration-3/2026-10-08-docs.md) (DO-n, 1 + 6),
[data, memory, orchestration, harness](../reviews/0.3.3/iteration-3/2026-10-08-data.md) (DA-n, 0 + 8),
[plan and roadmap](../reviews/0.3.3/iteration-3/2026-10-08-plan.md) (PL-n, 0 + 9).
The session scratchpad holding the five reports was cleared by the system before they were committed; each was
recovered byte for byte from its reviewer's own transcript by replaying that reviewer's Write and Edit calls on the
report file, then committed with machine paths replaced. The four blocking findings were fixed at
`fa9cdf6b` (`fa9cdf6b7d3b8d05a9dc264f965241c672b10ee1`) and rechecked there by the reviewers who raised them: [UX recheck](../reviews/0.3.3/iteration-3/2026-10-09-ux-recheck.md),
[errors and documents recheck](../reviews/0.3.3/iteration-3/2026-10-09-errors-docs-recheck.md). The recheck at `f891954c` found one more blocking
defect (N-1) and four small ones, fixed at `d2c20705`; the [final recheck](../reviews/0.3.3/iteration-3/2026-10-09-final-recheck.md) there held them
and found NB-1, fixed at the final candidate and rechecked there ([NB-1 recheck](../../handoffs/2026-10-09-release-033-nb1-recheck.md), committed with the release as release metadata).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V3-1 | ER-1 (blocking) | An older create attempt finishing late could overwrite a newer one and attach its folder to the wrong Project | fixed: the attempt in flight is kept (`KeptCreate.flight`) and a screen mounted meanwhile shows it working and takes its end; writes go only to their own attempt (`keepFor`); `StartPaths.test.tsx` "leaving mid-request and coming back shows the attempt working" and "an older attempt finishing late does not overwrite a newer one" (watched: planted no-flight failed both); rechecked by its reviewer at the final candidate |
| V3-2 | UX-1 (blocking) | V2-21 did not hold: focus did not follow the moved fallback row | fixed: focus moves in an effect once the saved order is drawn (`FallbackOrderSetting.tsx`), Remove leaves it on the next row; `FallbackOrderSetting.test.tsx` "focus follows the moved row once the saved order is drawn" with a host whose save really reorders (watched); rechecked in the app by its reviewer |
| V3-3 | UX-2 (blocking) | V2-17 did not hold for `exists`: focus stayed on the button | fixed: focus moves in an effect after the commit that re-enables the field; `StartPaths.test.tsx` "after the folder-exists refusal, focus is back on the Name field" (watched); rechecked in the app by its reviewer |
| V3-4 | DO-1 (blocking) | SCN-134 step 1 still told the 0.3.2 upgrader "nothing has been sent yet" | fixed: SCN-134 step 1 names the upgrader's sentence; rechecked by its reviewer |
| V3-5 | ER-2, UX-7, DA-2 (part) | Start over cancelled a task whose session runs, with the agent still working | fixed: Start over is not offered while the attempt's session runs, and `abandon` never cancels a task with a session; the unresolved-run case of «Use another coding agent» is ruled CO-236 |
| V3-6 | ER-3 | A refused cancel was dropped while the screen said the task was cancelled | fixed: `abandon` returns the refusal and the screen says `start.abandoned.notCancelled` (Create and Adapt); the note says the first task is cancelled "unless its session is already running" |
| V3-7 | ER-4 | Returning while the folder was being made left the fields editable | fixed: a flight in progress shows the screen working with the fields locked (V3-1's test asserts the Name field disabled and no Start over) |
| V3-8 | ER-5 | A 240-character summary could be cut inside a surrogate pair, which the database refuses | fixed: `projectDiscovery.ts#clip` cuts by code point; `project-discovery.test.mjs` emoji case (watched: planted code-unit cut failed) |
| V3-9 | ER-6, DA-1 | The setup preset still ran on Claude Code with Fabric's agent surface not listening | fixed: `refuseSetupWithoutSurface(runner, surfaceUp)` refuses with `task-refused:setup-surface-down`, and the walk passes over every runner for a `needsSurface` launch while the surface is down; `task-retry.test.mjs` and `runnerRoute.test.ts` "with the agent surface not listening" |
| V3-10 | ER-7, DA-3 | V2-7 had no test, and its fallback row claimed `running` | fixed: `taskRetry.ts#readbackFallbackRow` claims only what was journalled and `backlog`; `task-retry.test.mjs` read-back case |
| V3-11 | ER-8 | A readable but invalid Claude settings file read as "plugin missing", unnamed | fixed: `adapterSkills.ts#claudePlugin` names a settings file that reads but does not parse, as it names an unreadable one; `adapter-skills.test.mjs` "an invalid settings file is named" (watched; the recheck found the first commit had not fixed it) |
| V3-12 | UX-3, UX-4, UX-5, UX-6 | Focus fell to the page after Use another coding agent, a scan import, the usage notice's Continue and Remove | fixed: focus goes to the coding-agent choice (Create and Adapt), the import summary's first action, the screen's heading and the next fallback row respectively (`AgentPaths.tsx`, `StartPaths.tsx`, `UsageCountsNotice.tsx`, `FallbackOrderSetting.tsx`); the UX recheck walked UX-4, UX-5 and UX-6 in the app |
| V3-13 | UX-8, DO-4 | SCN-136 said the first task stays on its board; the code cancels it | fixed: SCN-136, SCN-131 and SCR-74 say it is cancelled — by Use another coding agent and by Start over — unless its session runs, and that a refused cancel is said |
| V3-14 | UX-9, DO-3 | The preselection rule was stated as "else the first found" in five places | fixed: ADR-0129 §5, SCN-131/136 step 4, SCR-74 `idle` and `start.builder.orderUnread` state the code's rule (order, then connected, then found) |
| V3-15 | UX-10, DO-7 (part) | The two usage-notice strings worded the switch differently | fixed: both say "the one switch every PassionCode.ai app on this Mac reads … in the settings"; `analytics.notice.nothingYet` has its registry row |
| V3-16 | UX-11 | The English "console did not open" sentence named its button without quotes | fixed: `start.consoleNotOpened` quotes `{retry}` |
| V3-17 | UX-12 | Russian progress lines spoke in the first person singular | fixed: «Читаем…», «Добавляем…», «Сканируем…», «Создаём папку…», «Ищем на этом Mac…» |
| V3-18 | UX-13 | The setup preset's reason sat only in a disabled button's title | fixed: the reason is a visible line on the task panel, tied to the button by `aria-describedby` |
| V3-19 | DO-2 | "Sends nothing, ever" remained in SCN-134, ADR-0127 §4 and a test title | fixed: SCN-134 alt path, ADR-0127 amendment 2 and the `analytics.test.mjs` title say it holds while the shared switch stays off |
| V3-20 | DO-5 | ADR-0125 and SCN-135 did not record the setup preset's pass-over; probe results and check order differed | fixed: ADR-0125 amendment 1; SCN-135 alt path |
| V3-21 | DO-6, PL-5 | CHANGELOG and SCR-52 said 0.3.2 "already sent"; ANALYTICS said the Settings note "says the same" | fixed: "may already have sent" in CHANGELOG and SCR-52; ANALYTICS says the note says what is counted |
| V3-22 | DO-7 | Housekeeping: SCR-52 index row coverage, the CHANGELOG's "in the top bar", the FabricStrip comment, product-model SCR-74/75 citing ADR-0100, the adapter types in no region | fixed: each corrected; `adapter-skills-view` region; `check-regions.mjs` PASS |
| V3-23 | DA-4 | The fallback preview ignores the setup preset | ruled CO-234: the launch is right; the preview names the wrong agent until it takes the launch's needs |
| V3-24 | DA-5 | The lifecycle table did not list the fallback preview's machine probes | fixed: `AGENTS.md` lifecycle row for the preview (on focus, at most once per 30 s, `FRESH_MS`) |
| V3-25 | DA-6 | `menu.test.mjs` was not in the fast tier; the setup guard's main wiring has no test | fixed: `scripts/ci.sh` fast tier runs `menu.test.mjs`; the guard is the tested `refuseSetupWithoutSurface`, called from `tasks.start` (the handler itself is reached only by the stack-backed tier) |
| V3-26 | DA-7 | `start.taskRefused.readback-failed` had nothing that sends it | fixed: the strings (en, ru), the registry row and its code mapping are removed |
| V3-27 | DA-8 | A finished onboarding task stays as open work on the board | ruled CO-235: needs a rule for what closes an onboarding task |
| V3-28 | PL-1, PL-9 | The Release close list left out the iteration-3 artifacts, the map entry and MERGES; a provider auto-update forces a new candidate | fixed: *Release close* item 1 names them and the re-pin risk |
| V3-29 | PL-2 | No release-close item for the knowledge base after publication | fixed: *Release close* item 6 |
| V3-30 | PL-3 | The narrowed REQ-08 waits for an operator review nothing asks for | fixed: *Release close* item 0: the operator accepts or rejects the reading before the release commit |
| V3-31 | PL-4 | CO-197 said publish before release; the list put it after the tag | fixed: CO-197 and item 5 both say after the tag, as 0.3.2 did (`f2ec0587`) |
| V3-32 | PL-6 | The CHANGELOG's fallback bullet left out «Fallback order → agent» in the panels | fixed: added |
| V3-33 | PL-7 | The plan header mapped RM-13/20/25 to lane 12; their rows sit in lanes 9, 6 and 4 | fixed: header corrected |
| V3-34 | PL-8 | CO-222 not re-dated with CO-221; CO-221 kept a done PL-13 clause | fixed: both corrected |
| V3-35 | DO (note) | Codex updated itself to 0.162.0 | fixed: `repin-provider-builds.mjs` → 0.162.0, rows unverified; `check-provider-capability.mjs` PASS |
| V3-36 | ER (recheck N-1, blocking) | The coding agent was the attempt's only from the first launch: leaving before it and coming back showed the default while the retry sent another agent | fixed: `create` records the agent on the attempt at the press; `StartPaths.test.tsx` "the agent chosen at the press is the attempt's" (watched); rechecked at the final candidate |
| V3-37 | ER (recheck N-2) | A folder-exists refusal that arrived while the person was away was not said on return | fixed: the refusal is kept for the attempt and said by a screen mounted meanwhile; `StartPaths.test.tsx` "a folder-exists refusal that arrives while the person is away" (watched) |
| V3-38 | ER (recheck N-3) | "Could not be cancelled" could show for a task the launch never recorded | fixed: `abandon` reads the board's "that task no longer exists" as nothing to cancel |
| V3-39 | UX (recheck UX-R1) | With the session running, the note still advised Start over, which is not offered then | fixed: the made-folder note shows only where Start over is offered |
| V3-40 | ER (final recheck NB-1, blocking) | After a refused name was changed and a later step failed, a return showed the old name and sentence and the retry sent them for the new folder (also when the folder request threw) | fixed: the kept attempt takes the press's name, sentence and place (`keepFor`); `StartPaths.test.tsx` "after a refused name is changed, a later failure and a return keep the NEW name" (watched against the old merge); rechecked at the final candidate |
| V3-42 | ER (NB-1 recheck, non-blocking) | `tasks.move` still reports a failed read as "that task no longer exists" | ruled CO-239: the same class as V3-41 in the board's move handler; it predates this candidate and is outside its change |
| V3-43 | ER (NB-1 recheck, non-blocking) | A rename typed after a refusal but never pressed is lost on leaving; on return the refusal is said in the callout and focus lands on the heading | ruled CO-240: what the screen says is true; keeping an unpressed edit and placing the returned refusal under the field belong to the next pass on SCR-74 |
| V3-44 | ER (NB-1 recheck, non-blocking) | Board refusal sentences from main are English inside the Russian interface | ruled CO-225: named in the release notes («Russian») |
| V3-45 | ER (NB-1 recheck, non-blocking) | Every Try again calls `projects.create` again with the same Project id | not a defect: the create handler finishes a repeat of the same create instead of making a sibling (`main/index.ts`, `projectsCreate`: "A repeat of the SAME create finishes it"), and the repository attach runs again by design |
| V3-41 | ER (final recheck, N-3 residual) | `tasks.close` reported a failed read as "that task no longer exists", which the screen reads as nothing to cancel | fixed: `tasks.close` says a failed read as itself |

Exit for iteration 3: every finding above is fixed, ruled with a register id or not a defect; the four blocking ones were rechecked by their reviewers at `fa9cdf6b`, the final candidate. Blocking findings open: none.
