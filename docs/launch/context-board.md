# First release: context and conversation refinement

<sub>ssheleg skills — task-pipeline · super-ux · sheleg-design · copywriting · agent-sync · agent-harness · maintaining-fabric-workspace</sub>

2026-09-26 · target mockup; native delivery remains open. [Screen map](../reports/product.html#view-r0-map) · [Board](../reports/product.html#view-r0-board) · [architecture](agent-first-contract.md) · [ADR-0065](../adr/0065-conversation-led-work-and-context-bundles.md).

## Objective and accepted scope

Two operator requests: fix top/side project duplication, grouped folder selection, Board discussions and floating CEO; then make planning conversational while enforcing repetitive work through scripts/hooks/gates/skills/flows, safe logging and bounded model context. Scope is the first-release prototype, canonical UX and native implementation contract. No native processes, model calls or filesystem reads added.

The operator's instructions are the brief; no further intake decision was needed. Existing brand tokens and the R0 direction are retained. Vision fit: Project-owned work/history survives interchangeable agents. Delivery uses the existing working branch and authorized private publication. Baseline: [319d036](https://github.com/passioncode-ai/fabric/tree/319d0369f399dd9cf06075331aee8251d7d6a5e5).

## Requirement and evidence spine

| Requirement | Implementation / verification |
|---|---|
| CB-01 Projects only in top navigation | `scripts/product/controller.js` renderChrome; browser top tabs and section-only sidebar |
| CB-02 Primary + related sources in one Project | `firstReleaseAction` candidate-toggle/import/primary-source; source set tests, browser Data → Website + Notes → primary change |
| CB-03 Scoped context across levels | `firstReleaseContext`, task/run snapshot; tests for related-reference permissions, stable Project ID, primary swap, stale proposal and duplicate related folder |
| CB-04 Ticket conversation and outcome | `openTicket`, `outcomeCard`, outcome-apply/run; independent draft, apply-once, returned-result and rework tests |
| CB-05 Conversational plan | plan-chat opens a planning ticket; arbitrary intent and criteria refinement tests; no task form |
| CB-06 Floating identity | r0Persona/dock/chat; avatar variants, style, computed example counts; rendered desktop and 390 × 844 inspection |
| CB-07 Quiet product mode | first-release CSS; engineering metadata and simulations opt-in via review-mode |
| CB-08 Deterministic operation layer and safe logs | [native contract](agent-first-contract.md); fixture redaction tests for known formats, not native secret protection |

Sources: AGENTS.md, docs/AGENT_SYNC.md, docs/ux/vision.md, SCN-041/042/095 and FLW-25/55, screens SCR-27/40/41/44, brand voice/terminology/UI, docs/DOCMAP.md, previous first-release strategy and ADR-0063. Sources remain canonical; generated report is a projection.

## Changes and remaining limits

Multiple selected folders become one stable Project with main and related source references, purpose and access role. Main source may change; existing Run packet stays fixed. Each ticket has an isolated conversation and proposal. Acceptance records decision/task once; launch is separate; result returns to the same ticket. Rework creates a linked task without accepting the old result. Criteria refinements preserve initial intent. Planning enters conversation without a manual field. Profile retains name, colour avatar, visual variants, conversation style and counts from this page's fixture records. No fabricated real usage/level is claimed.

The fixed responses and parsing are deliberately a prototype. Native agents must use typed proposals/commands and existing canonical stores; string matching is not a production intent interpreter. Known-format fixture redaction does not identify every secret. All state is page-local and resets on reload. Native OS picker, durable logs, provider calls, budget enforcement, real voice and policy gates remain CO-168 / FR-A…G; [extensions](agent-first-contract.md#native-acceptance-packages) name dependencies and negative evidence. No second task store or nested Project ontology was introduced.

## Review and verification

Independent read-only review by context_board_review identified four P2 issues: Plan intent lost without keywords, negative review incorrectly accepted, criteria overwrote intent, and related-source deduplication failed after a primary switch. Follow-up review caught criteria refinement renaming a rework task; this sequence was also fixed. Each finding was corrected with a regression case in `scripts/test/first-release.test.mjs`.

- `node --test scripts/test/first-release.test.mjs scripts/test/folder-picker.test.mjs scripts/test/adoption-*.test.mjs scripts/test/product-*.test.mjs`: 226 passed, including primary-source collision and post-reload recovery regressions.
- `python3 docs/ux/lint.py`: 0 errors, 1 inherited U077 warning. Native Coverage remains unchanged.
- Browser: product mode without report footer/metadata; ticket → message → outcome → task → launch; root picker → two selected sources → main switch; profile overlay. This is fixture interaction, not a native acceptance receipt.
- Visual rubric: existing quiet neutral tokens; primary action visible; sources and checks disclosed; context kept above composer; stable floating panel; no duplicate project rail. One existing-direction critique pass, no alternate redesign fork. Screenshot judgment is not WCAG certification.
- New module omission in the generated bundle was caught in the browser and corrected in productModules; unit-only success did not suffice.

## Handoff and exact next task

Continue [FR-A…G](first-release-strategy.md#bounded-native-implementation-packets) with the [agent operation contract](agent-first-contract.md). First native task: bind persisted persona and Project/question conversation identity to existing producers, then bind FR-C multi-source picker and permission/revision contracts. Before FR-F execution, map every named command to the actual canonical handler and durable receipt; prove stale/duplicate/unknown handling. Do not replace this with regex-based production automation.

No member branch is pending from this iteration; the reviewer made no edits. Native gaps stay in CO-168 alongside prior CO-166/167. Publication receipt is `docs/workspace-receipt.json`; its source SHA names the reviewable iteration and its child SHA the published snapshot. A pushed branch is not merged product runtime.

Actual tools: task-pipeline — brief, negative checks and independent review; super-ux — canonical scenario/flow/screen propagation; sheleg-design — existing-token composition and state review; copywriting — direct UI labels, own humanization pass with no marketing claims; agent-sync — exclusive lease and ADR reservations; agent-stack:agent-harness — workflow/agent boundary and evidence requirements; maintaining-fabric-workspace — source-to-wiki publication.

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

Browser follow-up: arbitrary planning intent and criteria refinement preserved title; 390 px viewport measured 390 px document width; composer and outcome actions reachable; avatar/style/statistics visible. Viewport override reset after checks. Native screen-reader and OS-dialog acceptance not run.

Repository gate maintenance: version-only probes on 2026-09-26 returned Claude Code 2.1.283 and Codex CLI 0.157.1. `providerCapabilityMatrix.ts` pins these observed builds with every current capability still `unverified`; historical observations stay unchanged. No login, account, provider session or model probe ran. This fixes stale version metadata, not native readiness.

Final checks: `bash scripts/ci.sh fast` exited 0; stack-backed/full probes were not run. `git diff --check` passed. `node scripts/check-design-map.mjs` verified 1660 source files, 277 anchors and 951 link targets. Brand lint: 0 errors, 878 inherited/registry warnings. Coordination `reconcile` exited 1 for historical unmatched ADR/CO records; those are not declared implemented by this target iteration. This run recorded ADR-0065, keeps native CO-168 open and does not claim the old Notion mirror/backlog reconciled.
