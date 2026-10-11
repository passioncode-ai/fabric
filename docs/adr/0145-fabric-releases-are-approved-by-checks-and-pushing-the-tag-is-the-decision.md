# ADR-0145 — Fabric releases are approved by checks; pushing the version tag is the release decision

**Status:** accepted.
**Date:** 2026-10-11. **Decided by:** the operator, for every PassionCode.ai product — the organization's
release-signing design, "Approval by checks" ([`passioncode-ai/.github` `docs/release-signing/DESIGN.md`](https://github.com/passioncode-ai/.github/blob/main/docs/release-signing/DESIGN.md),
read at `84cee621`). **Supersedes in part** [ADR-0113](0113-any-release-approver-may-approve-the-tag-pusher-included.md):
its rule that a person from `release-approvers` approves the `macos` and `publish` jobs, and that "approval stays
a person's act". **Amends** [ADR-0111](0111-fabric-is-released-from-ci.md) §"the protected environment". Everything
else in both stands: signing happens only in CI, admins cannot bypass the environment, only `v*` tags deploy, a
published release is never rewritten.

## Context

Each release waited on two clicks in the `release` environment ("Review deployments" for `macos`, then for
`publish`). The organization's design records why it changed: finished, signed builds waited for hours because
nobody saw the request. The click checked nothing the checks do not already check — the person approved a run whose
commit, version and gate `preflight` had verified.

## Decision

- **The checks approve.** `.github/workflows/release.yml` runs a `guard` job
  (`passioncode-ai/.github/actions/release-guard@v1`) and every job that holds the `release` environment's keys
  needs it. The guard passes a tag only when `main` contains the tagged commit and `ci.yml` concluded `success` on
  that exact commit; with no run, it starts one on the tag and waits; anything else is refused with the reason and
  the run's link. `preflight` still refuses a tag whose version, ancestry or release gate is wrong
  ([runbook](../launch/release-mac.md) step 3).
- **The environment has no reviewers** once this workflow is on `main` (`products.json` `"approval": "checks"`,
  applied by the organization's `scripts/setup-release-env.py`, which lifts reviewers only from a repository whose
  default-branch `release.yml` runs the guard). `"approval": "people"` restores them, and a new record here says so.
- **Pushing a `v*` tag is the release decision.** The tag ruleset `release-tags` lets only team
  `release-approvers` create, move or delete one. An agent working under an account of that team pushes the tag
  after the release pull request has landed and its checks were read green, then watches the run to its end
  (the operator's standing instruction, 2026-10-11) — the decision is the operator's by the team's membership and
  the instruction, not by a click per run.

## Consequences

- [`docs/launch/release-mac.md`](../launch/release-mac.md) steps 4 and 6 and the header comment of
  `release.yml` state the rule; ADR-0113 carries a pointer to this record.
- What a click used to give and checks do not: a person seeing the run before keys are used. The release gate
  (three verification iterations, `docs/launch/release-gate.json`) and `preflight` remain the human-reviewed
  content; the guard adds that CI passed on the commit itself.
- Dated records (the 0.3.x release ledgers, P-03, the lane-2 row's "after the protected human approval") describe
  releases that were approved by a person; they are not rewritten.

## Evidence

- fabric#28 (`agent/release-guard`, `2a3a0b7b`): the `guard` job, `macos` `needs: [guard, preflight]`.
- The organization's design at `84cee621`, section "Approval by checks" and "The `release` environment".
