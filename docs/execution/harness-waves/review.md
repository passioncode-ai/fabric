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

## Combined source and resource decomposition review

Reviewer `/root/mcp_research`, frozen source
`829570ab586be73043bbd975280e89b20596a7fc`: scoped PASS, no blocking defect found
in enrollment identity, context budgeting or compiler-to-bundle refusal. Application
sources are unchanged through `d6219f2b77b53c2342ff02257d59dd2ea8b3f25b` (`git diff
829570ab d6219f2b -- apps/desktop` empty). This reviewer authored N-002, so examination
of ACP/PTY/catalogue code is contributor review; independent N-002 acceptance remains
with `/root/pipeline_research` above. N-001/N-003 and the resource proposal were independently
examined by this reviewer.

Commands, all exit 0:

- `node apps/desktop/test/context-privacy.test.mjs`: 8 scenarios.
- `node apps/desktop/test/context-mandatory.test.mjs`: 10 scenarios.
- `node --test --test-name-pattern='pending bearers belong|concurrent same-runtime|concurrent retry|failed pending journal|pending admission in one binding' apps/desktop/test/session-enroll.test.mjs`: 5 passed.

Frozen report digest: `89b948a5665f7e5146e1b2cdc6d7dcea5a7a8edb5bf4d86b5c9275eda60fe1a9`.
Frozen handoff digest: `a24542b13890ad441374d47b1c9862dd63d555211bb8e272712c3cf631702aa1`.
Frozen graph digest: `049cbfdaf285642af06365d41b76e0e918fd38e6abe4878fdb8cdd06347d470b`.
Two wording corrections landed in d6219f2b: no model prompt/API invocation does not prove
all network traffic absent; branch integration does not mean a merge to main.

The [resource proposal](resource-implementation.md), SHA-256
`3291038317158688727c433aa7b1798c3061bfb07ae3924b2eae00cb0c054282`, also passed scoped
independent review as a decomposition. Existing quota/backend-cap and launch/stop/outbox
claims match source; R1–R6 tests remain proposed and NOT_RUN. No native/provider behavior,
full CI, deployment or machine-wide enforcement is established by this review.
