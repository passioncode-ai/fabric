# Task brief — PassionCode.ai brand system

> Stage-0 intake artifact. Locked from the operator's selections on 2026-09-02;
> later aesthetic changes are new decisions, not silent edits to this brief.

- **Date:** 2026-09-02
- **Task (one line):** Complete and record the PassionCode.ai visual identity, icon system and tone of voice on top of the existing brand foundation.
- **UI verdict:** yes — the result governs public surfaces and the desktop product; no user behaviour changes are proposed.

## Knowledge sources

| Source | What it says about this task | Fresh? | Authority | Stale after this run? |
|---|---|---|---|---|
| `docs/adr/0018-passioncode-is-the-product-fabric-is-the-kernel.md` | PassionCode.ai is the user-facing brand; Fabric is the technical kernel. | accepted 2026-08-29 | decision | no |
| `docs/vision.md` | The operator is the accountable hero; the product assembles and supervises AI-native teams and makes work observable and evidenced. | amended 2026-08-29 | vision | review |
| `docs/ux/foundation.md` | P-01 is confirmed; P-02..P-04 are proposed. Figma is disabled; `paperclip` is the recorded style pack. | current at HEAD | UX foundation | **yes — record the final visual-system decision** |
| `docs/brand/voice.md` | `peer-builder`, compact and falsifiable, is the current draft voice; its named failure mode is insider shorthand. | calibrated 2026-08-30 | verbal identity | **yes** |
| `docs/brand/terminology.md` | Product and kernel names, preferred terms and banned AI-marketing language already exist. | current at HEAD | terminology | review |
| `docs/brand/facts.md` | Product name, working positioning, slogan and boundary claims have sourced canonical rows. | checked 2026-08-29 | public facts | review |
| `docs/brand/channels.md` | Landing and docs registers exist; product UI channel records are incomplete. | current at HEAD | channel register | **yes** |
| `apps/desktop/src/renderer/src/tokens.paperclip.css` | The shipped visual base is dark-first, neutral and hairline-led, with colour concentrated in a spectrum artwork rather than controls. | current at HEAD | implementation | review |
| `apps/desktop/src/renderer/src/tokens.app.css` | Components consume semantic aliases over the pack; design literals are mechanically guarded. | current at HEAD | implementation | review |
| `docs/evidence/backlog.md` → M82 | A written `docs/brand/ui.md` for tokens, components, states and spacing is already proposed because agents will extend the interface. | current at HEAD | work-list | **yes — close M82 if accepted** |
| `graphify-out/graph.json` | Brand sources reach the product guide, public facts, terminology and desktop strings; graph built at `ae68f33`, 23 commits behind HEAD. | stale by measured commit count | index | **yes — refresh at stage 9** |
| wiki context pack, generated 2026-09-02 | The brand pack is a checkable contract; style packs are versioned visual identities rather than values inferred from taste. No prior PassionCode.ai icon decision was found. | current query | contextual memory | no direct write; propose a stage-9 update |
| official OpenAI design guidelines, fetched 2026-09-02 | A contemporary AI identity can combine geometric precision with human warmth; its specific Blossom construction is protected and must not be imitated. | fetched 2026-09-02 | external reference, not product truth | no |

**Contradictions:** the recorded `paperclip` pack describes a marketing surface, while the desktop imports it as its product token base. Resolve by deciding whether to (a) keep it as an intentionally adapted shared identity, or (b) separate brand/public tokens from product/workbench tokens. Historical ADR/CO vs as-built gaps reported by `agent_sync.py reconcile` are outside this task unless a touched record depends on one of them.

## Documentation

| Question | Answer |
|---|---|
| **Regime** | governed — `docs/DOCMAP.md` in force |
| **Decision home** | `docs/adr/` (`ADR-NNNN`), append-only and id-reserved under lease |
| **Open questions** | `docs/evidence/specs/2026-08-16-software-fabric-carryover.md` (`CO-NNN`) |
| **Doc map** | `docs/DOCMAP.md`; brand facts, voice, terminology and channel homes already declared |
| **Gate** | `pnpm gates:docs`; brand-specific check is `python3 docs/brand/lint.py`; design literals are checked by `node scripts/check-design.mjs` |
| **Shared state** | `agent-sync` active; M82 held by run `r-90bf1cfd8`, git lease exclusive across machines |
| **Intent vs as-built** | reconciled 2026-09-02; unrelated historical ADR/CO omissions remain and are explicitly not interpreted as brand drift |

