# Adoption audit: checks and limits

Baseline: `bac1f67f295b1b05a5caf914f59aa63ced94d439`. Date 2026-09-17.

This iteration audits and designs; no native application, live provider, microphone, scheduler, invitations or production writes were exercised. Current product readiness remains unchanged. The complete 85-view inventory is a source survey, **not 85 × every-state click verification**. Missing end-to-end checks have explicit owners AD22/23; no claim of maximum conversion or zero-error agent execution.

## Audit observations actually run

- Entry audit: 11 existing pure tests passed, plus source-mode handler probe. [Evidence and 24 transitions](audit/2026-09-17-entry.md).
- Return audit: 21 existing pure tests passed, plus four pure reproductions. [Evidence](audit/2026-09-17-return.md). The 11 and 21 overlap; do not sum them into unique test coverage.
- Inventory: each of the 85 model view IDs assigned once to 20 families; canonical references read from explicit fields. [Snapshot](inventory.json).
- Parser semantic probe: `node docs/launch/adoption/audit/parser-red.mjs` is an **expected failing reproduction** on this baseline; does not change source. Standard projection check passes despite semantic defect. Fix is AD00; no runtime coverage is inferred.
- Canonical UX lint: 0 errors, 1 existing U077 warning about installed vision-rule text; historical inherited verdicts retained.

## Browser B01: first idea, actual prototype clicks

Local preview of baseline product report, personal Estate, new cohort, ready. Created only page-local synthetic data called “Adoption review”; no disk/project creation or provider call.

1. Empty Home displayed “Пока без проектов”. Window tab still offered Atlas; prototype shell leakage requires AD20 review.
2. “Создать первый проект” → “Новая идея” → “Продолжить”: name and intended-result form.
3. Entered name/result → “Выбрать исполнителя”: “Настроить позже” available; no account required.
4. “Проверить проект”: exact name/result, “Без репозитория”, “Не выбран · ещё не допущен”.
5. “Создать проект”: guide claimed “Fabric уже знает цель вашего проекта”; there was no sourced context or return checkpoint visible.
6. “Записать первую задачу”: “Задача сохранена; запуск не начат”, exact Task link and optional Board tutorial offered; progress 2/4.

This supports reachable setup and honest no-run messaging, not demonstrated first context-return value. Native durable draft collision remains a static strong finding until actual shell test AD02. Guided retry draft loss and scope-override split remain hypotheses until focused controller/browser checks; they were not upgraded by this path.

## Cross-audit review

34 observations consolidated into 18 proposed decisions. ENT04/05, RET02/03/10, INV06/07 share the setup-vs-value cause; retain raw observations rather than count independent defects. ENT08 is a hypothesis, ENT03 static, RET04 and ENT02 have pure reproductions, and INV01 has a semantic red probe. Severity denotes impact on design/release confidence, not observed production incidents. Atlas Live and seeded cycles are prototype data problems; do not misreport as production data leaks.

## Still required before runtime acceptance

Actual native restart and hydration; filesystem/source scope; typed command crash/replay; real voice RU/EN and interruption; admission and real bounded Run; independent result checking; cycle window/catch-up; invited ACL; keyboard/screen reader/native focus and text scaling; novice moderated first-use/return. These are owned by AD02/04/05/07/09/13/15/16/17/21/22/23. Existing prototype tests cannot satisfy them.

## Delivery checks for this iteration

- `node scripts/check-adoption-plan.mjs`: PASS — 85 views, 20 families, 34 observations, 18 decisions, 24 packets, 7 phases; 47 immutable baseline source pins resolved and hashed. Checks DAG, coverage, finding→decision→packet references and report anchors, not semantic product correctness.
- `node --test scripts/test/adoption-plan.test.mjs`: 10/10 PASS, including nine planted defects rejected (missing/duplicate view, cycle, orphan finding, wrong upstream output, missing source pins, unknown phase packet, duplicate requirement owner, missing negative check).
- `node scripts/build-adoption-report.mjs --check`: PASS; generated HTML matches source data and current shared brand tokens.
- `node --test scripts/test/calm-context.test.mjs scripts/test/calm-flows.test.mjs scripts/test/calm-work.test.mjs scripts/test/ceo-onboarding.test.mjs`: root rerun 21/21 PASS, overlapping earlier batch checks.
- `bash scripts/check-docs.sh`: exit 0; relative Markdown links resolved (403 inspected files), existing 696 brand warnings and one UX U077 warning retained. These warnings are not an accessibility verdict.
- Expected-red `node docs/launch/adoption/audit/parser-red.mjs`: exit 1 with actual assertion “SCR-63 must not inherit SCN-031”; source refs printed include 083/084/085/087/088/089 plus unintended 094/042/031/059. This is a reproduction, deliberately outside passing CI; AD00 must replace it with actual parser regression.

