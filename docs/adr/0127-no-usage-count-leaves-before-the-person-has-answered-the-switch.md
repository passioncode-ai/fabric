# ADR-0127 — No usage count leaves before the person has answered the switch

**Status:** accepted · 2026-10-08 · operator decision (asked with three options: opt-in; on by default with a
first-run disclosure; leave as is — chose *on by default, but no event before the disclosure*) · finding A7-012
of the [0.3.2 audit](../reports/2026-10-05-release-032-audit/raw/2026-10-05-fix-list.md) (CO-215) ·
[fabric#12](https://github.com/passioncode-ai/fabric/issues/12) · backlog P-09 · roadmap RM-13.

## Context

Usage counts ([ANALYTICS.md](../ANALYTICS.md)) shipped in 0.3.2 on by default. The first start of a release
build sent `app_installed` and `app_started` before anything had told the person that counts are shared; the
switch and its note lived only in Settings. RM-13 says "private by default". The audit's options were opt-in,
which loses most install counts, or a disclosure the person sees before the first event.

## Decision

1. **Counts stay on by default, but nothing is queued or sent until the person has answered the switch once.**
   `apps/desktop/src/main/analytics.ts` reports `pending-disclosure` while the switch is on and no answer is
   recorded; `track`, `started` and `activeTick` do nothing in that state — `app_installed` included.
2. **Two places take the answer, and both show what is counted before it can be given:** the first-run notice
   (`UsageCountsNotice.tsx`, at the top of the window) and Settings → *Share usage counts* (SCR-52). Either one
   calls `analytics.setEnabled`, which writes the shared switch and records `disclosed_at`.
3. **The answer is kept per app**, as `disclosed_at` in this app's own `<userData>/analytics-state.json`, never in
   the shared `PassionCode/installation.json`: another PassionCode app's disclosure does not disclose Fabric.
4. **The start that waited is reported after the answer**, with the launch kind it had (`background` included),
   and today's `app_active` follows at once. Turning the switch off at the notice sends nothing, ever, and the
   notice does not return.
5. **An install from 0.3.2 sees the notice once** (its state has `installed_at` and no `disclosed_at`); it is not
   counted as a new install. A state file that cannot be read asks again rather than sending.
6. A background launch (`--background`, no window) sends nothing until the window opens and the person answers.

## Consequences

- Install counts start at the first answer, not at the first start; a person who never opens the window is never
  counted. That is the price of RM-13 and is accepted.
- The notice is a `Banner` (`role="alert"`) rather than a blocking dialog: Fabric stays usable, and nothing leaves
  meanwhile. Focus moves to *Continue* when it appears.
- Fabric Switchboard and Fabric Inbox read the same shared switch; whether each discloses before its own first
  event is that app's question: both send `app_installed` at first start today, filed as
  [fabric-switchboard#128](https://github.com/passioncode-ai/fabric-switchboard/issues/128) and
  [fabric-inbox#45](https://github.com/passioncode-ai/fabric-inbox/issues/45).

## Evidence

- `apps/desktop/test/analytics.test.mjs` — the four `A7-012:` tests (nothing before the answer; off at the notice;
  the 0.3.2 upgrade; an unreadable state file), 16/16 with the earlier twelve.
- `apps/desktop/src/renderer/src/UsageCountsNotice.test.tsx` (6) and `UsageCountsSetting.test.tsx` (5).

## Amendments

### Amendment 1 — 2026-10-09: an install that already sent counts is told so

The notice says "nothing has been sent yet" only when it is true: an install whose earlier version already queued
counts (its state has `installed_at`) is told that an earlier version may already have sent them
(`analytics.ts#sentBefore`, `UsageCountsNotice.tsx`; 0.3.3 verification DA-2 and, iteration 2, DA-4). The Evidence
line's notice-test count is 7 now (`npx vitest run src/renderer/src/UsageCountsNotice.test.tsx`, 2026-10-09);
the record above keeps the count it was written with.
