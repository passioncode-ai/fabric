# ADR-0113 — Any release approver may approve a Fabric release, the tag's pusher included

**Status:** accepted.
**Date:** 2026-10-03. **Decided by:** the operator's amendment, the same day, of the organization's
release-signing decision D5 ([release-signing README](https://github.com/passioncode-ai/.github/blob/main/release-signing/README.md),
[brief](https://github.com/passioncode-ai/.github/blob/main/docs/release-signing/BRIEF.md)). **Amends**
[ADR-0111](0111-fabric-is-released-from-ci.md), its Context's statement of the organization's rule: "a member
of `release-approvers` who did not push the tag approves" no longer holds. Everything else in ADR-0111 stands.

## Context

ADR-0111 recorded the organization's rule as it stood that morning: the `release` environment's reviewers are
the team `release-approvers`, and the person who pushed the tag cannot approve (`prevent_self_review: true`).
With three approvers (sshlg, khurss, svlab93), a release pushed from the operator's account waited for one of
the other two. The operator amended D5: the author of a release may approve it.

The environments already carry `prevent_self_review: false`, set by `passioncode-ai/.github`
`scripts/setup-release-env.py` from `release-signing/products.json`; `true` there turns four eyes back on.

## Decision

- Any member of `release-approvers` may approve the `macos` and `publish` jobs of a Fabric release run in the
  protected `release` environment, **including the person who pushed the tag**.
- Approval stays a person's act: an agent never approves a release run, even when the account it uses could.
  It starts the run and says whose approval is pending.
- Unchanged from ADR-0111 and the organization's rule: signing happens only in CI; admins cannot bypass the
  environment; only `v*` tags deploy; a published release is never rewritten.

## Consequences

- [`docs/launch/release-mac.md`](../launch/release-mac.md) step 4, the release workflow's header comment
  ([`.github/workflows/release.yml`](../../.github/workflows/release.yml)), plan row P-03 in
  [`docs/evidence/backlog.md`](../evidence/backlog.md) state the amended rule; the dated handoff
  [`2026-10-03-onboarding-and-plan.md`](../handoffs/2026-10-03-onboarding-and-plan.md) carries a one-line note.
- Reverting to four eyes is the organization's change in `products.json`, followed by a new record here.
