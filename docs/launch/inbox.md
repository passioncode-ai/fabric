<sub>ssheleg skills — task-pipeline · agent-sync · brand-voice · copywriting · maintaining-fabric-workspace</sub>

# Fabric Inbox · product registration and handoff

Objective: make Fabric Inbox discoverable as the PassionCode.ai toolkit’s desktop email
product from Fabric’s repository and product information. The operator requested the
name, branding and cross-product links on 2026-09-26. This is a documentation iteration
under [ADR-0070](../adr/0070-passioncode-toolkit-and-product-design-system.md), not a new
architecture decision, runtime integration, release or readiness promotion.

## Source ledger and bounded packet

| Input | Immutable source / authoritative home | What it establishes |
|---|---|---|
| Fabric base | [019a23e](https://github.com/passioncode-ai/fabric/tree/019a23eaad9169e1e8b0751da8230f939ea76839) | Existing toolkit hierarchy and merged Project memory source; branch starts from this newer source, not older main |
| Product hierarchy | [ADR-0070](../adr/0070-passioncode-toolkit-and-product-design-system.md) | PassionCode.ai umbrella; Fabric CEO remains in development; standalone toolkit products do not automatically become kernel capabilities |
| Inbox implementation | [README at d577462](https://github.com/passioncode-ai/fabric-inbox/blob/d577462572d332c1e7c157504b7dffd9cde00bea/README.md) and [implementation](https://github.com/passioncode-ai/fabric-inbox/blob/d577462572d332c1e7c157504b7dffd9cde00bea/docs/desktop-mail/implementation.md) | macOS desktop host, Cloudflare and Gmail implementation, synthetic/local acceptance; live account and deployment limitations |
| Brand / public copy | [facts](../brand/facts.md), [terminology](../brand/terminology.md), [voice](../brand/voice.md), [channels](../brand/channels.md) | Existing peer-builder voice; README, docs/help and organization profile registers |
| Design source | [ADR-0070 source](https://github.com/passioncode-ai/passioncode-ai.github.io/tree/508e91793fcb79d6a59bd2265551dbc76f7a8f97/design-system) | Public-site repository owns the shared design system; this iteration changes no visual tokens |
| Delivery contract | [AGENTS.md](../../AGENTS.md#iteration-contract), [workspace publication](../architecture/report-workspace.md) | Living map, fast gate, source-first publication and separate receipt/pin commit |

Contradictions: the original Fabric checkout contains unrelated work. An isolated branch
preserves it and the newer Project memory/toolkit history. The Inbox repository is private;
its source link is labelled private and is excluded from the public organization profile.
The product address below is the coordinated website destination; this document alone does
not prove the page is deployed.

The delegated packet has one stage for source study and scoped authoring, one for local
verification and one for committed handoff. The parent task supplies the authorized brief;
no new UI or integration is designed here. Dependencies are the immutable Inbox source,
existing brand contracts and publication protocol above. One editor owns these files in
`codex/inbox-product-links`; remote source delivery is authorized, main integration and
workspace deployment are separate actions.

| Requirement | Scope / completion evidence |
|---|---|
| INBOX-LINK-01 | README and toolkit map link [product page](https://passioncode.ai/inbox/), [private source](https://github.com/passioncode-ai/fabric-inbox) and this status packet |
| INBOX-LINK-02 | Canonical facts/terms/voice, EN/RU product guides and canonical organization-profile copy identify Inbox as a development preview |
| INBOX-LINK-03 | Every surface preserves Fabric CEO development and Inbox’s unverified live-account/production boundary; no kernel capability is added |
| INBOX-LINK-04 | Living map, merge log, source checks and pushed branch provide a cold-agent handoff; publication remains a verified two-phase operation |

## Product status and links

**Fabric Inbox**, short form **Inbox**, is the desktop email product in the PassionCode.ai
toolkit. It is a **development preview**. The source above implements Cloudflare mail and
Gmail OAuth/polling, cached mail, drafts and send recovery, plus account-scoped rules.
Its evidence is local and synthetic. Real-account acceptance and production deployment
remain unverified; Outlook and general IMAP remain planned in the Inbox owner’s handoff.

- Product destination: [passioncode.ai/inbox](https://passioncode.ai/inbox/).
- Private owner: [passioncode-ai/fabric-inbox](https://github.com/passioncode-ai/fabric-inbox).
- Provider setup and exact next implementation task: [Inbox handoff at d577462](https://github.com/passioncode-ai/fabric-inbox/blob/d577462572d332c1e7c157504b7dffd9cde00bea/docs/desktop-mail/README.md).
- Family registration: [living map](../reports/map.html#toolkit-products), [this iteration](../reports/map.html#iteration-2026-09-26-inbox-links), [toolkit index](passioncode-toolkit.md).

## Checks actually run

- `python3 ~/.local/share/observatory-agent-updates/agent_updates.py check`: exit 0,
  no pending revision printed for this checkout.
- `agent_sync.py acquire FABRIC-INBOX-LINKS`: won the Git-backed lease, run
  `r-fabricinboxl`; original checkout edits preserved. Initial status reports another
  `HARNESS26` lease and 122 mirror pages drifting. Initial `reconcile` exited 1 with
  pre-existing missing ADR/CO as-built records; no new register id is introduced here.
  This documentation-only task leaves that historical debt unchanged and does not
  represent reconciliation as passing.
- `pnpm install --offline --frozen-lockfile --ignore-scripts`: exit 0, 497 packages
  reused, no network package downloads.
- `node scripts/check-design-map.mjs --refresh` followed by the check: exit 0,
  1692 source files, 289 unique anchors and 1008 link targets.
- `bash scripts/ci.sh fast`: exit 0, `fast tier green`; 121 desktop test files and
  1362 tests passed, 426 Markdown files inspected. Brand lint: 0 errors / 951 advisory
  warnings; UX lint: 0 errors / 1 advisory warning. Stack-backed full tests not run.
- Source `9e0a8de7507a13cea148940016a25930a90c267e` was pushed to the working
  branch and `git ls-remote` returned the same SHA. A fresh authenticated remote clone
  at that SHA resolved this handoff and its source links.
- `agent_sync.py record` recorded the implementation against ADR-0070.
- `git diff --check`: exit 0. New product prose received the default own humanization
  pass; specific product names, short statements and explicit status boundaries retained.
- Rendered map inspection: NOT VERIFIED. Visible IAB is unavailable to this subagent;
  opening the local file URL was rejected by browser security policy. No alternate
  browser route was attempted. Map source and anchor checks do not prove rendering.

The previous
[workspace receipt](../workspace-receipt.json) identifies the prior publication until a
new authorized publisher finishes the child release and parent pin. It cannot certify
this source iteration.

## Resume and publication boundary

Owning remote: `git@github.com:passioncode-ai/fabric.git`; branch
`codex/inbox-product-links`; entry: this file. The source commit is obtained from this
file’s Git history, and the pushed branch must resolve to the same full SHA.

**Exact next task:** review this source branch with the parent Inbox/website changes,
record their final immutable source receipts, then integrate under Fabric’s existing
policy. Workspace publication was authorized by the parent task after this source delivery. Inspect the clean child and run
`node scripts/workspace.mjs publish` only after the source commit; verify with
`node scripts/workspace.mjs check --require-child` and open the changed map anchor.
Do not silently advance the Switchboard or other product pins. Do not claim production
Inbox, real-provider OAuth acceptance or Fabric kernel integration from this registration.

The source iteration preserves the original checkout and its unrelated edits. Credentials,
`.env.agent-sync`, coordination runtime, dependencies and machine configuration are
local-only. Hosted suites are not dispatched; scheduled CI and deployment guards remain
separate from local documentation checks.

## Retrospective

The existing toolkit hierarchy already accommodates Inbox, so no historical ADR is
rewritten. Product membership and product acceptance now have separate statements and
receipts. The next review should confirm the name, standalone-product boundary and exact
public destination alongside the website change.

Правильно ли мы это запланировали, и правильно ли мы это делаем? The concrete choice is
registering Inbox as a standalone toolkit product while keeping live mail and kernel
integration outside this documentation claim.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded documentation scope and handoff
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — claimed shared documents
- [`brand-voice`](https://github.com/ssheleg/super-ux) — registered Inbox product facts
- [`copywriting`](https://github.com/ssheleg/super-ux) — English and Russian product descriptions
- `maintaining-fabric-workspace` — living map and publication boundary — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
