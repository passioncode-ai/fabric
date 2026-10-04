# AD02 native draft recovery — bounded root correction

This packet records actual CUA-driven Electron44 observations and a source correction. It does not close AD02, CO179, P08 or release qualification. The final combined renderer must be exercised again after visual integration. [Exact observations and pins](checks.json) distinguish the two executed source/build cuts; `integrationSourceHashes` adds documentation markers after execution and is not a fresh native run.

## Write authority

The Shell used its one-time read latch as permission to persist tabs. While that read was pending, an empty/partial set could overwrite the saved working set. When drafts were unreadable, missing-subject restoration also removed two saved references and wrongly called their subjects deleted. The actual before-fix native audit and settings are retained: [audit](corrupt-before-audit.jsonl), [settings](corrupt-before-settings.json).

`App.tsx` now has a separate `tabsRestored` state. Only a successful readable draft snapshot followed by working-set restoration grants persistence. Hydration and tab restoration share one initial read promise, including its failure; two separately timed reads can no longer disagree about the identities to restore. Unreadable storage preserves the saved tab references and reports its existing read error. Editable new input does not grant write authority. The current implementation requires a new process after repairing unreadable storage; it does not claim live recovery or multi-window serialization. SCN-031 and SCN-060 document that boundary without changing their draft/unobserved product verdicts.

## Native host

The old test host deadlocked before Electron readiness through top-level await. The bounded host now starts an async function after module evaluation and exits nonzero on bootstrap failure. It still uses only explicitly prepared temporary fixtures and the actual built renderer/preload plus actual local storage modules. No product-main registration, live database, provider, vault or operator directory is substituted.

Root drove the actual native application through CUA/AX: two restored drafts plus two new drafts survived an actual process restart; early input survived a delayed hydration snapshot; first-install input created its own durable local draft. Those first three observations precede the new tab-write guard and remain limited to their captured source pins. After the correction, corrupted storage preserved both original working-set references over two processes with zero tabs/draft saves; a separate damaged live JSON recovered the actual retained last-good copy and showed its recovery reason.

The immutable original failure and both native source cuts remain in this directory. Its synthetic names, paths and project identifiers are test data. No screenshot/DOM trace is relabelled as VoiceOver or production-provider acceptance.

## Regressions

[Before-fix log](tabs-red.log): two new working-set assertions fail, nine existing checks pass. [After-fix log](tabs-green.log): Onboarding and draft suites pass 19/19, no skips; [type checks](types.log) and [desktop build](build.log) exit0. The new assertions check unreadable-storage non-writes/no false deletion message and pending-restore non-writes followed by both preserved and new tabs.

The compiled contract consumer suite separately passes9/9 after a frozen offline install in the owning worktree; independent contract review remains scoped to its original source cut. This native packet does not broaden that verdict.

## Toolchain observation

Adding the already-transitive AJV dependencies explicitly for the contract consumer changed both project and installed lockfile bytes. `toolchain.lock.json` is repinned to those matching bytes, retaining the declared Node26.8.2/pnpm11.21.0/Electron44 profile. The system pnpm binary is12.4.1; verification uses the already installed11.21.0 executable through `FABRIC_PNPM_EXECUTABLE`, without installing or changing global configuration. [Measured verification](toolchain-verification.json) reports verified version/profile only, reproducibility not established and signing not checked.

## Exact next task

Import the strict CO179 native fixture and scoped launch-style correction; associate the default-agent hint with its native select, register scoped layout ownership and verify the assembled source. Freeze and push it before independent review. Repeat the combined actual native matrix with exact source/build pins, including restarts, corrupt/backup recovery, RU/EN, narrow/wide, keyboard and backend states. Complete the owned disposable full tier and candidate-bound independent reviews. No release tag, approval, installed upgrade, live Inbox or workspace publication is implied by this packet.

## Select hint and map boundary

The existing default-agent select now consumes the `Field` callback's description ID through `aria-describedby`. A new regression fails before that association and passes afterward. This is a scoped markup association, not a VoiceOver or whole-product WCAG verdict. The existing launch styling is scoped to the registered `onboarding-launch` owner; native controls and product copy retain their source behavior.

The actual map exceeded Node's default1MiB child-process output limit. The old gate caught that failed `git show` as a nonexistent baseline and permitted old-anchor removal and committed-iteration reuse. A>1MiB committed fixture reproduces both failures. The gate now reads up to16MiB and checks tree presence before treating any read failure as an initial map: an existing map read error refuses. All23 gate probes pass after the repair. The limit itself is not permission to discard a larger map.

[Original exact command output bytes](command-output-bytes.json) preserve every copied log before display-only terminal-newline normalization. Native audits and fixture markers are unchanged. The original startup error caused by a nonexistent vitest config is not counted as RED; the meaningful controls ran under the repository default config.