- **Knowledge wiki:** installed and queried; stage 9 may propose a durable note, but may not push another repository without separate authorization.
- **Retro, in force:** `docs/evidence/retro.md`; R-001..R-004 read. None currently fires: no ontology, privilege, credential, filesystem or transport claim is changing.
- **Code graph:** built but 23 commits behind HEAD; useful only as a pointer until stage-9 refresh.

## Scope

- **In scope:** visual principles; primary/secondary/semantic palette; typography and spacing intent; signature graphic motif; icon/app-mark family and usage rules; refined bilingual tone-of-voice guidance; channel registers; machine-checkable documentation; application of the approved icon to the local desktop product if the operator confirms that destination.
- **Out of scope:** changing product behaviour, pricing or legal promises; inventing public capability claims; a public website implementation; creating a Figma file (the project records text-only design); renaming PassionCode.ai or Fabric.

## Requirements

| ID | Requirement | How it's verified | Status |
|---|---|---|---|
| REQ-001 | One coherent visual identity separates brand expression from functional product state and records the palette, type, spacing, motion and usage rules. | `docs/brand/ui.md`; `node scripts/check-design.mjs`; design review against real desktop surfaces | partially met — written system and gate complete; application review remains with REQ-004 |
| REQ-002 | An original, legible icon family works at app-icon and favicon/avatar sizes without resembling a named competitor mark. The first production set is colour on transparent, coal and white canvases at 64/128/256/512/1024 px. | SVG source + generated-file check + rendered contact-sheet inspection at every exported size | met — 15 generated variants plus one master; all five sizes inspected on all three canvases |
| REQ-003 | The verbal identity is calibrated for PassionCode.ai in English and Russian, with owned phrases, bans, failure mode and per-surface deltas. | `docs/brand/voice.md`, `terminology.md`, `channels.md`, locales; `python3 docs/brand/lint.py` | open |
| REQ-004 | The approved identity is applied to the product surfaces explicitly chosen during the grill without leaking decorative colour into semantic status. | file diff + rendered desktop inspection in dark/light and reduced-motion modes | open |
| REQ-005 | Every changed claim and design decision has one canonical home and all project gates remain green. | `pnpm gates:docs`, `pnpm test`, `pnpm typecheck` or the exact available equivalents discovered at stage 4 | partially met — docs, design, typecheck and full test suite green for the favicon slice; final brand-system acceptance remains open |

## Users & context

- **Who / for what:** primarily P-01, an operator already accountable for many projects; secondarily future owners, members and provider builders. They need authority and evidence to feel visible, not magical.
- **Where it runs / constraints:** macOS Electron desktop app now; future public and hosted surfaces later. Dark-first with a complete light twin; accessibility regime EAA; English primary, Russian secondary.

## Decisions locked

| # | Decision | Chosen | Rationale |
|---|---|---|---|
| 1 | Product/kernel naming | PassionCode.ai is the brand; Fabric is the technical kernel | ADR-0018; not reopened by this task |
| 2 | Overall visual posture | modern AI project; dark, restrained field with one bright icon/signature object | operator, 2026-09-02; preserves operational calm while creating recall |
| 3 | Model | keep the current model for the run | operator, 2026-09-02 |
| 4 | Design destination | repository-first, text/assets; Figma remains disabled | existing foundation decision; no override requested |
| 5 | Colour semantics | brand chroma never carries success/warning/error meaning | prevents brand expression from falsifying operational state |
| 6 | Icon metaphor and geometry | symmetric upright passion-fruit cross-section: plum rind, magenta interior, five yellow chambers, five aubergine seeds and a filled yellow centre | operator selected the second detailed 3A variation on 2026-09-02; it supersedes the earlier eight-seed/open-aperture exploration |
| 7 | First production export matrix | SVG at 1024, 512, 256, 128 and 64 px in transparent, full-canvas coal and full-canvas white variants | operator requested the exact matrix on 2026-09-02; backgrounds are canvas fills, never shaped icon plates |

