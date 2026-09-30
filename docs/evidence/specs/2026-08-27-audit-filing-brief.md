# Task brief — audit-filing

> Stage-0 intake artifact, run `2026-08-27-audit-filing`. Confirmed by the operator
> (an instruction to file it, 2026-08-27) against the explicit filing table of the architecture review.

- **Date:** 2026-08-27
- **Task (one line):** file the 2026-08-27 architecture review's accepted results into
  the repository — two ADRs (event journal as the spine; agent production over an
  ordinary project), the agent-production design document, six carry-over rows and
  milestone M37.
- **UI verdict:** **no** — internal documentation only. The super-ux / copywriting /
  sheleg-design tracks are not armed: their own boundaries exclude internal docs.
- **Coordination:** lease `AUDIT-FILING` (run `r-1367f78a4`), branch
  `feat/audit-filing`, ids reserved through `agent_sync.py reserve`:
  ADR-0014, ADR-0015, CO-054…CO-059.

## Knowledge sources (harvested before the grill)

All sources were read in full during the same-day architecture review; this run reuses
that reading and re-verified coordination state live.

| Source | What it gives this task | Fresh? |
|---|---|---|
| `docs/adr/0001…0013` + `docs/adr/README.md` | ADR house style: append-only, `Partially supersedes`, `Consequences / affects`, index row in the same change | 2026-08-27 |
| `docs/evidence/specs/2026-08-16-software-fabric-carryover.md` | CO row format; CO-016/CO-025 already hold the canUseTool questions — no duplicates filed | 2026-08-27 |
| `docs/evidence/backlog.md` | milestone table format; M32/M34 are M37's prerequisites | 2026-08-27 |
| `docs/evidence/retro.md` | R-001 binds this run; neither new ADR changes hierarchy, ownership or cardinality, so it does not fire — propagation is still swept by grep at the check stage | 2026-08-27 |
| `docs/evidence/verification.md` | one row per shipped REQ; honest `Watched failing?` | 2026-08-27 |
| `docs/AGENT_SYNC.md` @ `6d42441` | guarded set, cycle, integration branch `main`; mirror drift 32 pages — regenerate at close-out | 2026-08-27 |
| Architecture review reports (session scratchpad, 2026-08-27) | the designed content of every artifact below | 2026-08-27 |
| `agent_sync.py status / merges / reconcile` | nobody else active; no expired locks; pre-baseline backlog (10 ADR / 51 CO ids unevaluated) is the recorded init-time state of 2026-08-25 and **stands** | live |
| Code graph | not built — repository has no code (0 source files); harvest ran on docs alone | n/a |

## Grill answers

| Question | Answer |
|---|---|
| Status of the two ADRs | **both Accepted** — operator decision 2026-08-27, given against the filing table naming both as ADRs |
| Extra CO rows for the review's still-open proposals | **yes, +2**: the tenancy contradiction (STOP AND ASK) and the effects algebra. canUseTool rows already exist (CO-016, CO-025) |
| Model | Fable 5 — set by the operator via `/model` this session |

## Scope

**In:** ADR-0014, ADR-0015, `docs/architecture/agent-production.md`, six CO rows,
M37, a README index row, one amendment note in `agent-composition.md`, verification
rows, the retro stamp.

**Out, deliberately:** the tenancy *decision* itself (CO-058 is STOP AND ASK — it is
the operator's), the effects-algebra *design* (CO-059 defers it to stage 2),
`docs/vision.md` (no vision claim changes — ADR-0014 is storage mechanics beneath
ADR-0002's split, ADR-0015 adds mechanism), `CONTEXT.md` (no newly settled noun:
provider and binding are already ADR-0012 vocabulary), any schema or code.

## Requirements

| ID | Requirement | How it's verified | Status |
|---|---|---|---|
| AF-REQ-001 | ADR-0014 recorded — the event journal is the spine; partially supersedes ADR-0002's disagreement gate only — and indexed in `docs/adr/README.md` in the same change | file exists; index row present; links resolve | open |
| AF-REQ-002 | ADR-0015 recorded — agent production is a pipeline over an ordinary project; provider ≠ binding; canary binding — and indexed in the same change | file exists; index row present; links resolve | open |
| AF-REQ-003 | `docs/architecture/agent-production.md` exists as a DESIGN document; README "Where things are" gains its row; `agent-composition.md` header carries the ADR-0015 amendment note | files changed; links resolve both ways | open |
| AF-REQ-004 | CO-054…CO-057 appended (artifact store; instruction/model provenance; eval_set + promotion + production provenance; quota ledger + heartbeat), each with a home and a latest-decision point; next free id bumped to CO-060 | ledger rows present; next-free line reads CO-060 | open |
| AF-REQ-005 | CO-058 (tenancy contradiction, **STOP AND ASK**) and CO-059 (effects algebra) appended | ledger rows present | open |
| AF-REQ-006 | M37 in the backlog's composition-layer table, prerequisites M32 and M34 named in the row | backlog row present; ADR link resolves | open |
| AF-REQ-007 | Checks green: `python3 scripts/check-project-schemas.py`, relative-link resolution over every changed file, `git diff --check`, propagation grep for the retired ADR-0002 gate wording | command outputs in the run log | open |
| AF-REQ-008 | Verification ledger gains one honest row per AF-REQ; PW-REQ-012's pending merge is closed with its merge commit | ledger rows present with evidence | open |
| AF-REQ-009 | Coordination closed on every path: `record`, `board --mirror`, `merge --key AUDIT-FILING`, push; retro stamped (R-001 fired: no) | `agent_sync.py status` clean; MERGES.md row; retro row | open |

> **Frozen.** Appending is free; removing or narrowing a row needs the operator.

## Decomposition

Single module — a documentation filing. No platform cut; stages 3–4 collapse into the
file-by-file plan the REQ table already is (each REQ names its files).

## Autonomy sweep

| Stage | Answer |
|---|---|
| Branch / merge | `feat/audit-filing` from `main`; Conventional Commits; merged by the agent via `agent_sync.py merge --key` when checks are green (operator grant from the 2026-08-16 grill, Q7) |
| Tests / lint | `scripts/check-project-schemas.py` + link resolution + `git diff --check`; no code suite exists |
| Deploy | none — nothing leaves the repository |
| Escalation | none expected; the floor is not touched |
| Wiki / graph | wiki sync considered at stage 9; graph absent (no code), noted |

## Done-criteria

Every AF-REQ verified with evidence; both ledgers' counts re-printed at close-out;
lease released on every path; `main` pushed with the merge recorded.

## Known caveat carried in, not created here

The board's leak line misreports three-digit CO ids (CO-053, filed upstream as AS-08):
CO-054…059 will appear as "reserved and never written" on the generated board even
though they are written. Read the ledger, not the leak line, for these rows.
