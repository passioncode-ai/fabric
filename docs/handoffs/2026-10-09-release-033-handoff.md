# Handoff — Fabric 0.3.3, the onboarding release (2026-10-09)

**Objective.** Release Fabric 0.3.3: the onboarding into PassionCode.ai as four start actions, with the agent work in
the console of the operator's coding agent ([ADR-0129](../adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md),
plan row P-14), plus everything landed on `main` since 0.3.2 ([CHANGELOG §0.3.3](../../CHANGELOG.md)).

**Done.** Three independent verification iterations, every finding fixed or ruled with a register id
([ledger](../evidence/plans/2026-10-08-release-033-verification.md)): candidates `ece98797` → `6d6d039d` → `fa9cdf6b`
(`verifiedCommit`). Iteration 3's blocking findings were rechecked by their reviewers at `f891954c`, `d2c20705` and
`fa9cdf6b`; the last recheck, [NB-1 recheck](2026-10-09-release-033-nb1-recheck.md), found no new blocking defect.
`bash scripts/ci.sh fast` green at `fa9cdf6b`. This commit bumps the version, finalizes the changelog heading, names
the gate, the iteration-3 receipts and the ledger section.

**Decision awaiting the operator.** REQ-08 ("no English in the Russian window") is read as: every renderer string in
Russian; main-process messages still English, named in the release notes and carried by CO-225 (ledger
*Release close* item 0).

**Open (the ledger's *Release close*):** land on `main`; merge fabric-workspace PR #81 before the tag; tag `v0.3.3`
and the two protected approvals; the packaged smoke and the first-run boot on the operator's database (CO-228); the
website PR; the workspace publication after the tag (CO-197); the knowledge base (CO-196). After the tag: the close
commit adds carry-over rows CO-239 and CO-240 (reserved; ledger rows V3-42, V3-43), marks P-14 done and lets
fabric-switchboard's PR #27 (universal macOS, x86_64 runtimes, 0.3.4) rebase.

**Exact next task:** item 1 of *Release close* — `bash scripts/ci.sh fast` on this commit, then the fast-forward to `main`.
