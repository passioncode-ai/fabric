# Execution receipt — the 2026-09-09 plan, run to the end

<sub>Written 2026-09-12. The audit's own documents are dated 2026-09-09 and are NOT
rewritten by this one: they record what was true at `d28c321`. This records what
happened to the queue they produced.</sub>

## What this is not

Not a claim that Fabric is finished, and not a percentage. It is the commit range
in which every card of the plan's corrective queue was closed, and — in the same
place, by kind — what was deliberately left.

## The range

| | |
|---|---|
| First card | `c5b04eb` · 2026-09-10 · FA-01 |
| Last card | `2641449` · 2026-09-11 · UXA-C06 |
| Commits in the range | 98, of which 61 close a named card |
| Run stamps | 59, in [`docs/evidence/retro.md`](../../evidence/retro.md) |
| Registers at the close | 1504 verification rows, exposure 173 |

Every card is its own commit with the full tier green **before** it, its own
verification rows, and its own lane in [the map](../../reports/map.html#changelog).
The card's name is the commit's first word, so `git log --oneline` is the index.

## Cards closed

- **FA-01 … FA-10** — cold build, chain admission, unattended admission, link
  command, register parsing, and the counters the plan itself was steered by.
- **M199** — `probe`, `auth`, `accounts`, `binding`, `usage`, `auto`, `resume`,
  `acceptance`, and `ui` (partial, and recorded as partial in its own words).
- **UX28-01 … UX28-15** — the whole preservation lane.
- **CO-161**.
- **AX-01 … AX-17** — the P1 and P2 blocks, including the `05b` and `05c`
  remainders that the first pass named rather than absorbed.
- **UXA-C01 … UXA-C06** — the consumer block, closed last.

## What was left, by kind

The distinction matters more than the count: "not done" says nothing a reader can
act on, and four of these kinds are not work at all.

| Kind | What it means | Rows |
|---|---|---|
| **Vacuous — no subject** | The surface does not exist. An embedded browser, a media reader, a second notification transport, an identity model. Filed one row per absent surface, so building one cannot leave the others reading as covered | 10 |
| **Blocked by a lease** | `docs/ux/scenarios.md` was held by run `r-a04c79b93` for twenty iterations. The behaviour shipped and is checked; only its sentences in the scenario register waited. **The lease was released on 2026-09-12 and these are actionable now** | 9 |
| **Not measured (subject exists)** | A real surface nobody drove: closing a tab on a running service, a source recovering across two passes, two windows deciding one proposal, replay ordering across a restart | 9 |
| **Not measurable by this instrument** | The attach-time byte race on a live PTY. The packet's own unknowns require a deterministic real-PTY test before it can be called a defect, and the exclusions forbid claiming a live PTY test passed from static code | 1 |
| **Measured and deferred** | Known, evidenced, and left on purpose with the reason recorded: the unread count on the estate journal, the claims list born empty | 2 |
| **Deliberately not taken** | The feed's project filter and per-feed cursor. The packet makes them conditional on durable semantics nobody has decided, and building on top of that would be the half-shipped shape this cycle removed | 1 |

Counted by the uppercase kind markers in
[`verification.md`](../../evidence/verification.md); rows from the cycle's first
iterations carry their kind in prose and are not machine-classified, which is a
limit of the count rather than a judgement about them.

## The one defect family

Two forms of one thing, and it is the finding worth carrying out of the plan:

- **A capability computed and never read** — a lint, a revision, a receipt, two
  columns, a return route, `advancesWatermark`, `readPart`, `restorability`, the
  whole of `inbox.ts`, `Lineage.completeness`, the attention read's own source
  receipts, three workspace answers erased by a `Promise<unknown>`.
- **A doctrine applied to some doors and not all** — eight times. The distance
  between the rule and the gap shrank as the cycle went on: a neighbouring file,
  then the same file five lines up, then **the same prop list, about the field
  directly beneath**.

What holds it now, rather than a resolution to remember: `check-written-never-read`,
`check-unread-boundary`, `check-ipc-contract` (88 of 88 after it was widened),
`check-coverage-reads`, `check-backup-claim`, `check-shipped-receipt`,
`check-surface-tools`, `[U078]` in the UX linter, and `scripts/lib/strip-comments.mjs`
as one home. Each states its measured coverage in its header and names what it does
not catch.

## What a reader does next

1. The blocked nine are unblocked — start there, `r-a04c79b93` is gone.
2. [`backlog.md`](../../evidence/backlog.md) carries the exposure line and the
   open board; [`retro.md`](../../evidence/retro.md) carries the standing
   instructions that bind the next run.
3. This plan's cards are closed. A new queue is a new plan, not a re-read of this
   one.
