---
report:
  id: fabric/2026-10-05-hub-i3-ux-130b5510
  title: "Fabric 0.3.1 · iteration 3 · ux review at 130b5510"
  kind: review
  project: fabric
  domains: [architecture, reliability]
  as_of: 2026-10-05
  status: active
  valid_until: 2026-10-19
  summary: >-
    Independent iteration-3 ux review of the converged 0.3.1 candidate 130b5510: verdict approve,
    8 findings, 0 blocking. Dispositions live in the hub verification ledger.
  sources:
    - name: "Candidate source"
      url: "https://github.com/passioncode-ai/fabric/tree/130b5510011a0f15858642838fc906ad4af4bf67"
      read_at: 2026-10-05
  produced_by:
    agent: "independent reviewer subagent (fresh context), saved by the coordinator"
    task: "p08-i3-review-130b5510"
  supersedes: []
  consumers: [fabric]
---

# Fabric 0.3.1 · iteration 3 · ux review at 130b5510

Candidate: `130b5510011a0f15858642838fc906ad4af4bf67`. Independent reviewer run (fresh context, earlier reviews not read before the findings were formed). Saved by the coordinator verbatim from the reviewer's final message; the reviewer's harness refused `.md` writes. Structured findings: `findings.json`.

## Method

I scoped the change with `git diff v0.3.0 130b5510 -- apps/desktop/src/renderer apps/desktop/src/shared docs/ux` (48 files, +3765/−346). I read the new and changed scenarios, flows and screens:
- SCN-132, SCN-133, SCN-126 (CO-176) and the CO-180 coverage
- FLW-75 and FLW-76
- SCR-41 "access request", the SCR-70 sign-in states and SCR-76

Then I read the renderer and shared code against them:
- `AgentAccessPanel.tsx` and the queue's `AccessActs` in `ObligationActs.tsx`
- `BoardScreen.tsx`, `attentionTitle.ts`, `sidePanel.ts`, `App.tsx`, `FirstRun.tsx`, `Onboarding.launch.css`
- the access CSS, `shared/access*.ts`, `attention.ts`
- every added `en.ts`/`ru.ts` key

I followed main's operator-facing text on the consent path (`consentPresenter.ts`, the `hub-ipc` handlers, `hub.ts`, `productConnect.ts`) to check that no English reaches a Russian sentence. I checked the ru copy by hand against `docs/brand/terminology.md`. I wrote my findings before opening any earlier review.

## What I ran

All exit 0; `git status` was clean before and after.

| Command | Result |
|---|---|
| `npx vitest run` on the 10 relevant files (AgentAccessPanel, ObligationActs, BoardScreen, StartPaths, sidePanel, Onboarding, onboardingDraft.persist, accessWords, access, attention) | 192/192 passed |
| `node --experimental-strip-types test/consent-presenter.test.mjs` | 13/13 passed |
| `node --experimental-strip-types test/executor-auth.test.mjs` | PASS |
| `node scripts/test/first-release.test.mjs` | 51/51 passed |

## Findings

All are non-blocking.

