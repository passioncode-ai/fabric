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

## Document review after artifact freeze

Reviewer `/root/observatory_research`, candidate
`4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b`: PASS, no blockers for N-004…006.
Six local links and 16 pinned blob references resolve; substantive host, pipeline and hub
claims checked against local pinned Git objects. No new remote-state/native/scheduler test.
Reviewer supplied earlier N-004 source findings and authored N-001 code, but did not author
these three documents; this is independent wording/evidence review, not a new certification
of that reviewer's own implementation.

| Artifact under this directory | Reviewed SHA-256 |
|---|---|
| host-matrix.md | 88466978d7cdae548281138e89c861f7be381f12b8ace807787f634fac1a4116 |
| owner-packets.md | fd017644cea009b3c41cdd1fc9f9c42b47984f7d38d825ea3727dba5759bd672 |
| admission-feedback.md | 8af69c471695c5d00fff3b849b9a42c3ce2cd48aacd2f67c429bcb933a20daf8 |

Root final document review by `/root/pipeline_research` caught a graph evidence address that
conflated implementation and report commits, and missing independent N-004…006 receipts.
This correction separates them; no old review was stamped with a new source commit.
