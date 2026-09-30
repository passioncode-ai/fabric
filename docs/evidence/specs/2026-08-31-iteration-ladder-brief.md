# Task brief — iteration-ladder

**Run:** `2026-08-31-iteration-ladder` · branch `feat/iteration-ladder` · lease `ITERATION-LADDER`
**Model:** Fable 5, confirmed by the operator via `/model`; no per-stage overrides.
**Task:** design the iteration ladder for PassionCode.ai/Fabric and the detailed
architecture of iteration 1, file the five decisions the slice-1 architecture stands on,
and propagate. The end product stays as decided (ADR-0016/0018, horizons 0–5); only the
blocks that ship next are detailed, per the operator's progressive-detail rule.

## Decisions taken at the grill (operator, 2026-08-30/31)

| # | Decision |
|---|---|
| G1 | End-product picture confirmed as documented: platform of estates, horizons 0–5 (`passioncode-platform.md` §15) |
| G2 | Iteration 1 = the operator's working version (8-agent roster ≈ the §9 worked scenario); it ships as touchable slices, not one release |
| G3 | Slice order (operator's wording): terminal + projects → project memory → agents + cron runs + chains → the roster in loops |
| G4 | First projects: **Fabric itself** (dogfood, per ADR-0015 bootstrap) + **the flagship's SEO agent** (another project's repository, already the worked example in `work-producing-agents.md`) |
| G5 | Publisher in iteration 1: drafts + per-post approval (one-shot grant). The floor is untouched; standing channel grant stays CO-036 |
| G6 | v1 surface: **macOS desktop application** with the Claude Code terminal hosted inside from slice 1 (fulfils ADR-0008 §3; reverses the run's earlier web-dashboard recommendation — operator's word outranks) |
| G7 | Control plane v1: local Supabase; service key confined to the app's main process |
| G8 | Run pacing: autonomous with two manual gates (brief, stage-2 design) — both passed |
| G9 | Merge authorization: as the previous 14 runs — feature branch → four blocking gates green → merge to main + MERGES record |
| G10 | Design surface: text-only (recorded in `docs/ux/foundation.md` → Design tooling; not re-asked) |
| G11 | PM is a role binding: any admitted provider can hold it; v1 admitted set = {claude-code local_harness} until a second runner passes conformance (CO-074) |

## Source ledger (phase 1)

