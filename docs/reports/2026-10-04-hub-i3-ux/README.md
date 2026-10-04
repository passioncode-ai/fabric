---
report:
  id: fabric/2026-10-04-hub-i3-ux
  title: "Hub iteration 3 independent UX and behavior review"
  kind: review
  project: fabric
  domains: [ai-agent, mcp, reliability]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-10-11
  summary: >-
    Frozen baseline 3b2878fc has four freshly reproduced UX races: overlapping consent
    sheets, an old poll replacing post-disconnect state, expired consent shown after
    a delayed read, and a background consent sheet after focus loss. Existing focused
    tests pass; 60 browser prototype checks do not establish Electron, native
    VoiceOver, live Inbox, release or whole-project acceptance. Recheck fixes separately.
  sources:
    - name: Frozen Fabric source under independent review
      url: "https://github.com/passioncode-ai/fabric/tree/3b2878fc9283db5fc9a81697ba8538a01630b8d9"
      read_at: 2026-10-04
    - name: Independent runtime and prototype receipts
      path: raw/
      read_at: 2026-10-04
  produced_by:
    agent: Codex independent UX reviewer
    task: hub-i3-ux
  supersedes: []
  consumers: [fabric]
---

<sub>ssheleg skills — ux-audit · copywriting · sheleg-design · project-reports · task-pipeline</sub>

# Independent hub UX review

## Verdict and scope

