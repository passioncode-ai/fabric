# Documentation map — Fabric

**Regime:** `governed` — established 2026-08-29 by run
`2026-08-29-high-level-vision`. This file records addresses and obligations; it
does not duplicate the rules or claims stored at those addresses.

## Registers

| Register | Home | ID scheme | Write rule |
|---|---|---|---|
| Decisions | [`docs/adr/`](adr/README.md) | `ADR-NNNN` | append-only; reserve the id and hold the project lease |
| Deferred/open work | [`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`](evidence/specs/2026-08-16-software-fabric-carryover.md) | `CO-NNN` | append-only; reserve the id and hold the project lease |
| Delivery state | [`docs/evidence/backlog.md`](evidence/backlog.md) | `M*`, `BL-*`, `CL-*` | mutable state register under the project lease |
| Direction | [general development plan](evidence/backlog.md#general-development-plan) | `P-*`, lanes | the lanes and their work by id ([ADR-0101](adr/0101-the-general-development-plan.md)); `scripts/check-plan-ids.mjs` |
| Verification | [`docs/evidence/verification.md`](evidence/verification.md) | run-specific `REQ` ids | append after the named check or human verification |

The decision home is the ADR set. `docs/DECISIONS.md` must not be introduced as a
second decision register.

## Toolkit launch · 2026-09-26

[PassionCode.ai toolkit handoff](launch/passioncode-toolkit.md) links the product hierarchy,
shared design-system source and member publication receipts. [ADR-0070](adr/0070-passioncode-toolkit-and-product-design-system.md)
keeps Fabric CEO development distinct from Switchboard availability; existing capability
registers remain authoritative. [Fabric Inbox](launch/inbox.md) records the desktop
email product’s membership, source evidence and preview boundary.

## Common backlog · 2026-10-01

[ADR-0098](adr/0098-workspace-federates-repository-backlogs.md) keeps local task ownership while
Workspace composes the [common view](https://wiki.passioncode.ai/backlog).
[`backlog-sources.json`](backlog-sources.json) declares the source registers; edits propagate through
the normal source commit → workspace snapshot → verified publication chain.

## Current entry

[Harness audit and R0 correction plan](audit/2026-09-26-harness/README.md): current native modules, adapter/skills ownership, delivery/stop gaps and H00…H09. Runtime readiness remains receipt-based.

[Launch overview](launch/README.md) is the first wiki entry: current focus → direct prototype/task → architecture and preserved ideas. `launch/overview.json` owns its structured content; the workspace host renders it. Delivery statuses still belong to the existing backlog.

[Текущий UX-аудит R0 и план](launch/operator-first.md): матрица возможностей, L0/L1/L2, голос, журнал и command contracts; прежние документы сохранены.

## Single sources of truth

The private [Fabric workspace](https://wiki.passioncode.ai)
publishes these homes as a versioned snapshot. [ADR-0048](adr/0048-fabric-workspace-is-a-versioned-private-publication.md)
and the [publication contract](architecture/report-workspace.md) define ownership: source
facts stay here; the `workspace` submodule owns the host and maintenance skill. The generated
`workspace-receipt.json` ties source commit, child commit, digest and Heroku release together.

| Fact | Canonical home | Other surfaces do this |
|---|---|---|
| Product purpose, falsifiable claims and arrival sequence | [`docs/vision.md`](vision.md) | link and summarize without creating a second vision |
| Public facts, positioning and slogan | [`docs/brand/facts.md`](brand/facts.md) | public surfaces render these facts in their channel register; they do not invent claims |
| Product wording and exact names | [`docs/brand/terminology.md`](brand/terminology.md) | use the preferred term and link to `CONTEXT.md` for the full domain definition |
| Public voice and surface register | [`docs/brand/voice.md`](brand/voice.md) and [`channels.md`](brand/channels.md) | organization profile, guides and future public pages derive from the pack |
| Product vision and alignment test | [`docs/ux/vision.md`](ux/vision.md) | the anti-vision and alignment test constrain future user-facing capabilities; `AGENTS.md` carries the active rule |
| Visual identity and brand/product colour boundary | [`docs/brand/ui.md`](brand/ui.md) | product tokens and brand assets implement this intent without creating a second rule set |
| Domain terms and cardinalities | [`CONTEXT.md`](../CONTEXT.md) | use the same terms; link when the distinction matters |
| Settled architecture decisions | [`docs/adr/`](adr/README.md) | cite the ADR and mark superseded claims in place |
| Launch architecture and retained priority overlay | [`2026-09-15 launch`](audit/2026-09-15-launch/README.md), [`launch.json`](audit/2026-09-15-launch/launch.json), [`inventory.json`](audit/2026-09-15-launch/inventory.json) | proposed R0/R1 sequence and preserved source rows; delivery facts remain in backlog; canonical UX/model propagation waits on D02 |
| Current engineering target package | [`system-contract.md`](architecture/system-contract.md), [`engineering-specs.json`](architecture/engineering-specs.json), [`system-model.json`](architecture/system-model.json) | common contracts, per-task decisions and machine graph; proposed ADRs remain proposed; generated [`system.html`](reports/system.html) is a projection |
| Visual route model and implementation handoff | [`product-model.json`](ux/product-model.json), [`product-fixtures.json`](ux/product-fixtures.json) | canonical UX registries own behaviour; generated [`product.html`](reports/product.html) owns no separate truth; named demo transitions are distinct from runtime coverage |
| Mockup completeness and acceptance | [`mockup-contract.md`](ux/mockup-contract.md), [dated matrix](evidence/plans/2026-09-07-mockup-completeness/resolution-matrix.json) | generated [`completeness.html`](reports/completeness.html) links source → gap → target → evidence; prototype acceptance never closes runtime delivery |
| Current architectural design | [`docs/architecture/`](architecture/) | state status (`canonical`, `design`, or `proposal`) and cite governing ADRs |
| User-visible behaviour | [`docs/ux/scenarios.md`](ux/scenarios.md) | flows and screens trace to scenario ids |
| Runtime/provider compatibility | [`fabric-agent-contract`](https://github.com/passioncode-ai/fabric-agent-contract) | pin a released contract revision; do not restate wire contracts here |
| Project delivery state | [`docs/evidence/backlog.md`](evidence/backlog.md) | summaries link to rows instead of copying status |
| Design map and iteration review | [`docs/reports/map.html`](reports/map.html#changelog) | derived from scenario, screen, architecture and delivery sources; update and link exact anchors each iteration |
| Audit evidence snapshots | [`docs/audit/README.md`](audit/README.md) | index dated reports by source revision; implementation status belongs to the backlog |
| Provider accounts proposal | [`docs/architecture/provider-accounts.md`](architecture/provider-accounts.md) | M199 account/runtime ownership, native conversation continuity and proposed ADR-0051; [packets and handoff](evidence/plans/2026-09-09-provider-accounts.md) |
| Provider accounts execution tasks | [`docs/evidence/plans/2026-09-09-provider-accounts-backlog.md`](evidence/plans/2026-09-09-provider-accounts-backlog.md) | current M199 child cards, cswap auto sources, requirement extension and handoff |
| Agent iteration contract | [`AGENTS.md`](../AGENTS.md#iteration-contract) | `CLAUDE.md` and other agent entries link to it, without duplicating the policy |

## Propagation matrix

| Change type | Update in the same change | Checked by |
|---|---|---|
| Any meaningful project iteration | living design map, top changelog entry, precise final review anchors and short retro, per `AGENTS.md` | `node scripts/check-design-map.mjs`; content review remains required |
| New document or rule | `README.md` navigation when reader-facing; this map when it creates a new canonical class; agent rules when it changes agent work | `bash scripts/check-docs.sh` for links and required homes; review for relevance because a script cannot decide readership |
| New or changed ADR | ADR index; every path in `Consequences / affects`; glossary/vision/architecture/schema/UX surfaces named by R-001 when hierarchy, ownership or cardinality changes | `bash scripts/check-docs.sh`; R-001 propagation review because semantic equivalence is not mechanical |
| Vision or scope change | `docs/vision.md`; governing ADR; backlog/carry-over; README status; affected architecture and UX | review — scope and contradiction resolution are judgments |
| Public positioning, slogan or product name | `docs/brand/facts.md`, `terminology.md`, `voice.md`; README; organization profile; guides; current architecture summary | `bash scripts/check-narrative.sh` plus `python3 docs/brand/lint.py` |
| Public capability claim | `docs/brand/facts.md` first, with a source and review date; then the affected public surface | brand lint plus evidence review |
| Domain entity, relationship or cardinality | `CONTEXT.md`; governing ADR; schemas/examples; architecture; affected UX scenarios | `python3 scripts/check-project-schemas.py` plus R-001 propagation review |
| User-facing behaviour | `docs/ux/scenarios.md`, then affected flows and screens | UX scenario trace review; local UX linter when installed |
| Agent/provider compatibility | normative contract repository first; pinned references and affected architecture here | contract conformance suite plus link check |
| Delivery status | backlog row and, when shipped, verification row | review against commit/test evidence; status is not inferred from prose |

## Gates and ratchets

| Gate | Command | Scope | Blocking |
|---|---|---|---|
| Engineering design integrity | `node scripts/check-system-model.mjs` and `node scripts/build-system-map.mjs --check` | task/requirement coverage, dependency DAG, cycle guards, pinned sources and deterministic HTML; no runtime correctness claim | yes |
| Workspace publication | `node scripts/workspace.mjs check --require-child` | source age across all non-publication paths, content digest, parent gitlink, child manifest and bytes; combined local check; source and host CI run separately | yes for publication |
| Design map freshness and links | `node scripts/check-design-map.mjs` | source fingerprint, unique anchors, local link targets and precise top-entry review links; does not prove semantic completeness | yes |
| Documentation structure | `bash scripts/check-docs.sh` | decision-home uniqueness, ADR ids, required canonical homes, local Markdown links | yes |
| Public narrative | `bash scripts/check-narrative.sh` | exact positioning/slogan, required public surfaces, retired names and public-content boundary | yes |
| Brand contract | `python3 docs/brand/lint.py` | pack integrity, terminology, public claims, register and machine-writing markers | yes |
| Project schemas | `python3 scripts/check-project-schemas.py` | schema compilation and project boundary fixtures | yes when schemas change |

The documentation gate does not prove prose correctness, external URLs, protocol
currency, or that an ADR was propagated semantically. Those remain explicit review
items. Propagation is ratcheted from the next decision after ADR-0017: historical
residue is reported, while every new decision must satisfy the matrix.

## Navigation

The human entry point is [`README.md`](../README.md). New readers continue through the
[product guide](guides/passioncode-overview.md); the public organization introduction
is [`docs/public/organization-profile.md`](public/organization-profile.md). The brand
pack is [`docs/brand/`](brand/), the domain vocabulary is [`CONTEXT.md`](../CONTEXT.md),
the product thesis is [`docs/vision.md`](vision.md), and accepted decisions are indexed
by [`docs/adr/README.md`](adr/README.md).

## Персональный Fabric и пульс · 2026-09-15

[Приоритетный вход](launch/README.md) → [текущий аудит и план](launch/operator-first.md) → [общение и управление](architecture/operator-interaction.md). [Макеты персонального Fabric](launch/pulse.md), [архитектура P0–P6](architecture/personal-fabric-pulse.md) и [ADR-0059](adr/0059-personal-fabric-and-evidence-backed-pulse.md) сохранены как основание. Данные и команды — источники Fabric; workspace публикует снимок.