| ID | Title | Evidence | Fix |
|---|---|---|---|
| U-1 | Deny is standing (that request is answered "denied" automatically until cleared), but the native prompt, the queue and the SCR-76 card never say so. Deny is also the default and the Esc/Enter answer, so a stray Enter makes a silent auto-deny. "Denied requests" does not explain what Clear does. | `accessWords.ts` `consentPrompt` (`defaultId`/`cancelId` 0, no denial line); `PendingCard`; `AccessActs`; `flows.md:2255`; `scenarios.md:3226` | Add one localised line on all three surfaces, plus one under "Denied requests". |
| U-2 | After an Allow whose product did not open, the queue says "allowed" twice and "it" is ambiguous: "You allowed X to use Fabric Inbox. Allowed. To connect it, open Agent access…". ru has the same doubling. | `ObligationActs.tsx:154-156`; `en.ts:878`; `ru.ts:318` | Add one dedicated key: "You allowed {name} to use {product}. {product} did not connect: {problem} …" |
| U-3 | The ru first-run sign-in strings say «Исполнитель». The same step says «агент для кода», which the brand terminology requires. The en/ru "authenticated" line has no final period. | `ru.ts:1583-1587` vs `1568-1569`; `terminology.md:24,39`; `en.ts:1713` | Use «агент для кода» and add the periods. |
| U-4 | The product card's Connect/Try again/Reconnect/Disconnect buttons do not name the product to a screen reader. SCR-76 says every button names whose it is. | `AgentAccessPanel.tsx:192-196`; `screens.md:1791` | Add aria-labels with the visible words first, or narrow the spec sentence. |
| U-5 | SCR-76 gives no named result after a plain Allow or Deny; the card just vanishes. The queue says "You allowed X to use Y". | `AgentAccessPanel.tsx:275-276` vs `ObligationActs.tsx:156` | Reuse `access.queue.allowed`/`denied` as an info line. |
| U-6 | In the same-user disclosure, "It/Он cannot prove…" has an ambiguous subject; in ru, «Он» reads as the agent. | `en.ts:880`; `ru.ts:320` | Say "Fabric cannot prove…" / «Fabric не может доказать…». |
| U-7 | The ru sign-in-required line is a literal translation: «он открыл свой вход». | `ru.ts:385` | «…и уже открыл окно входа». |
| U-8 | `first.exec.note` is no longer rendered but is still in en/ru and in `strings.md:265` as implemented. The Installed/Ready legend is gone. | `FirstRun.tsx:184`; grep finds no other use | Remove the key and its row, or keep the legend. |

## Checked and as specified

- **Consent text and native prompt.** Every consent-path sentence comes from the registries in en and ru. Deny is the default. The machine's own words are on a secondary line. The English fallbacks `done.reason` and `started.reason` cannot be reached.
- **SCR-76 states.** Hub-off gives a remedy per cause. Unreadable is never shown as an empty list, and stale reads are fenced. The waiting, reconnect and disconnect lines match the spec. Expiry is handled.
- **Layout, focus and theme.** Long resources wrap and toolbars wrap. Focus moves to the affected section or the result callout. The Allow button's accessible name contains its visible words. The new CSS uses only tokens, so light and dark both follow them. Only one side panel is open at a time. Queue titles are localised everywhere.
- **First run (CO-176).** Continue stays usable while the check runs. A missing sign-in status is treated as unknown, never as signed in.

## NOT_RUN

- Native visual acceptance: the consent sheet and its follow-ups, the notification and its click-through.
- Live light/dark, narrow-window and long-text rendering in Electron (only jsdom tests and token use were checked).
- VoiceOver and live keyboard traversal.
- Switching the running app to ru, including the prompt's locale in main.
- A live Fabric Inbox connect with the Project Observatory vault.
- The live first-run sign-in status against the installed Claude Code and Codex.
- `scripts/ci.sh`, `check-design-map.mjs`, `check-registers.mjs` and `check-docs.sh`, as instructed.

## Verdict

**Approve.** U-1 and U-2 are the two worth fixing next, because both are on the consent path.

## Recheck at the replacement candidate 19e5427a — 2026-10-05

The same reviewer, continuing its own context, rechecked its findings at `19e5427aabfec4ef23f7131136ffbe2b6ea6c6d1`. Verdict: **approve**. Structured result: `recheck.json`.

