# Runtime walk — the record a person fills in (UX28-14)

**This document is not a result. It is the apparatus for one, plus a precise
statement of what could not be observed and why.**

UX28-14 asks for a keyboard walk and then a screen-reader walk of the top flows,
at three CSS widths and 200% zoom, with screenshots and DOM receipts attached.
Its own exclusions are the reason this file exists rather than a PASS:

> No accessibility PASS from static CSS, jsdom, axe alone. No product mockup
> evidence substituted for runtime.

And its positive acceptance permits exactly what is written below:

> Each scoped scenario has observed result **or precise blocked reason**.

## The precise blocked reason

The walk needs an observer this run does not have. Specifically:

- **A screen reader.** "Screen reader announces relevant errors" is a claim
  about what VoiceOver says out loud. Nothing in this repository can produce
  that sentence, and no static analysis can stand in for it — a control can
  carry a perfect `aria-label` and still be announced in an order that makes the
  screen unusable.
- **A native Electron window at a real size.** jsdom has no layout: it does not
  compute a grid, does not apply a media query, and reports zero for every
  measurement. So 1280/640/375 and 200% zoom cannot be observed here, only
  reasoned about from the stylesheet — which is the substitution the exclusion
  names.
- **Eyes for contrast.** Contrast is a ratio between rendered pixels. The tokens
  can be read; what a theme puts on screen after compositing cannot.

None of that is a limitation to work around. It is the finding: **this card's
positive acceptance requires a human session, and the honest deliverable is to
make that session cheap, repeatable and hard to fake.** What follows is that
apparatus, and it was built and run.

## Exact build, database and fixture (step 1)

Recorded 2026-09-10 on the machine that built the fixture.

| What | Value |
|---|---|
| commit | `ca90bbbd71b4b27f93ed04a5ed95a68e519b58ee` |
| migrations applied | 59 |
| electron | `^44.0.0` |
| node | `v26.8.1` |
| postgres | 17.6 (local stack, port 54322) |
| fixture | `scripts/fixtures/walk-estate.sql` |

Reproduce, in order, from the repository root:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f scripts/fixtures/walk-estate.sql
pnpm dev
```

The fixture is **idempotent on fixed ids** — re-running it appends nothing — so a
walk interrupted halfway is resumed rather than restarted, and the working
database is never reset to get a clean one. Its receipt, printed by the last
statement, is what a recorder pastes in:

```
 walk-fixture | project | tasks | columns                     | facts | own_events | own_head
 walk-fixture |       1 |     4 | backlog,done,review,running |     3 |         17 |       19
```

The columns matter more than the counts: one task in each of the four board
columns, so a board transition has something to move and every column has a
non-empty state. Two facts and one decision, so search returns hits in more than
one store. A project with a purpose and **no repository**, which is onboarding's
alt path rather than its happy one.

## What the static checks already settled — and what they do NOT

Two gates were added by this card and are wired into `scripts/ci.sh`. Both are
STRUCTURAL. Neither is an accessibility pass, and both say so in their own
headers.

| Gate | What it proves | What it does not |
|---|---|---|
| `scripts/check-grid-arity.mjs` | every fixed-arity grid has as many tracks as its screens put children into it, and collapses at narrow widths | nothing about how any of it looks at any width |
| `scripts/check-control-names.mjs` | every text-entry control has an accessible name | nothing about whether the name is good, the order sensible, or the focus anywhere |

They found three things, all fixed in this change:

1. **`.project-columns` declared two tracks and `EstateAgents` put three
   children into it** — so on the estate agents screen the session list took the
   wide `1.6fr` track, the console took the narrow one, and the third panel
   wrapped to a second row. The card names this target directly ("estate
   three-child/two-column grid"). Worse: `col-main` and `col-side` have no rule
   in any stylesheet, so placement is positional and `ProjectHome` is correct BY
   ACCIDENT — its child order happens to match its class names, which describe
   an intent the stylesheet does not carry.
2. **`.board` was `repeat(4, minmax(0, 1fr))` with no media query anywhere in
   `components.css`** — about 93 CSS pixels per column at the 375-wide target,
   at every width, and a hardcoded four beside a column list built from data.
3. **Three `<select>` controls had no accessible name**: the launch-option
   selector in `ProjectHome`'s Agents panel, the same on Tasks, and the move
   selector on a task card. The third is the instructive one — its placeholder
   option describes it while nothing is chosen and stops the moment something
   is, because a screen reader announces the VALUE. A name is not a value.

## The walk itself — one row per scoped flow, to be filled in at a runtime

Every row is `blocked: needs a human session`. That is the observed state of
this card, not a placeholder for optimism.

| Flow | Keyboard | Screen reader | 1280 / 640 / 375 | 200% zoom | Result |
|---|---|---|---|---|---|
| Onboarding a project | | | | | blocked: needs a human session |
| Task page, save a brief | | | | | blocked: needs a human session |
| Board transition (drag AND the select) | | | | | blocked: needs a human session |
| Search across the five stores | | | | | blocked: needs a human session |
| Agent selection on SCR-39 | | | | | blocked: needs a human session |
| Editor conflict | | | | | blocked: needs a human session |

Named inspection targets from the card, for the same session:

- the CEO panel's `max-width: 40vw` cap at each width (`styles.css`, `.ceo-panel`)
- the four-column board, now `auto-fit` — confirm it gives four tracks at 1280,
  two at 640 and one at 375
- the estate three-child grid, now `.project-columns-3` — confirm the console
  gets the widest track and that all three collapse to one below 1000px
- focus on open, on close and on back
- reduced motion: `tokens.app.css` zeroes `--dur-quick` under
  `prefers-reduced-motion`; confirm nothing else animates

## The negative acceptance, and which half is testable without a runtime

> Injected missing IPC/query rejection/path denial maintains usable recovery and
> unsaved text; screen reader announces relevant errors.

The **first half is already covered by probes**, and by three cards of this
cycle rather than by this one: UX28-11 made a settings draft survive a
concurrent write and a refused save, UX28-12 made a refused decision keep its
row decidable and its words on screen, and UX28-02 made each read fail
independently so one rejection cannot blank a panel that answered. Those are
injected-rejection cases with unsaved text preserved, asserted in jsdom.

The **second half — what a screen reader announces about an error — is blocked
for the reason above**, and it is the half that decides whether the first half
reaches anybody.
