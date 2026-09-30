# Carry-over ledger — high-level-vision

> Append-only. Every deferred or deliberately excluded item receives a stable home
> before acceptance; no row is silently removed.

| # | Stage | What | Why it is not done | REQ | Where it lives now |
|---|---|---|---|---|---|
| 1 | stage 2 | Commercial unit and packaging | **resolved 2026-08-29:** internal Estate-subscription decision; detailed prices and secondary packaging remain private later work | HV-REQ-007, HV-REQ-008 | ADR-0025; canonical CO-075 |
| 2 | stage 2 | V1 workspace composition model | **resolved 2026-08-29:** constrained responsive grid | HV-REQ-005 | ADR-0024; canonical CO-076 |
| 3 | stage 2 | Durable execution engine | **resolved at contract level 2026-08-29:** Temporal reference profile behind the durable port; implementation spike proves the adapter rather than choosing semantics | HV-REQ-003, HV-REQ-006 | ADR-0022; canonical CO-077 |
| 4 | stage 2 | Event envelope and schema evolution | journal spine is decided; interoperable envelope needs a focused ADR | HV-REQ-003 | canonical CO-078 |
| 5 | stage 2 | Policy engine | **resolved 2026-08-29:** embedded Cedar-compatible reference evaluator and fail-closed uncertainty contract; fixtures still required before implementation acceptance | HV-REQ-003, HV-REQ-006 | ADR-0023; canonical CO-079 |
| 6 | stage 2 | Marketplace trust/liability | public distribution is later than org #1 and cannot be inferred from conformance | HV-REQ-007 | canonical CO-080 |
| 7 | stage 2 | Knowledge portability/deletion/decay | needs privacy, retention and storage design together | HV-REQ-003 | canonical CO-081 |
| 8 | stage 2 | SLO, RPO/RTO and recovery | no production SLA exists yet | HV-REQ-003, HV-REQ-007 | canonical CO-082 |

These rows mirror pointers only; status and wording are owned by the original
software-fabric carry-over ledger named in `docs/DOCMAP.md`.
