---
report:
  id: fabric/2026-10-05-release-032-audit
  title: "Release 0.3.2 candidate audit: every scenario, screen and boundary"
  kind: audit
  project: fabric
  domains: [quality, security, ux, architecture]
  as_of: 2026-10-06
  status: active
  valid_until: 2026-11-06
  summary: >-
    A read-only audit of the 0.3.2 candidate (e19e1b9e) walked all 134 scenarios against their screens
    and code, and read the trust boundaries, data integrity, lifecycle, errors, drift and analytics. It
    found 278 findings: 2 P0, 16 P1, 106 P2 and 154 P3. 13 of the 134 scenarios are implemented as
    specified; 59 are partial, 55 are not built, and 7 disagree with their own record.
    The fix list gives every finding a 0.3.2 disposition. All P0 and P1 findings are fixed, or deferred
    with a named carry-over row, before the release.
  sources:
    - {name: "candidate checkout", url: "https://github.com/passioncode-ai/fabric/commit/e19e1b9e", read_at: 2026-10-05}
    - {name: "docs/ux/scenarios.md, screens.md, product-model.json at the candidate", url: "../../ux/scenarios.md", read_at: 2026-10-05}
---

# Release 0.3.2 candidate audit

The operator asked on 2026-10-05 for the plan to be finished, then for a self-check: find the bugs
and gaps in the code, the architecture and the interface, and check every screen and every
scenario. Then make a fix list, fix it item by item with the documentation, and end with a final
check and a summary of what is in this release and what is not.

**The list:** [fix-list.md](raw/fix-list.md), every finding with its 0.3.2 disposition, generated
from the area reports by `raw/build-fix-list.py` and `raw/dispositions.json`.

## 1. How it was checked

Seven read-only audits ran in parallel on a detached checkout of the candidate at `e19e1b9e` (the
merge of the 0.3.1 line with the agent-support, CO-198, analytics and README branches). Six took
the scenarios in slices. For each scenario they read `docs/ux/scenarios.md`, the screen rows in
`screens.md` and `product-model.json`, then traced renderer → IPC → main → SQL along the main path
and every error path. The seventh took the trust boundaries, data integrity, lifecycle, errors and
observability, drift and duplication, and analytics privacy. It split that work with two helper
drafts (`raw/area2.md`, `raw/area45.md`), whose findings it merged into `raw/architecture.md`.

Each finding cites `file:line` at `e19e1b9e`. Each P0 and P1 was re-checked against the source,
and several were reproduced by a probe. The unit suites behind the scenarios were run. All were
green, which is itself a finding: most defects are paths the tests do not reach (A3-001's stub hides
its defect, for example).

| Report | Scope | Findings |
|---|---|---|
| [scn-001-022.md](raw/scn-001-022.md) | SCN-001…022 | 22 |
| [scn-023-045.md](raw/scn-023-045.md) | SCN-023…045 | 65 |
| [scn-046-068.md](raw/scn-046-068.md) | SCN-046…068 | 30 |
| [scn-069-090.md](raw/scn-069-090.md) | SCN-069…090 | 30 |
| [scn-091-112.md](raw/scn-091-112.md) | SCN-091…112 | 38 |
| [scn-113-134.md](raw/scn-113-134.md) | SCN-113…134 | 46 |
| [architecture.md](raw/architecture.md) | trust, data, lifecycle, errors, drift, analytics | 47 |

`python3 raw/build-fix-list.py` counts the findings again from these tables: 278.

## 2. What the audit says about the product

- **The shipped core holds, but its edges do not.** 13 of the 134 scenarios are implemented as
  specified: the project tab and onboarding (SCN-028, SCN-031), the start paths (SCN-126…128) and
  their neighbours. 59 are partial, 55 are not built (most of them honestly `draft` with "Coverage:
  none yet"), and 7 disagree with their own record (`doc-mismatch`). Each report's coverage table
  names the verdict per scenario. Several Coverage lines claim more than the code does, or less
  (A3-025…029).
- **Two P0s.** The editor wrote binary files back as lossy UTF-8 (A4-001). The local stack published
  Postgres and PostgREST on every interface with the Supabase CLI's default credentials (A7-001).
- **The new agent drive had five holes:** a two-minute turn deadline, typed-ahead permission answers,
  orphaned agent processes, dropped granted servers, and Kilo launched without its bundle at
  allow-all. All five are fixed in ADR-0119's amendment 3.
- **A recurring class: a failed read shown as a confident answer.** "Nothing under this goal", every
  project "idle", "nothing logged", an empty task. Several scenario reports find this independently
  (A3-006…010, A4-017/018/024/025, A5-…). It is the main theme of the deferred P2 work.

## 3. What 0.3.2 does with it

Every P0 and P1 is either fixed, with a test whose planted defect was watched being caught, or
deferred to a named carry-over row with its reason. The P2 and P3 findings not fixed here are carried
as two rows: [CO-215](../../evidence/specs/2026-08-16-software-fabric-carryover.md) for the P2s and
[CO-216](../../evidence/specs/2026-08-16-software-fabric-carryover.md) for the P3s, each pointing at
this list. The SCN-027 escalation path (A2-005), a feature that was never built rather than a
defect, is [CO-217](../../evidence/specs/2026-08-16-software-fabric-carryover.md).

The release summary, listing what went in and what did not, is in §4 and is completed when the release
candidate passes its final check.

## 4. Release summary

Written at the final check.
