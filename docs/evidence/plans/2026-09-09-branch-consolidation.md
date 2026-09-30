# Branch consolidation — 2026-09-09

## Objective and entry point

Six worktrees and thirty-five local branches had accumulated against four remote
refs. The question was not "which branch is newest" but "what is reachable from
exactly one place, and would be lost if that place were deleted". This document
records the answer for every branch, the evidence for each disposition, and what
was repaired on the way in.

Entry point: `main`. After this consolidation `main` is the only branch; every
commit that was ever reachable is reachable from `main` or from an `archive/*`
tag named below.

## Method — what was measured

Three questions per branch, each answered by a command rather than by reading a
name or a date:

1. `git merge-base --is-ancestor <branch> <tip>` — are the commits already in the
   main line? Thirty of thirty-four were.
2. For the four that were not: `git rev-parse <branch>:<path>` against
   `git rev-parse <tip>:<path>`, blob by blob — is the *content* there even when
   the commits are not?
3. Where a blob differed, which side is later? Answered by reading the diff, not
   by comparing timestamps: a branch can be committed later and still be behind.

## Disposition

### Merged — real work reachable from nowhere else

| branch | commits | evidence |
|---|---|---|
| `sherlock/impl-20260907` | 13 | `apps/desktop/src/main/executionPacket.ts` and `apps/desktop/src/main/pipelineAdapters/taskPipeline.ts` existed on no other ref; `test/audit_regressions/` (12 files, findings PF-04…PF-10) existed on no other ref. 2361 insertions across 22 paths. Merged at `36f15ba`. |

Divergence was at `6dffd61`, eighteen commits back — same day. Of the twenty-two
paths, the main line had moved two: `agentSurface.ts` (one commit) and `index.ts`
(three). Both auto-merged; zero conflicts. `pnpm -r typecheck` green on the
merged tree before the commit was written.

### Archived — content absorbed, commits preserved by tag

These four branches carry commits that are not ancestors of `main`, but every
blob they hold is already on the main line, and where a blob differs the main
line's copy is the later one. They are deleted as branches and kept as annotated
tags, so nothing becomes unreachable.

| branch | tag | what was verified |
|---|---|---|
| `codex/mockup-graphs` | `archive/mockup-graphs` | `graphs.mjs`, `graphs.css`, `integrations.mjs`, `integrations.css` and 11 of 14 test files byte-identical. Three differ and the main line is later: `product-workbench.browser.cjs` there no longer hardcodes `$HOME/…` for the Playwright module, the source root or the receipt path. |
| `codex/mockup-screen-audit` | `archive/mockup-screen-audit` | `operations.mjs`, `operations.css`, both browser suites byte-identical. |
| `codex/mockup-source-audit` | `archive/mockup-source-audit` | `governance.css` byte-identical; `governance.mjs` is later on the main line — 85 484 → 86 863 bytes, adding `startupSpec` seeding and `syncGovernanceRepositories`. |
| `codex/adopt-agent-contract` | `archive/adopt-agent-contract` | `docs/adr/0012-agent-compatibility-is-an-external-versioned-contract.md` is byte-identical (blob `17497c5d`). The other seven paths it touched have all moved further on the main line. Last commit 2026-08-26; it was 98 commits behind. |

### Already in the main line

Thirty branches were ancestors of the consolidation tip, `main` among them;
the other twenty-nine were deleted without a tag, their commits remaining
reachable from `main`. They are the `feat/*`,
`fix/*`, `docs/*` waves of 2026-08-25 … 2026-09-01 plus `codex/brand-system`,
`codex/fabric-mcp-control-plane`, `codex/high-level-vision`,
`codex/runtime-policy-decisions`, `codex/foundation-priorities-design-map`,
`codex/provider-accounts-design-20260909` and
`codex/provider-accounts-review-20260909`. `docs/MERGES.md` holds their landing
records.

### Uncommitted work in the worktrees

Four untracked files survived in two worktrees and none of them held anything:

| file | worktree copy | main line | verdict |
|---|---|---|---|
| `scripts/product/workbench.mjs` | 63 549 B, 2026-09-07 21:13 | 85 098 B | superseded |
| `scripts/product/routines.mjs` | 15 691 B | 16 527 B | superseded |
| `scripts/product/obligations.mjs` | 3 367 B | 4 347 B | superseded |
| `scripts/test/product-schedule.browser.mjs` | 7 172 B | — | byte-identical to the tracked file |

No stashes existed in any worktree. `.` and the three
audit worktrees were clean.

## What the merge repaired

`sherlock/impl-20260907` was abandoned holding three defects, and nothing was
running to say so: two red regression tests in a suite no runner named, and one
gate violation that only surfaced when the branch's code first met
`scripts/ci.sh`. All three are fixed in `HEAD`, and each fix was watched
refusing before being accepted.

