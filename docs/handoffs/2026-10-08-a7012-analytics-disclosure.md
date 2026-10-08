# Handoff — A7-012: no usage count leaves before the first-run disclosure

**Objective.** Close privacy finding A7-012 (CO-215, fabric#12, backlog P-09): analytics is on by default and
`app_installed` leaves at first start before anything is disclosed, against RM-13 "private by default".

**Operator decision, 2026-10-08** (asked in the contract session, chosen from three options): *on by default,
but no event is queued or sent until a first-run disclosure with the switch has been shown*; record it in an ADR.
Rejected: opt-in (loses install counts), leaving it as is.

Also decided the same day: hosted CI keeps the 21 private-parser tests as `NOT_RUN` (no CI credential for
fabric-workspace; deploy keys are disabled for the organization) — add this to CO-224's row.

## Design (built 2026-10-08 in the same branch — see ADR-0127)

- `apps/desktop/src/main/analytics.ts`: `AnalyticsState.disclosed_at?: string` in the app-local
  `<userData>/analytics-state.json` — per app, so Switchboard's disclosure does not disclose Fabric.
  `track`, `started` and `activeTick` do nothing while `disclosed_at` is absent; `availability()` gains
  `'pending-disclosure'` (key present, file readable, switch on, not disclosed). New `acknowledge(enabled)`:
  writes the switch (if changed) and `disclosed_at`, then, when on, emits `app_installed` (if `installed_at` is
  absent) and `app_started`. Users upgrading from 0.3.2 also see it once (no `disclosed_at`).
- Background launch (`--background`, no window) sends nothing until the window opens and the person acknowledges.
- IPC: `IPC.analyticsAcknowledge` (`analytics:acknowledge`, boolean), `FabricApi.analytics.acknowledge`,
  preload entry; `AnalyticsStatus.availability` gets `'pending-disclosure'`.
- Renderer: a `UsageCountsNotice` (role="dialog", labelled, focus moved in, Escape = acknowledge with the switch
  as shown) mounted at the top of `App.tsx` (beside the error `Banner`, line ~676) when status is
  `pending-disclosure`; the same checkbox and note as `UsageCountsSetting`, default on, one button. EN/RU strings
  in `i18n/en.ts` / `ru.ts` (read the brand pack before writing them). Settings shows `pending-disclosure` as on.
- Tests (`apps/desktop/test/analytics.test.mjs`): nothing reaches the synthetic server before `acknowledge`;
  acknowledge(true) sends `app_installed` + `app_started` once; acknowledge(false) writes `analytics:false` and
  sends nothing; restart after acknowledge sends without a second notice; upgrade state (`installed_at`, no
  `disclosed_at`) is pending. Renderer test beside `UsageCountsSetting.test.tsx`.
- Docs in the same change: new ADR (reserve with `agent_sync.py reserve ADR`), `docs/ANALYTICS.md` (event table:
  "after the disclosure"), SCN-134 step 1 (replace the 2026-10-06 amendment) and a scenario for the notice, the
  fix-list row A7-012 and CO-215 disposition, P-09, map entry, MERGES; then `bash scripts/ci.sh fast`, PR,
  `gh pr merge --rebase`, `node scripts/workspace.mjs publish`. Check Fabric Switchboard and Inbox for the same
  gap and file issues there if they send before a disclosure.

**Next task:** implement `analytics.ts` + its tests first (TDD), then IPC/preload/types, then the notice.

## Also open: repin consumers to contract `623bf61` (PR #22 merged 2026-10-08)

fabric-agent-contract PR #22 (DEC-0030/0031, activity telemetry and devices; OQ-0009 closed, OQ-0010
narrowed to attestation; FAC-SEM-046, next free FAC-SEM-047; consumer adoption is contract backlog CT-04)
merged as `623bf61358c339cb10297807b3f024b5d9f1f327`. Pins found on `main`:
- **fabric**: `apps/desktop/test/fixtures/fabric-agent-contract/` + `contract-consumer-fixtures.mjs`
  `CURRENT_COMMIT` (now `be71bc93`) — re-pin with `scripts/repin-agent-contract.mjs`, then
  `node --test apps/desktop/test/contract-consumer.test.mjs`, map/MERGES/CO-223 note, `ci.sh fast`, PR.
- **fabric-agent-adapter**: grep the current pin outside `test/fixtures/contract-revisions/legacy/`
  (legacy fixtures stay pinned on purpose); adapter `npm test` (validate.py pin check G-11).
- dashboards, switchboard, inbox: no contract commit pin on `main` (checked 2026-10-08).

## Status, 2026-10-08 (later)

- **Built** on this branch: `analytics.ts` (`pending-disclosure`, `disclosed_at`, the held start), the IPC releasing
  today's `app_active` after the answer, `UsageCountsNotice.tsx` mounted in `App.tsx`, Settings showing
  `pending-disclosure` as on, EN/RU strings, ADR-0127, ANALYTICS.md, SCN-134, CO-215 and P-09 notes. Tests:
  `analytics.test.mjs` 16/16, `UsageCountsNotice.test.tsx` 6/6, `UsageCountsSetting.test.tsx` 5/5. Sibling apps:
  fabric-switchboard#128, fabric-inbox#45.
- **Contract repin** to `623bf61`: fabric PR #23; adapter PR #43 merged as `0f5df40c`, released by tag `v0.8.1`.
- **Still open on fabric#12:** the production receipt (one debug event stored; the same install_id from Switchboard
  and Fabric on one machine) — it needs a release build, so it follows the next Fabric release.
