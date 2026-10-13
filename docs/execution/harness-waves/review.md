# CO-282 — independent review rounds

The detailed receipt is [the wave review](../../reports/2026-10-13-harness-wave-review/README.md).

| Module | Candidate | Reviewer | Verdict / evidence |
|---|---|---|---|
| Plan | 5ecf79ea with documented corrections | pipeline_research | corrected ownership/acceptance/barrier issues; graph and cold-reader audit pass |
| N-001 | 9d53b8f1 | pipeline_research | ACCEPT scoped source patch; 25 enrollment tests pass; builder combined35 |
| N-003 | 1ddf43fd plus exact three source digests | observatory_research | ACCEPT scoped source patch; saved seeded500-case invariant check;10+8 regression scenarios |
| N-002 round1 | 67b76358 | pipeline_research | REJECT: contradictory native mode accepted despite32green tests |
| N-002 fix round | ce9090ef | pipeline_research | ACCEPT initial-mode boundary; two mismatchcases refuse and9mode tests pass |

Review identity is a session-local agent label, not externally authenticated identity.
Every verdict has a distinct examined artifact. A retry or a repeated report is not another
review round. Native model behavior and all-agent policy enforcement remain outside these
receipts. Combined source is a2965695f5bdfcc5452fce0c8ff9bd342fd6ffb9; final gate follows.
