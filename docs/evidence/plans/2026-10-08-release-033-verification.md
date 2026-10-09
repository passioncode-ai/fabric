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

_Not started._

## Iteration 3

_Not started._