| Finding | Result | Evidence |
|---|---|---|
| U-1 | fixed | access.denyStands is added to all three decision surfaces: the native prompt detail (shared/accessWords.ts consentPrompt, after access.lasts), the queue facts (launch/ObligationActs.tsx AccessActs) and the SCR-76 PendingCard (AgentAccessPanel.tsx). access.denials.note now sits under 'Denied requests' (AgentAccessPanel.tsx). en and ru present (en.ts:880-881, ru.ts:320-321). The SCN-132 rationale is |
| U-2 | fixed | One key, access.queue.allowedNotConnected (en.ts:961, ru.ts:401), used at ObligationActs.tsx:155. 'allowed' is now said once. The new sentence is not asserted by any test (see U-10). |
| U-3 | fixed | ru.ts start.executor.auth.* now say «Агент для кода» / «агента для кода»; the authenticated line ends with a period in en.ts:1714 and ru.ts:1584; StartPaths.test.tsx passes. |
| U-4 | fixed | Toolbar takes a `label` and renders role=group aria-label (components/Toolbar.tsx); the product card passes label={p.name} (AgentAccessPanel.tsx:188); the test 'I3 U-4' asserts that the group named 'Fabric Inbox' contains Connect; the SCR-76 Elements sentence is narrowed to match (screens.md:1791). A group label is an accepted way to name a cluster of controls. |
| U-5 | ruled-acceptable | Ruled to CO-207 (docs/evidence/specs/2026-08-16-software-fabric-carryover.md:218, open, owner path AgentAccessPanel.tsx; ledger V3-5). I accept the ruling: the outcome is correct and visible (focus moves to the changed section, and the card leaves for 'Agents with access' or 'Denied requests'); this is a consistency refinement, not a defect. |
| U-6 | fixed | en.ts:882 and ru.ts:322 now say 'Fabric cannot prove…' / «Fabric не может доказать…»; accessWords.test.ts asserts 'Fabric cannot prove which program sent the request'. |
| U-7 | fixed | ru.ts:387 access.connect.sign_in_required = «{name} просит войти снова и уже открыл окно входа.» |
| U-8 | fixed | first.exec.note is removed from en.ts, ru.ts and docs/brand/strings.md. A grep over apps/ scripts/ docs/brand finds no remaining reference, and the renderer typecheck (tsc -p tsconfig.web.json) exits 0. |

New findings introduced by the fixes:

| ID | Severity | Finding |
|---|---|---|
| U-9 | non-blocking | The new ru 'deny stands' copy quotes buttons that do not exist: «Отклонить» (the button is «Отказать») and «очистите»/«Очистить» (the button is «Снять отказ»). It appears on the native prompt, the queue and SCR-76. |
| U-10 | non-blocking | No test asserts the U-1/U-2 fixes directly, although the ledger says they are tested; the strings registry tags the consent strings with the wrong scenario |

## Final recheck at the release candidate 469b4bc6 — 2026-10-05

The same reviewer rechecked the second-round fixes at `487caf3944e6155b7c314db2eaa1508ea2d5b19a` and confirmed that the final candidate `469b4bc6e957fe491c6563214a56a20c7fb1dd1d` differs from it only by `docs/workspace-receipt.json`, `workspace` (the scheduled workspace-publication pin), so the verdict carries over. Verdict: **approve**. Structured result: `recheck2.json`.

| Finding | Result | Evidence |
|---|---|---|
| U-9 | fixed | ru.ts access.denyStands = «“Отказать” будет отказывать в этом же запросе, пока вы не снимете отказ в «Настройки → Доступ агентов → Отклонённые запросы».», which matches access.deny 'Отказать' and the section title 'Отклонённые запросы'. ru.ts access.denials.note quotes «Снять отказ», which matches access.denials.clear. The en wording is aligned to the real button: 'clear the denial' / 'Clearing th |
| U-10 | fixed | There are now direct tests. ObligationActs.test.tsx 'I3 U-1/U-9' renders denyStands in en and ru on the queue row. 'I3 U-2' asserts that the board sentence starts with the allowedNotConnected text and contains 'allowed' exactly once. AgentAccessPanel.test.tsx asserts that en['access.denials.note'] is rendered. `vitest -t I3` gives 2 passed. docs/brand/strings.md retags access.denyStands, access.de |
| U-1 | fixed | Still holds. denyStands is unchanged in the prompt (accessWords.ts), the queue and the PendingCard; the denials note is rendered and now tested. |
| U-2 | fixed | Still holds, and it is now asserted by 'I3 U-2'. |
| U-3 | fixed | Still holds: the start.executor.auth.* strings are untouched by 19e5427a..487caf39. |
| U-4 | fixed | Still holds: Toolbar label / role=group is untouched; the 'I3 U-4' test passes. |
| U-5 | ruled-acceptable | CO-207 (open), which I accept as before; AgentAccessPanel.tsx is unchanged in this diff. |
| U-6 | fixed | Still holds: access.floor is unchanged ('Fabric cannot prove…'), and the accessWords test passes. |
| U-7 | fixed | Still holds: ru access.connect.sign_in_required is unchanged. |
| U-8 | fixed | Still holds: first.exec.note is still absent, and the renderer typecheck exits 0. |