**REFINE. Frozen baseline FAIL for consent sequencing and post-action state.** Four new defects reproduce with independent delayed-read fixtures. The established focused suites pass: **85 Node tests and 68 Vitest tests**, while the new fixtures fail **3 presenter checks and 1 panel check**. These measures answer different questions; the established green suite does not clear the races. Exact source: [`3b2878fc9283db5fc9a81697ba8538a01630b8d9`](https://github.com/passioncode-ai/fabric/commit/3b2878fc9283db5fc9a81697ba8538a01630b8d9). [Receipts](raw/)

Scope: SCN-132/133, ST-045, FLW-75/76; connect, disconnect, reconnect, consent, polling, narrowing, refusal/recovery, result-envelope guidance, EN/RU and light/dark. This is a deliverable review, not an audit of every Fabric capability. Canonical scenario status remains `draft` / product `unobserved`; this review does not change the base. The parent integration task owns map, shared ledger and wiki index updates. No UI, register, live Inbox, paid operation or real consent state was mutated.

Fresh review order: actual AGENTS and organizational knowledge/policy → canonical foundation/scenarios/flows and original ADR-0115 decision → production main/renderer/shared strings and workflows → execution. The author’s recovery report and dispositions were not used as evidence or a finding checklist. The report catalog was located for freshness metadata only. Prior memory informed the requirement to separate local execution from release proof; all current findings below come from the frozen source and newly executed fixtures.

## Findings

| ID | Severity | Finding and user consequence | Proof | Required correction |
|---|---|---|---|---|
| UX-I3-01 | P1 | Two pending checks can each open a still-unanswered consent sheet. The operator can receive overlapping authority decisions rather than one ordered prompt. | RUNTIME: `present(r1)` and `present(r2)`, delayed `stillPending`, then resolve both: **2 sheets**, expected 1. [fixture](raw/presenter-independent.test.mjs), [failure](raw/presenter-baseline.log). STATIC: `consentPresenter.ts:119`, `:129`, `:139` acquire the guard only after the await. | Acquire the single-flight guard before asynchronous queue selection; release on all paths. Keep requests recoverable when the pending read fails. |
| UX-I3-02 | P1 | A pre-disconnect poll can replace the newer disconnected overview. Reconnect and Disconnect reappear beside “Fabric no longer uses its key,” making the screen disagree with the completed action. The same ordering gap applies to permission lists. | RUNTIME: connected read → deferred 4-second poll → Disconnect → disconnected post-action read → old connected poll resolves: **Reconnect reappears**. [fixture](raw/panel-independent.test.tsx), [failure](raw/panel-baseline.log). STATIC: `AgentAccessPanel.tsx:73`, `:84`, `:102` accept every response with no generation/order check. | Ignore superseded reads, including late failures, and invalidate pre-action reads. Preserve post-action focus and unavailable handling. |
| UX-I3-03 | P2 | Consent that expires during a delayed pending read still opens. Allow will subsequently be refused; the operator spends attention on a decision no longer possible. | RUNTIME: pending check starts before expiry; advance clock 600001 ms; resolve true: **1 sheet**, expected 0. Same [presenter fixture and log](raw/presenter-baseline.log). STATIC: `consentPresenter.ts:123` freezes time before `:129`. | Recheck expiry after asynchronous reads and before drawing; do not accidentally hide other queued work. |
| UX-I3-04 | P2 | A focused window losing focus during the pending read still receives a native sheet in the background. This breaks the scenario’s notification/attention fallback. | RUNTIME: focused present → pending read held → focus false → read resolves true: **1 sheet**, expected 0. [fixture](raw/presenter-independent.test.mjs). STATIC: `consentPresenter.ts:121` chooses a parent before the await, `:144` uses it without checking current focus. | Recheck the current focused, visible, live parent after the await; retain the request for resume/notification. |

These are grouped into two correction areas: presenter lifecycle (01/03/04), and panel read ordering (02). No source fix was authored by this reviewer. Findings were sent to the integration owner immediately with exact fixtures.

### Agent guidance gap shared with the errors lane

STATIC: `hubTools.ts:83` and `:170` promise that every later uncertain key is refused and never sent again. `hubCall.ts:338` sweeps all settled expired keys, `:381` removes an expired key, and `:404` evicts any settled oldest key, including uncertain outcomes. This baseline therefore cannot fulfill its permanent refusal guidance after expiry/cap eviction. ADR-0115’s amendment 21 promises retained/tombstoned effect memory as well. This report does not duplicate the core errors reviewer’s independent safety finding or claim an execution receipt for the expiry case; it records the operator/agent instruction contradiction for joint recheck. Retry guidance must match the exact fixed implementation, including process-replacement limitations.

## Scenario and behavior evidence

| Area | Baseline result | Evidence and limit |
|---|---|---|
| SCN-132 registered agent request, same-user floor, quoted/sanitized facts | STATIC aligned; focused executable checks pass; concurrency FAIL | `shared/access.ts:141` one-line normalization and `:201` validation; `accessWords.ts:95` prompt; [68 Vitest checks](raw/vitest-baseline.log), [85 Node checks](raw/node-baseline.log); findings 01/03/04. |
| Poll secret, one-time credential collection, denial, expiry and incremental grant extension | Focused bounded execution PASS | Node `hub-access-service.test.mjs` and `hub-access-refusals.test.mjs` in [receipt](raw/node-baseline.log). No real agent credential issued. Lost creating/claim responses still require the documented ask-again recovery; this review does not claim exactly-once network delivery. |
| Narrowing and setup extras; missing grant/refused unknown resource | Focused bounded execution PASS | `shared/access.ts` coverage/resource checks, `hubCall.ts:261`; existing `hub-call` and access-refusal cases in [Node receipt](raw/node-baseline.log). Stand-ins prove Fabric-side inputs; live product enforcement is NOT_RUN. |
| SCN-133 connect/reconnect/deadline/vault/predecessor recovery | Focused bounded execution PASS; panel state ordering FAIL | `productConnect.ts:227` begin, `:281` callback, `:368` validation, `:386` unique vault slot, `:412` predecessor read, `:428` record, `:438` late withdrawal, `:472` disconnect; `hub-products.test.mjs` in [receipt](raw/node-baseline.log); finding 02. Product callbacks and vault processes are owned local fakes, not Inbox/vault acceptance. |
| Product error versus Fabric refusal envelope | STATIC aligned and focused result tests PASS | `hubTools.ts:170` distinguishes `output` and `{error:{code,message,data?}}`; `hubCall.ts:310` wraps product result. [Node receipt](raw/node-baseline.log). Uncertain-key guidance gap remains above. |
| Empty, loading, unavailable, waiting, declined, failed, late-withdrawn, reconnect state | Prototype bounded execution; 48 state records | [browser data](raw/browser-baseline.json) has 12 states × 4 locale/theme combinations. Loading returns a never-resolving fake; it proves distinct loading rendering, not a production timeout guarantee. |
| Decision refusal and allowed-but-not-connected recovery; queue result and focus | Prototype bounded execution; 12 interaction records | Two Allow outcomes and board Allow per locale/theme; [browser data](raw/browser-baseline.json). Explicit expired refusal stays localized; allowed/not-connected retains the Allow and separates machine detail. Panel focus reaches its section; queue focus reaches its named result. Fake overview remains fixed after acts, so these records do not prove projection removal/convergence. |
| ST-045 complete coding-agent path | PARTIAL by declared product scope | `shared/servers.ts:107` still refuses Fabric-started sessions’ product route under CO-194. External registered-agent hub operation does not complete the broader story. ADR-0115 amendment 6 records this boundary. |
| Real Electron native sheets/notifications, real Inbox consent/revoke, live agent call, native VoiceOver | **NOT_RUN** | This review launched no real app or real consent, enrolled no agent, and used no live product credentials. Native acceptance remains a separate gate. |

Line references resolve in the [frozen source tree](https://github.com/passioncode-ai/fabric/tree/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src). [Source fingerprints](raw/source.json) pin the reviewed files. No whole-project green gate, hosted CI, release, installation or deployment claim is made; the parent supplied a separate full-gate failure context, which is not re-executed or upgraded here.

## Rendered copy and visual observation

Browser matrix: production `AgentAccessPanel`, `BoardScreen`, CSS/tokens and i18n from the frozen worktree, mounted by `test/visual/hub-surface/main.tsx` with fake `window.fabric`. Chromium via Playwright; **760 × 1000**, reduced motion, English/Russian, light/dark. **60 cases, 0 page errors, 0 overflow in the inspected `.access-asks li` / `.access-acts .toolbar` nodes.** [Executable review](raw/browser-review.mjs), [summary](raw/browser-baseline.log), [capture metadata](raw/captures.json). These are scoped counts, not a global layout, WCAG or native-app grade.

The inspected captures are [long RU light](raw/browser-long-ru-light.png), [vault failure EN dark](raw/browser-failed-en-dark.png), [empty EN light](raw/browser-empty-en-light.png), and [unavailable RU dark](raw/browser-unreadable-ru-dark.png). They contain the intended surface rather than blank frames. Empty statements remain distinct from an unreadable list. The failure and unavailable messages lead with localized product meaning and put machine wording on a separate line. Long IDs, repository origins and mailbox text wrap within the narrow card. This long capture continues below the viewport: it does not prove the entire consent and controls are visible at once. The browser data establishes full text presence; no screenshot-only accessibility claim follows.

Copy reviewed against `docs/brand/voice.md` (peer-builder), `terminology.md`, `facts.md`, `channels.md` and `strings.md`. Observed headings/actions use established product names; request reasons/registry names remain explicitly external claims and are intentionally untranslated. `Project Observatory`, `Fabric Inbox`, `Gmail` and `Mac` remain product terms in Russian. No interface copy was changed or humanized in this report.

`python3 docs/ux/lint.py`: **exit 0**, two inherited-baseline notes. `python3 docs/brand/lint.py`: **exit 0 with 1472 warnings**, therefore not a clean brand review. Full untruncated outputs: [UX lint](raw/ux-lint.log), [brand lint](raw/brand-lint.log). The warnings cover the project, not merely this bounded hub surface. No accessibility scanner was installed. WCAG contrast/target-size conformance, text zoom, native VoiceOver announcements and Electron dialog geometry are **NOT_RUN**. DOM focus and accessible button names exercised by the browser are narrower evidence.

## Checks and reproducibility

Install: `pnpm install --offline --frozen-lockfile --ignore-scripts`, exit 0, 497 packages reused locally; no dependency sources committed.

Commands at the frozen source (logs retain exact test names):

```sh
node --experimental-strip-types --test apps/desktop/test/consent-presenter.test.mjs apps/desktop/test/hub-access-service.test.mjs apps/desktop/test/hub-access-refusals.test.mjs apps/desktop/test/hub-products.test.mjs apps/desktop/test/hub-call.test.mjs
pnpm --filter @fabric/desktop exec vitest run src/renderer/src/AgentAccessPanel.test.tsx src/shared/accessWords.test.ts src/shared/access.test.ts
node --experimental-strip-types --test docs/reports/2026-10-04-hub-i3-ux/raw/presenter-independent.test.mjs
```

First two exit 0; third exit 1 as expected for the baseline regression. The panel fixture is source-relative: copy `raw/panel-independent.test.tsx` to `apps/desktop/src/renderer/src/_i3-review.test.tsx`, run `pnpm --filter @fabric/desktop exec vitest run src/renderer/src/_i3-review.test.tsx` (baseline exit 1), then remove that task-owned temporary fixture. It is not shipped in the production tree.

Browser: `node apps/desktop/node_modules/vite/bin/vite.js --config test/visual/hub-surface/vite.config.mjs --port 5299`, then `node docs/reports/2026-10-04-hub-i3-ux/raw/browser-review.mjs`. The runner accepts `FABRIC_REVIEW_URL`, `FABRIC_REVIEW_OUT` and `FABRIC_PLAYWRIGHT_MODULE`; the baseline uses already available local Chrome/Playwright. Recheck changes must carry their own source fingerprint and output paths rather than rewriting the frozen baseline receipts.

## Handoff

Objective: independent I3 UX/behavior review of the exact frozen hub baseline. Completed: canonical source-first review, four new reproducible races, focused test execution, bounded browser EN/RU/theme matrix, dated raw receipts. Decisions: report-only branch; no fixes by the reviewer, no shared-register edit, no native/live authority mutation. Integration parent owns one central map/ledger/wiki index update. The route was read from the operator-provided instructions, actual Fabric `AGENTS.md`, knowledge `README/vision/principles/how-to-work/rules`, and the skill paths stated in the run.

**Exact next task:** receive the integration owner’s committed fix SHA; inspect its source changes without relying on dispositions; rerun both independent fixtures against that exact source; repeat only affected browser states; preserve a separate recheck receipt. Verify uncertain-key guidance with the errors reviewer’s expiry/eviction tests. Keep unknown pending-read recovery and background/resume behavior in the regression set. Real Electron consent and native VoiceOver remain separate NOT_RUN gates; release approval is not this reviewer’s authority.

Open operator review choice for the parent close-out: are the two correction areas—serialized/revalidated consent and ordered overview reads—the right plan, and does the exact fixed implementation preserve recovery? This is a review invitation, not authorization for a live action.

## Skills actually used

`ux-audit` compared canonical scenarios with production paths and independent fixtures. `copywriting` checked existing consent/recovery terminology and localization against the brand pack; no new product copy. `sheleg-design` scoped captured visual observations and their native/accessibility limits. `project-reports` created/validated the owning-repository dated report; the parent owns its single wiki index run. `task-pipeline` structured source-first intake, measured tests and report branch handoff; source fixes/deployment stages are outside this reviewer’s task. `project-reports` is foreign to the family. The audit output lives here under the explicit operator report standard rather than the skill’s default `docs/ux/audits/`; scenario audit statuses are intentionally unchanged under the parent’s report-only constraint.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