## Autonomy

| Stage | Question | Answer |
|---|---|---|
| run-wide | Model for this run | current model, confirmed by operator |
| run-wide Escalation | What must stop and ask? | price, legal/trademark posture, public promises, rename, publication/deploy and irreversible external acts |
| run-wide | Decide autonomously vs escalate | reversible repository drafts and technical checks are autonomous; aesthetic direction and final icon/voice validation are manual gates |
| run-wide Pacing | Run mode | `pipeline.json` absent, so loop mode is off; proceed between manual gates without idle check-ins |
| 0 Harvest | Sources beyond repo | Obsidian wiki and graph queried; official design references may inform but never decide; no external writes authorized |
| 0 Duplicates | Which copy ships | desktop imports `tokens.paperclip.css` then `tokens.app.css` in `apps/desktop/src/renderer/src/main.tsx`; Electron metadata reads `apps/desktop/electron-builder.yml` |
| 0 Fixtures | Persistent state | no database or fixture mutation is needed for docs/assets; exact product test reset remains to be discovered before implementation |
| 0 Source | Upstream freshness | `git rev-list --count HEAD..@{u}` = 0 before first edit |
| 0 Work-list | Task register | `docs/evidence/backlog.md`; M82 is the matched task; read with `rg -n 'M82' docs/evidence/backlog.md` |
| 0 Setup audit | Documentation entry audit | not needed: `docs/DOCMAP.md` is populated and its gates resolve |
| 0 Docs regime | Shared/governed rules | ADR home; M82 lease; gates named above; no ratchet-floor increase assumed |
| 1 Docs | External APIs/SDKs | none required for the brand system; font licensing and trademark checks stop and ask if introduced |
| 2 Decompose | One module or platform | one cross-surface brand-system module with visual and voice tracks converging at review |
| 2–3 Spec | UI/scenario verdict | visual/copy layer only; no behaviour change, so existing scenarios are inputs and no waiver is needed |
| 3 Design surface | Figma | text/assets only, as recorded in `docs/ux/foundation.md`; MCP availability does not override that decision |
| 3 Design file | Figma destination | not applicable |
| 4–5 Dev | Branch policy | work on `codex/brand-system`; `main` remains stable; follow existing commit conventions |
| 5 Integration | Landing | STOP AND ASK before merge; no parallel agents requested |
| 6 Tests | Green definition | discover exact scripts; at minimum brand lint, design gate, typecheck/build when product assets change |
| 7 Lint | Commands | `pnpm gates:docs` plus the relevant product scripts discovered at plan time |
| 7 Deploy | Target and authorization | no deploy in current scope; any publication/deploy requires a separate explicit go |
| 8 Post-deploy | Health/logs | not applicable unless scope expands to deploy |
| 9 Docs+wiki | Synchronization | update touched brand/UX/DOCMAP sources; refresh graph; propose wiki note without pushing externally |
| 10 Acceptance | Sign-off and deferrals | operator signs off visual and voice; defer by named backlog/CO row; `docs/evidence/retro.md` in force |

## Done-criteria

- The operator selects and approves one icon concept and one calibrated voice direction.
- A future agent can implement a new screen without inventing colour, type, spacing, icon or voice rules.
- Brand chroma and operational status colours have distinct documented roles.
- Dark and light uses, small-size icon uses and English/Russian voice deltas are shown rather than implied.
- All applicable gates pass, and anything not rendered or trademark-checked is stated beside the verdict.

## Open assumptions / risks

- The current `paperclip` adaptation may remain the implementation base, but that is not yet the approved brand system.
- The working positioning and slogan remain provisional copy per `docs/vision.md`; this run will not silently ratify them.
- Trademark clearance is not performed by visual similarity review; a final mark intended for public registration needs a separate professional search.
- The icon metaphor and symmetric construction are selected; exact vector geometry and the dark-background separation treatment remain to be approved. The mark must avoid food, wellness and tropical-lifestyle cues.
- The exact chromatic token values, wordmark treatment and final application destination remain stage-0 decisions.