### Browser B02: interactive planning artifact

Local `/adoption.html`, desktop 1280×900 and narrow web 390×844. Screenshot inspection: hierarchy, phase controls, readable card/disclosure layout. At 390, measured document clientWidth=scrollWidth=390; both selectors width 358. This proves bounded layout, not comprehensive WCAG or native usability.

Actual clicks: invited cohort → existing-work CTA (no compulsory project creation); unknown-result explanation; phase S2 transition; idea cohort → repo-free saved-intent explanation; feature search “память” → one family; P0 filter → five observations; INV01 disclosure → D01 decision anchor. Native system operations are absent from this artifact. Browser locator by implicit label did not resolve in the automation adapter despite the accessible snapshot naming it; exact observed DOM IDs succeeded. This tool limitation was not counted as a product defect.

The current product prototype and this proposed route were reviewed separately. More detailed application-state verification is explicitly required in packets; the planning artifact does not satisfy those packets.

First fast-CI attempt correctly refused register formatting/counts and undated audit filenames containing baseline line receipts. Fixed the new CO row's table continuity, computed carry-over count 167 / work remaining 137, and placed immutable audits in dated filenames. No gate was weakened and no old source receipt rewritten. `node scripts/check-registers.mjs` then passed. The expected-red parser defect remains explicitly open in AD00.

All seven phase controls were additionally clicked in B02; each showed its own heading. Regenerated the existing completeness report after automated proof that its cited M131 row was unchanged; regenerated the plan projection after the backlog count changed. These are derived-output freshness fixes, not promotions of product capability.

### Installed CLI changed during the audit

Fast CI reached provider capability and refused the old current pin. Read-only probes now returned `claude --version` = `2.1.274 (Claude Code)` and `codex --version` = `codex-cli 0.154.0`. Updated current-build metadata/date only; all current capabilities remain unverified, historical observations remain untouched. No login, session, model call or credential probe was performed. This exception is metadata maintenance, not an implemented adoption feature.

### Final plan review and strengthened gate

A separate read-only reviewer found missing native surface/test ownership and a weak STT prerequisite. Corrected the plan before handoff: native AttentionPanel/App/TaskPage/ProjectHome/BoardPanel plus preload/types/main owners; explicit test write candidates; per-edge proof tier, passed status and readiness predicate; unresolved STT cannot unlock capture integration. Separated full folder discovery into AD24 so the minimal idea/checkpoint path does not await batch scanning. Actual topological ordering is now enforced. AD00 and AD02 remain the two bounded ready starts.

Final structural check: **85 views / 20 families / 34 observations / 18 proposed decisions / 25 packets / 7 phases / 53 immutable source pins**, PASS. Strengthened validator tests: **13/13 PASS**, now including missing test owner, wrong proof tier and unresolved STT wrongly accepted. Earlier 24-packet/47-pin/10-test output above records the earlier draft, not current counts. Browser additionally verified all five starting-cohort titles/actions and a cross-link to a finding hidden by the prior filter: it resets the filter and reveals the exact finding.

`bash scripts/ci.sh fast` reached exit 0 after the version-only metadata correction. Final packet-review edits are checked again before source commit and by the publication rail. Stack-backed full probes, native runtime and real user pilot remain NOT_RUN; they are not required to claim this audit/plan publication and are required for the respective future capabilities.

Final pre-commit rerun after the 25-packet review: `bash scripts/ci.sh fast` **exit 0, fast tier green**. The production/stack-backed full tier was not run. Current source pins, report generation, register arithmetic, canonical UX projections, 85 existing mockup previews and plan projection all passed their applicable checks. This certifies this source iteration's gates, not the future adoption implementation.
