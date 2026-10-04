<sub>ssheleg skills — task-pipeline · ux-scenarios · copywriting · brand-voice · sheleg-design · evidence-docs</sub>

# Surface recovery — Fabric 0.3.1 verification iteration 2

Status: source candidate, 2026-10-04. The interrupted Claude worktree was preserved; its 19 modified files were copied into `agent/hub-0.3.1-v2-surface-resume` from base `1e8b2e20`. This packet implements the bounded UI/product-connect part; root owns combined verification, release rules and the canonical disposition ledger. Nothing here upgrades a live database, installs an app, tags or releases.

## Objective and execution order

Finish the existing hub verification findings, not redesign the product. Read [SCN-132/133](../ux/scenarios.md#scn-132-an-external-agent-asks-for-access-and-the-operator-decides), [FLW-75/76](../ux/flows.md#flw-75-an-external-agent-asks-for-access), [SCR-76](../ux/screens.md#scr-76-agent-access), and [ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md).

1. Recover the interrupted changes; watch targeted tests fail on the baseline, then pass on the recovered code.
2. Protect product consent from a second attempt and a changed predecessor; coordinate its `supersedes` payload with the core schema append guard.
3. Complete consent copy, keyboard focus, wrapping and scenario → flow → screen → prototype propagation.
4. Verify the real renderer in a disposable browser harness, commit/push this packet, then converge under the root agent's integration lease.

## Dispositions in this packet

| Finding | Source change | Check |
|---|---|---|
| UX-1 | Board keys acts by entry ref, reloads after access decisions, keeps a named receipt | BoardScreen two-request Allow/Deny regressions |
| UX-2 / DO-1 / UX-9 | Waiting includes Reconnect; current key remains live until success; pending buttons disabled; key-validity line only follows Disconnect or successful replacement | AgentAccessPanel reconnect/waiting/declined/failure tests; browser waiting case |
| UX-3 / UX-10 | Full long resources wrap on both consent surfaces; product action toolbar wraps | Component CSS assertions plus actual browser `scrollWidth <= clientWidth + 1` |
| UX-4 | Access facts use `lp-access-facts`, leaving `dl.lp-facts` as the existing grid | BoardScreen CSS regression plus browser computed `display:grid` |
| UX-5 | Localised reasons and machine details are separate lines, including thrown acts and unreadable overview | accessWords, AgentAccessPanel tests, `V2 UX-5` |
| UX-6 / DO-7 | `withdraw-failed` says the record exists but its revoked key will not work; disconnect and reconnect | accessWords, AgentAccessPanel, hub-products late-withdrawal test |
| UX-7 | Settings focuses its affected heading; Board focuses named completion; in-flight queue actions use aria-disabled and block duplicate submission | Panel/Board browser focus, `V2 UX-7` test |
| UX-8 | Accessible Allow name contains visible “Allow and connect” text and agent name | ObligationActs and accessWords tests |
| UX-11 / DO-14 | Native bold line is the consent question; prompt quotes localised; credential is Fabric's, not the product's; hub remediation names its cause | consent-presenter, accessWords, AgentAccessPanel; hub code/fact IPC |
| DO-6 / DO-8 | Forwarded-call string row added; binding credential uses one Russian term; hub terms pinned | brand/strings.md, brand/terminology.md, bilingual design gate |
| DO-9 / DO-10 / PL-12 | Existing handoffs corrected for secret-first, claim window and merged iteration-1 SHA | handoff links; `git show 2927a087` |
| DO-11 (registry part) | AgentRegistry region points to the registry design that describes it | check-regions; hubTools/SQL markers belong to root/core |
| ER-2 (connector part) | One attempt owns each product through begin and callback I/O; callback refuses a changed predecessor and appends `supersedes` | four `V2 ER-2` cases; database race check is core-owned |
| ER-9 | Invalid content type/JSON/object/known-state outcome immediately fails its single pending attempt | four `V2 ER-9` cases; Origin never cancels legitimate consent |

Root/core still own DO-2/3/4/5/10 map part/11 SQL and tool part/12/13, PL-1…14 register/runbook/release rules, ER-3/5 ingress and ER-4 vault process bounds. This file does not close those findings by inference.

## Checks actually run

Focused commands and sanitised output are in [surface-checks/](surface-checks/).

| Command | Result | Receipt |
|---|---|---|
| `node --experimental-strip-types --test-force-exit --test-name-pattern='V2 ER' apps/desktop/test/hub-products.test.mjs` before connector fix | 8 failed; executable behavioral assertions | [red-connect.log](surface-checks/red-connect.log) |
| Same command after connector fix | 8 passed | [green-connect.log](surface-checks/green-connect.log) |
| `node --experimental-strip-types --test-force-exit apps/desktop/test/hub-products.test.mjs` | 45 passed | [products.log](surface-checks/products.log) |
| `pnpm --filter @fabric/desktop exec vitest run src/renderer/src/AgentAccessPanel.test.tsx src/renderer/src/launch/ObligationActs.test.tsx -t 'V2 UX'` before residual fixes | 2 failed: raw exception in sentence and native-disabled queue control | [red-extra.log](surface-checks/red-extra.log) |
| Replay baseline renderer files with `vitest -t "allowing one request\|while a Reconnect waits\|a long mailbox\|fact grid"`; candidate restored in `finally` | 5 failed, 53 skipped on baseline; actual behavioral regressions | [red-inherited.log](surface-checks/red-inherited.log) |
| Four focused UI suites: AgentAccessPanel, BoardScreen, ObligationActs, accessWords | 72 passed | [green-ui.log](surface-checks/green-ui.log) |
| `node --experimental-strip-types apps/desktop/test/consent-presenter.test.mjs` | 10 passed | Presenter questions, default Deny, localisation, notification |
| `node --experimental-strip-types apps/desktop/test/hub-files.test.mjs` | 5 passed | Files, permissions, port selection |
| `pnpm --filter @fabric/desktop typecheck` | exit 0 | [typecheck.log](surface-checks/typecheck.log) |
| `python3 docs/ux/lint.py` | exit 0 | [ux-lint.log](surface-checks/ux-lint.log) |
| `python3 docs/brand/lint.py` | exit 0; 1461 warnings remain, mostly prototype literal registry coverage | [brand-lint.log](surface-checks/brand-lint.log) |
| `node scripts/check-design.mjs` | exit 0; bilingual and token ratchets hold | [design.log](surface-checks/design.log) |
| `node scripts/check-regions.mjs`; `bash scripts/check-docs.sh` | exit 0; 104 region markers; 519 checked files; 3 workspace-submodule links NOTCHECKED | [regions.log](surface-checks/regions.log), [docs.log](surface-checks/docs.log) |
| `node scripts/sync-product-ux.mjs`; `node scripts/build-product-report.mjs` | 133 scenarios / 76 flows / 76 screens; product report rebuilt | Generated model and report in this change |

## Browser validation

The harness mounts the real AgentAccessPanel and BoardScreen with production styles, translation provider and synthetic IPC, not Electron or a live product/DB. It is reproducible from a fresh checkout after `pnpm install --frozen-lockfile`:

```sh
pnpm --filter @fabric/desktop exec vite --config ../../test/visual/hub-surface/vite.config.mjs
# In a second terminal; set FABRIC_PLAYWRIGHT_MODULE and FABRIC_CHROMIUM if the browser provider requires them.
node test/visual/hub-surface/check.mjs
```

[check.mjs](../../test/visual/hub-surface/check.mjs) asserts long-resource containment on both consent surfaces, grid preservation, disabled pending Reconnect, and panel/Board focus after Allow. English/Russian × light/dark at 760×1000 passed; [browser.log](surface-checks/browser.log) is the functional receipt. [captures.json](surface-shots/captures.json) records base revision, SHA-256 source fingerprints, locale/theme/viewport/motion and capture time; its base revision is not a claim that the dirty source was already committed. [surface-shots/](surface-shots/) contains the captured real-renderer views. The surrounding “main content” and Workspace labels are synthetic harness chrome; acceptance concerns the actual consent components. Fonts are loaded from the app's font package; capture waits for fonts.

Repository fast/full tiers remain NOT_RUN in this surface packet: root owns the coordinated combined-source tier and guarded map refresh. Native Electron prompt visuals, VoiceOver, real product consent, installed-app startup and live database acceptance remain NOT_RUN. Browser focus is functional evidence; it is not screen-reader acceptance. The generated product report is target design, not runtime acceptance.

## Bounded external research

Sources fetched 2026-10-04; primary references and maintainer threads, used to validate the existing solution boundaries.

- [React: preserving/resetting state](https://react.dev/learn/preserving-and-resetting-state): keys identify component state. A different request ref must mount different consent acts; source supports UX-1 without an extra state synchroniser.
- [React maintainer discussion #18402](https://github.com/react/react/issues/18402): maintainer comments explain batching and the need to schedule imperative focus after state rendering. The fix focuses a ref in an effect, after its receipt/section exists; it does not disable React batching.
- [W3C label in name](https://www.w3.org/WAI/WCAG21/Understanding/label-in-name): accessible names must contain the visible label. UX-8 retains “Allow and connect Fabric Inbox” and appends the agent name.
- [W3C keyboard interface / disabled controls](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/): aria-disabled can retain discoverable focus. UX-7 keeps the acting button focusable while code independently refuses another submission, then deliberately focuses the result.
- [Electron dialog API](https://www.electronjs.org/docs/latest/api/dialog): macOS does not render the message-box title. The consent question therefore lives in `message`, with the notification statement kept separately.
- [MCP TS SDK issue #2489](https://github.com/modelcontextprotocol/typescript-sdk/issues/2489): malformed authority/userinfo can bypass hostname validators. Sent immediately to the root ingress task; exact raw authority including the hub's port is stronger than trusting parsed hostname alone. Root owns the regression tests.

## Integration prerequisites and exact next task

Root cherry-picks this packet together with core migration 80 and ingress/vault patches, resolves shared `access.ts`/hub-products tests without dropping either agent's assertions, then runs the combined focused checks followed by the coordinated full tier. Refresh the design map/projections under root ownership after all source and canonical ledger changes. Source tests here cannot prove database append CAS: the core disposable-DB tests must do that.

Canonical ledger dispositions must name the landed squash/commit, not only a deleted working branch. Update CHANGELOG, ADR amendments and plan under the integration lease; do not bump/tag/install until the version-specific verification gates and signing/release boundary are satisfied. One remaining copy edge for convergence: when Disconnect removes the predecessor during an in-flight Reconnect, the safe `409 connection_changed` currently maps to `already-connected`; its displayed reason can imply a live connection even when none remains. The refusal and record safety are covered; refine its problem code/copy without weakening CAS. Further communication-UI work is planned, not implemented by this packet.

A failed Origin callback is deliberately not attributed to the product: otherwise a web caller could cancel consent without its state.

## Skills actually used

`task-pipeline`: bounded recovery, scope/evidence/dependencies/resume. `ux-scenarios`: scenario/flow/screen propagation. `copywriting`: false key claims and bilingual diagnostics. `brand-voice`: one Russian binding-credential term and hub vocabulary. `sheleg-design`: retained existing tokens/grid, full resource wrapping and measured renderer fit. `evidence-docs`: red/green receipts and explicit coverage limits. Humanization: on, own pass; copy was checked against the peer-builder voice and preserved authority/state meanings. No new visual language or brand positioning was introduced.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**
