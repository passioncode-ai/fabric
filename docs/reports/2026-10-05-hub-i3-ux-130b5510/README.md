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
