<sub>ssheleg skills — agent-sync · brand-voice · copywriting · maintaining-fabric-workspace</sub>

# PassionCode.ai toolkit launch · 2026-09-26

Objective: present PassionCode.ai as the umbrella toolkit for AI-native teams, Fabric as
the CEO AI agent in development and Switchboard as the first public-download product.
Carry the public site’s design language into one shared system, with a gold S on a dark
Switchboard tile. Operator request, 2026-09-26; decision [ADR-0070](../adr/0070-passioncode-toolkit-and-product-design-system.md).

## Ownership and source index

**Family update:** [Fabric Inbox status and handoff](inbox.md) registers the desktop
email development preview, its private source and public product address under
ADR-0070. Product membership adds no Fabric runtime or kernel integration.


| Owner | Remote | Branch / source revision | Status and entry |
|---|---|---|---|
| Fabric canonical facts and internal design guidance | `git@github.com:passioncode-ai/fabric.git` | `codex/passioncode-toolkit-launch`; narrative implementation `3a6ac07b7e2288b1d16602696d0dee0f850a42f7` (base `b64b49070ccb40fd698e7fa486114ece0f938cd9`) | This source iteration; [facts](../brand/facts.md), [visual guidance](../brand/ui.md), [map](../reports/map.html#iteration-2026-09-26-toolkit-launch) |
| Public site / shared design system | `git@github.com:passioncode-ai/passioncode-ai.github.io.git` | `main` launch source `527b5ba41c4aad77512572ec5117beb27ba7fb08`; initial design source `508e91793fcb79d6a59bd2265551dbc76f7a8f97` | [Pinned design source](https://github.com/passioncode-ai/passioncode-ai.github.io/tree/508e91793fcb79d6a59bd2265551dbc76f7a8f97/design-system); deployed site and design reference verified in the browser; [production receipt](https://github.com/passioncode-ai/passioncode-ai.github.io/blob/a29392c6702d468c698c58dbef994603c5d28596/docs/LAUNCH_RECEIPT.json) |
| Fabric Switchboard | `git@github.com:passioncode-ai/fabric-switchboard.git` | Binary source/tag `9e20a49ad7ef917068c266eff4283180209965dc`; release docs `b6cde090a62a7a96a2a612ada875a9684e1e3b86`; public verification `a1ff940ee8f76b7b521a22120beb2a1c3f6c649f` | Public MIT prerelease [v0.3.1-beta.1](https://github.com/passioncode-ai/fabric-switchboard/releases/tag/v0.3.1-beta.1); [installation guide](https://github.com/passioncode-ai/fabric-switchboard/blob/b6cde090a62a7a96a2a612ada875a9684e1e3b86/docs/INSTALL.md) |
| Organization profile | `git@github.com:passioncode-ai/.github.git` | profile source `248df9b197056faea573bbd1c7ecf47e03126f7f`; `main` receipt `fc16bfd6ff2b260181d77d7be5ce55b9d2e03202` (remote ref verified) | Public profile; [canonical copy](../public/organization-profile.md) |
| Private Fabric workspace | `git@github.com:passioncode-ai/fabric-workspace.git` | `main`; exact source/workspace SHAs and release are in the generated [publication receipt](../workspace-receipt.json) | [Private host](https://wiki.passioncode.ai); `node scripts/workspace.mjs check --require-child` verifies identity. A source branch is not whole-repository integration. |

Pending member branches are not production submodule updates. No parent Switchboard pin
is advanced by this source iteration. The separate workspace submodule remains at its
previous publication until the reviewed source is committed and the authorized publisher
completes its receipt chain. The exact source SHA of this document’s iteration will be
recorded as `source_commit` in the generated [publication receipt](../workspace-receipt.json),
with the matching workspace SHA and release; before publication, that receipt still
identifies the previous snapshot and must not certify this iteration.

## Completed source work

- Canonical toolkit positioning propagated through README, CONTEXT, vision, architecture,
  brand facts/terms/voice, public profile source and English/Russian guides.
- ADR-0070 preserves the historical decisions and technical kernel boundary while
  recording the new product hierarchy and common design source.
- Shared design guidance cites the immutable public-site source, preserves semantic
  states and explicitly separates adoption direction from existing Fabric runtime CSS.
- Narrative gate requires the umbrella positioning, Switchboard and Fabric’s development
  qualifier across all seven canonical surfaces. Map anchors and merge-log entry are in
  this source iteration. No Fabric user flow, runtime or generated mockup changed.

## Release evidence boundary

The repository is PUBLIC and the prerelease is published:
[v0.3.1-beta.1](https://github.com/passioncode-ai/fabric-switchboard/releases/tag/v0.3.1-beta.1),
with two ZIP archives, two JSON receipts and checksums. The binary tag resolves to
`9e20a49ad7ef917068c266eff4283180209965dc`; installation documentation was first committed at
`b6cde090a62a7a96a2a612ada875a9684e1e3b86`; final public verification is at
`a1ff940ee8f76b7b521a22120beb2a1c3f6c649f`. Artifacts are macOS universal, Developer ID
signed but unnotarized, and Windows x64, unsigned and cross-built. Native Windows
execution and live-provider acceptance remain unverified. Anonymous downloads were verified on 2026-09-26 at 16:36 UTC in the
[publication receipt](https://github.com/passioncode-ai/fabric-switchboard/blob/a1ff940ee8f76b7b521a22120beb2a1c3f6c649f/docs/evidence/publication-0.3.1.json):

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| macOS universal ZIP | 17052475 | `5bdece37fb9965019d2a1f84af45075b571b7979dca8b8c475495ff4b50bed25` |
| Windows x64 ZIP | 6232566 | `f3fb96619e2722bbee954eb5758800c790df6dee6e2cd4763372b1a2a9df4665` |

These are download-integrity receipts. They do not establish provider operation or
native Windows acceptance. The [release evidence](https://github.com/passioncode-ai/fabric-switchboard/blob/a1ff940ee8f76b7b521a22120beb2a1c3f6c649f/docs/evidence/release-0.3.1.md)
retains the source/build/signing boundaries and anonymous source-checkout results.

## Website publication

Deployed source: `527b5ba41c4aad77512572ec5117beb27ba7fb08` on 2026-09-26 at
16:42:21 UTC through the existing authenticated Cloudflare connector. Worker version
`94c85821-25dd-49b8-8b76-23bfcee072bc`; deployment
`82bcb8c0-11ad-44fd-a5cb-d85e91b2b551`. The root task verified the new product page in
the live browser. HTTP receipt checked at 16:43 UTC records 200 for the homepage, product page, design
system and token CSS; both OS download routes return 302 to the published ZIPs with
`Cache-Control: no-store`. The www route returns 301. These are website/download routing
checks, separate from native application acceptance.
The site publication does not deploy the Fabric runtime.

## Checks and coordination

- `python3 ~/.local/share/observatory-agent-updates/agent_updates.py check`: exit 0,
  no pending policy printed for this checkout; no acknowledgement revision invented.
- `agent_sync.py acquire PC-LAUNCH-20260926`: won, Git remote compare-and-swap lease;
  guard claims acquired for all guarded edits. This Codex session is **ungated** by
  hooks; guards were explicit. Reserved ADR-0070 and CO-169; canonical register formatting retained.
- Initial `agent_sync.py reconcile`: exit 1, pre-existing ADR/CO records missing
  as-built entries. Journal records why historical debt stays unchanged; it is not
  presented as passing reconciliation. Initial status also reports 122 mirror pages
  drifting and a separate MEMORY26 lease; this iteration does not edit that task.
- `pnpm install --offline --frozen-lockfile --ignore-scripts`: exit 0, 497 packages reused.
- `bash scripts/check-docs.sh`: exit 0, 420 Markdown files; brand 0 errors / 927
  advisory warnings, UX 0 errors / 1 advisory warning.
- `node scripts/check-registers.mjs`: exit 0, 169 carry-over rows / 197 milestones /
  1549 verification rows, 139 open carry-overs. The backlog count change required a
  bounded SRC-02 source re-review and regeneration of completeness.html and plan.json;
  product.html and runtime status stayed unchanged.
- `node scripts/check-design-map.mjs`: exit 0 before final member-index update;
  1679 source files / 284 anchors. Final stamp is refreshed with the complete source.
- Fast checks reached 121 passing desktop test files / 1362 tests. The last regression
  caught the stale unexecuted pipeline reservation; re-reserved ADR-0071 through
  `pipeline-reservation-after-toolkit-launch-20260926` under that document’s collision
  rule, without executing a pipeline ADR or migration. Final `bash scripts/ci.sh fast`
  then exited 0 with “fast tier green.” Stack-backed full checks did not run.
- Humanization: on, own pass; new public prose reviewed for concrete product names,
  plain language and explicit development/release qualifiers. No capability added by wording.

## Remaining work and exact next task

[CO-169](../evidence/specs/2026-08-16-software-fabric-carryover.md) owns Fabric runtime
adoption: map current semantic aliases to shared tokens, align About/i18n, then verify
keyboard focus, reduced motion and empty/loading/unavailable/error/success states.
CO-166/167/168 retain their native capability boundaries. No blanket readiness upgrade.

The exact next task is to integrate `codex/passioncode-toolkit-launch` with the original
checkout’s concurrent MEMORY26 work. Preserve ADR-0069/0070, both map histories, CO-169
and the unexecuted pipeline reservation; reconcile register counters and re-run the
source/model/map gates before publishing the integrated snapshot. Do not reset or stash
the other session’s work. Then implement the bounded CO-169 token/state mapping before
any claim that the Fabric runtime uses the shared system.

The initial narrative source was verified from a fresh clone: exact SHA `3a6ac07`, map
stamp and all 420 Markdown links passed after initializing the pinned workspace child.
The finalization is published as an isolated branch snapshot, not as completed parent
integration. The authorized publisher uses `node scripts/workspace.mjs publish`, then
`node scripts/workspace.mjs check --require-child`; generated child content is never
hand-edited. Exact published source/child/release identity belongs to the receipt above.

Local-only boundary: credentials, `.env.agent-sync`, agent state, node_modules and
machine configuration do not enter source commits. No hosted CI suite is dispatched;
local fast checks are recorded honestly and nightly CI remains separate.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`agent-sync`](https://github.com/ssheleg/agent-sync) — claimed guarded Fabric docs and reserved ADR/CO
- [`brand-voice`](https://github.com/ssheleg/super-ux) — updated toolkit facts and terminology
- [`copywriting`](https://github.com/ssheleg/super-ux) — updated English and Russian introductions
- `maintaining-fabric-workspace` — kept canonical sources and reviewed living map — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