| Source | What it said about this task | Freshness |
|---|---|---|
| `CONTEXT.md`, ADR-0001…0026 + index | ontology, floor, decision chain; read in full during the 2026-08-30 audit | @446987a |
| `docs/architecture/*` (10 docs) | horizons §15; §9 worked scenario ≈ the operator's roster; federation planes; MCP surface | @446987a |
| `docs/vision.md` | "every iteration must be something they can touch" (:148) — the slice rule | @446987a |
| `docs/evidence/backlog.md` | 42 milestone rows M0–M41; M5 gate note stale (CO-002 resolved) | @446987a |
| `docs/evidence/verification.md` | exposure: 20 REQs shipped as documents; runtime unverified | @446987a |
| carry-over ledger | 57 open rows; CO-016/036/041/059/074 directly touched by this task | @446987a |
| `docs/evidence/retro.md` | read in full; R-001 binds this run (fires on ADR-0030, see propagation inventory) | @446987a |
| `docs/ux/*` | 24 scenarios; SCN-001/002 already cover project creation; autonomy/floor and hosted terminal had no scenario | @446987a |
| graphify `graph.json` | built at HEAD 446987a | fresh |
| 2026-08-30 architecture audit (this session) | findings A1–A8/B1–B5/C1–C8; proposals P1–P12 — P1/P2/P10/P11 are this run's ADRs | 2026-08-30 |
| `fabric-agent-contract` @ `20a818e` + adapter 0.3.1 | result envelope (done/proof/scope/notVerified); pin skew recorded (audit A4, not this run's scope) | 2026-08-30 |
| `external-contracts.md` §1–5 | Agent SDK is the primary runner channel; `canUseTool`; `--bare`; Supabase local | @446987a |
| context7: `/websites/tauri_app`, `/websites/electronjs` | Tauri runs Node only as a compiled sidecar; Electron ships Node + `utilityProcess.fork` with MessagePorts | 2026-08-31 |
| Knowledge wiki (`projects/fabric`) | present; synced at stage 9 | 2026-08 |

## REQ spine (frozen at the grill; additions appended with source)

| ID | Requirement | Verified by | Status |
|---|---|---|---|
| IL-REQ-001 | `docs/architecture/iterations.md` — canonical iteration map: end product, horizons, iteration-1 target, slices with acceptance lines | links resolve (`check-docs.sh`); no contradiction with §15; every slice carries an acceptance line | open |
| IL-REQ-002 | ADR-0027: Event Journal contract — per-estate gapless seq, table replay, synchronous v1 projections, envelope, `type@N` evolution, partitioning deferred | ADR filed + indexed; `federation.md` replay/partition wording amended; `project-workspaces.md` §9 bus removed | open |
| IL-REQ-003 | ADR-0028: one effects algebra; the floor lives in the schema; Cedar port sits above it | ADR filed + indexed; CO-059 annotated as narrowed; `agent-composition.md` §8 tier table marked historical | open |
| IL-REQ-004 | ADR-0029: a proposal terminates at the target PM; CEO is the residual route | ADR filed + indexed; `work-producing-agents.md` §1 amended in the same change | open |
| IL-REQ-005 | ADR-0030: a Run is one execution of one graph | ADR filed + indexed; `CONTEXT.md` Run entry sharpened; R-001 propagation inventory below swept | open |
| IL-REQ-006 | Iteration-1 module architecture (`docs/architecture/iteration-1-modules.md`): 8 modules, contracts, DDL sketch, three flows, v1 diet | document complete; DDL includes the three migration-1 obligations (ADR-0013/0014/0016) + the floor (ADR-0004) | open |
| IL-REQ-007 | Backlog propagation: slice ladder ↔ milestones; stale M5 gate note fixed | backlog rows reference `iterations.md`; M16/M17 move to scheduled | open |
| IL-REQ-008 | UX propagation: draft scenarios for the hosted terminal, the journal-backed feed, and the approval queue (first autonomy/floor surface in UX) | new ST/FLW/SCN rows trace cleanly; doc gates green | open |
| IL-REQ-009 | ADR-0031: the v1 surface is a macOS desktop app (Electron) with the terminal inside; deferrals recorded in the carry-over ledger | ADR filed + indexed; carry-over rows CO-083…087 appended | open |
| IL-REQ-010 | `CONTEXT.md` title names the kernel canonically (drops the retired "Software Fabric" form) | `grep -c 'Software Fabric' CONTEXT.md` = 0 | open — appended post-freeze, source: 2026-08-30 audit finding C3 |

## R-001 propagation inventory (fires on ADR-0030 — Run cardinality)

Surfaces enumerated and swept in this run: `CONTEXT.md` (Run entry) ·
`docs/architecture/iterations.md` + `iteration-1-modules.md` (born consistent) ·
`docs/adr/0013` (its "each tick creates a new Run" is consistent; no edit) ·
`schemas/project-dashboard.schema.json` `runSummary` (a view, not the durable run — already
says so; no edit) · `docs/ux/scenarios.md` SCN-008 (inspect a run — consistent; no edit).

## Autonomy table

| Row | Answer |
|---|---|
| Escalation | inside-repo reversible: decide + ledger; outward: only the standing merge authorization G9 |
| Branch / tracker | `feat/iteration-ladder`; tracker = `docs/evidence/backlog.md` |
| Gates ("green") | `scripts/check-docs.sh`, `scripts/check-narrative.sh`, `scripts/check-project-schemas.py`, `docs/brand/lint.py` — all exit 0, read not assumed |
| Deploy | merge to main + `docs/MERGES.md` record (G9); no runtime deploy exists |
| Stage 9 | wiki sync yes; `graphify update .` yes |
| Sign-off | operator; deferred REQs → carry-over ledger |

## Deferred out loud (appended to the carry-over ledger in this run)

Suspend interim (blocking `canUseTool` + timeout) as debt against ADR-0022 · Claude Code
version-pin mechanics (v2.1.223 exactly) · the flagship product's support/custdev channels (slice-6 grill) ·
the flagship product's crash/error source (slice-4 grill) · runner-seam security model (untracked until now) ·
git mirror of the declared layer as a projection (slice 3) · notification transports (M8,
after the in-app queue) · dashboard web framework details beyond ADR-0031's stack.