**FIX-PF-07.01 asserted a key shape its own branch had already replaced.** The
assertion pinned ``idempotencyKey: `chain:${follower.id}:${link.target_id}` `` —
one predecessor. Four commits later, FIX-PF-08.01 widened the key to the complete
predecessor set (`incoming.map(…).sort().join('+')`) so that a second edge of a
diamond cannot start the follower twice. The assertion was never updated. It now
holds the intent rather than the spelling: the key must name the follower, must
name a predecessor, and must pin the *complete* set. Planted and watched: a key
of `chain:${follower.id}:dispatch` fails on "the idempotency key (follower +
predecessor) is missing"; a key of `chain:${follower.id}:${incoming[0].target_id}`
— valid TypeScript, and exactly the pre-PF-08.01 defect — fails on "the key does
not pin the COMPLETE predecessor set".

**FIX-PF-06.03 held a reservation the main line had claimed.** The
[persistence contract](task-pipeline-persistence-contract.md) reserved migrations
`…000052`/`…000053` and ADR `0051` against a branch whose latest migration was
`20260909000049_task_runs.sql`. While it sat unmerged the main line took all
three: `20260909000052_membership_authority.sql`, ADR-0051 and ADR-0052. The
document's own rule — "a collision at execution time re-reserves the NEXT free
id" — was applied to itself: the reservation moved to migrations `…000053`/
`…000054` and ADR `0053`, and the collision is recorded in the document rather
than erased from it. Nothing applied was renumbered. Planted and watched:
pointing the reservation at ADR-0052 fails on both "the reserved ADR already
exists" and "the reserved ADR id does not continue from 0052".

**The branch had never met the ops gate.** `check-ops.mjs` refused the merged
tree on `apps/desktop/src/main/executionPacket.ts:83` — "a catch that neither
records nor explains". `verify()` swallowed a failed blob read and pushed the ref
onto `missing`. The classification is right and the tests depend on it
(FIX-PF-05.02 asserts `missing == ["context"]` for an unlinked blob), so what was
missing was the reason, not the behaviour: the failure is not dropped, it leaves
as a result the caller must handle, and `sessionBundle` refuses the launch on it.
The comment now says so. The gate was watched refusing before the comment existed
and passing after — that direction is the same evidence as a planted defect.

**The suite is now wired.** Twelve files under `test/audit_regressions/` were
named by no runner — not by `scripts/ci.sh`, not by `package.json`, not by the
workflow. They run in the fast tier now, named one by one for the same reason the
pure tests are: a wildcard that matches zero files is precisely how these went
unseen for two days.

## The rule this consolidation changed

Landing a branch would leave the design map stale on `main`. `docs/MERGES.md` is
one of the 1 250 files the map stamp hashes — verified against the gate's own
filter, which excludes only `map.html`, `workspace/` and the receipt — and the
merge log has always been written *after* the merge, as its own `docs(merges)`
commit. So the last commit of every landing changes a map source after the map has
been stamped.

The receipt is the mechanism, not a red build, and the distinction matters:
appending one ledger-shaped line to `docs/MERGES.md` on this tree takes
`node scripts/check-design-map.mjs` from exit **0** to exit **1**, "Map sources
changed"; restoring the file returns it to **0**. What cannot be shown is a past
commit caught doing it. The gate itself only arrived on 2026-09-07 in `d51eb35`,
after the most recent such landing — `a360b51`, whose tip commit is
`docs(merges): record codex/brand-system → main` — so the script does not exist at
that commit to be run against it. An earlier draft of this document claimed the
gate exited 1 there. It does exit 1, because the file is absent; that is not
evidence of staleness and the claim is withdrawn.

`AGENTS.md` §4 of the iteration contract now says the entry lands inside the
iteration and the branch lands by fast-forward. This iteration is the first to
follow it: the ledger entry above was written before the stamp, `main` was
fast-forwarded rather than given a trailing commit, and the map gate passes on
`main`.

## Publication address

The private workspace answers on `https://wiki.passioncode.ai` as well as its
generated Heroku hostname. DNS is a `CNAME` in the Cloudflare zone
`passioncode.ai` to the Heroku DNS target, deliberately **not** proxied: Heroku
ACM must reach the origin to issue and renew, and Heroku terminates TLS for this
host itself. The certificate is Let's Encrypt, issued 2026-09-09, renewing
2026-11-08. `PUBLIC_ORIGIN` moved with it, so a plain-HTTP request now redirects
to the wiki address. The access boundary is unchanged: HTTP Basic on every path
except `/healthz`, `noindex, nofollow, noarchive`, private repository. No ADR is
needed — ADR-0048 decided that the workspace is a versioned private publication,
and this changes its address, not that decision.

## Limits

- This document accounts for **branches and worktrees**, not for product
  readiness. Nothing here says a milestone shipped.
- The twelve regression files are static-source readers. They prove the shape of
  the code that closed a finding; they do not exercise a database, a provider or
  a running agent. The full tier and the live acceptance cases remain the only
  evidence of runtime behaviour.
- The archived tags are a safety net, not a plan. Nothing is scheduled to come
  off them; delete them only after the same blob-by-blob check is repeated.
