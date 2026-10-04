# COM-01 contract candidate: Project communication v0.1

This directory is a concrete **normative candidate**, not an active protocol or a COM task closure.
Source baseline: `54cefbbf0c9b71ad0c403689b90c790ceb7ed139`. Parent owns P-08 qualification,
canonical plan, migration reservation, map/UX propagation and acceptance. No runtime files changed.

## First cold task

Run `python3 docs/handoffs/com01-contract-candidate-20261004/check.py`, then read
[contract.md](contract.md) and [schemas.json](schemas.json). Decide whether to accept candidate
choices C1–C9 under the parent's required claims. After acceptance, Contract ports schemas/vector
fixtures to its canonical owner and COM-02.A implements the participant boundary against a
disposable database. Do not start provider/Telegram implementation from this model.

## Scope, dependencies and resume

Allowed write set is this new directory only. Excluded: application code, SQL, shared registers,
ADR IDs, service fixtures, versions, wiki/catalog, configuration, background helpers and release.
No SQL/ADR IDs reserved; suffixes81/82 remain with their current owner. Original dirty checkouts
are preserved. Existing [COM spine](../../evidence/plans/2026-10-04-project-communications.md),
[architecture proposal](../../reports/2026-10-04-project-communication-architecture/README.md)
and [implementation packets](../2026-10-04-project-comms-implementation-packets.md) remain canonical.
Local-lifecycle input is commit `fbb649ee4719115da0d4abbd171814b04c2e77c8`,
`docs/reports/2026-10-04-local-agent-lifecycle/README.md` (on its author branch; absent in this
frozen baseline). Its source receipt is [raw/sources.json](raw/sources.json).

Pipeline profile here: harvest/intake → candidate definition → fixture implementation → refusal
and documentation gates → pushed cold handoff. The inherited model stays unchanged. Scope and
source ledger come from the delegated brief; there are no blocking intake questions. Acceptance
of normative choices and production activation remain parent/operator gates, not auto-approved.

Deliverables: [contract.md](contract.md), strict versioned [schemas.json](schemas.json),
[vectors.json](vectors.json), dependency-free [check.py](check.py) and candidate state
[model.py](model.py). The checker validates only the assertion vocabulary actually used by the
schema, rejects unsupported assertion keywords and checks semantic limits separately. It is not
a universal JSON Schema engine or a production DB/security boundary.

## Choices pending parent adoption

| Choice | Candidate | Consumer |
|---|---|---|
| C1 | Opt-in `fabric-project-comms/0.1`, separate from `fabric-service/0.1` | Contract, COM-03.D |
| C2 | Immutable thread Project participants; explicit whole-Project-history grant | COM-02.A/C, COM-06 |
| C3 | Principal-bound private cursors; no estate ordinals in reader responses | COM-02.C |
| C4 | Generation + attempt + effect gates, accepted work held on expiry | COM-03 |
| C5 | No helper by default; 60 s short tool-burst claims, no attention guarantee | Adapter31, COM-04 |
| C6 | Finite namespace admission, retired floor and durable unknown facts | COM-02.B/D |
| C7 | Archived history only; new restore epoch excludes all execution authority | COM-02.D |
| C8 | Telegram off by default, private mapping, bounded causal loops | COM-08/09 |
| C9 | Short MCP calls; no Tasks/A2A claim without negotiated acceptance | COM-03.D/04 |

## Verification and handoff

Actual checks and exclusions are in [raw/verification.json](raw/verification.json); use that
receipt rather than assuming planned negatives passed. Candidate fixtures are model evidence,
not database concurrency/RLS, real provider/SDK/Desktop, installed/build, hosted CI, Telegram,
release or independent-review acceptance. The required fast/map gate may remain stale because
the parent alone updates the map; no broad green is claimed. No leases/helpers/processes were
started by this packet. Branch remains for review, with no merge or service activation.

Source choices serve Fabric's one-conversation/many-agents vision while keeping private agents
private. No screen, shipped product wording or visual layer changed, so super-ux/design/copywriting
did not run in this bounded contract artifact.
