Contract: brand-contract v1
Status: accepted
Last calibrated: 2026-09-05

# Components

`ui.md` records the shared PassionCode design system and the migration boundary.
This inventory describes the existing Fabric implementation — one resting container of fill plus a hairline,
one gold primary control per region, a state carried by its word, `--app-*` aliases only, the
six-step space ladder. This file names the **objects those rules apply to**.

The two are deliberately separate. `ui.md` is the intent and survives a rewrite
of the interface; this is the current set and changes with it.

## Where it lives

| Concern | Source |
|---|---|
| The components | [`../../apps/desktop/src/renderer/src/components/`](../../apps/desktop/src/renderer/src/components/) |
| The declared inventory | [`../../apps/desktop/src/renderer/src/components/registry.ts`](../../apps/desktop/src/renderer/src/components/registry.ts) |
| Their styles | [`../../apps/desktop/src/renderer/src/components.css`](../../apps/desktop/src/renderer/src/components.css) |
| Their contract, executable | [`../../apps/desktop/src/renderer/src/components/components.test.tsx`](../../apps/desktop/src/renderer/src/components/components.test.tsx) |
| The gate | [`../../scripts/check-design.mjs`](../../scripts/check-design.mjs) |

**The registry is data, not prose.** `check-design.mjs` reads it and fails the
build on a class in a stylesheet that no entry declares. A component set nothing
can check is a style guide, and this project had one of those in the form of
~90 class names for about fifteen concepts.

## The set

Fourteen components own 75 classes between them. Every one is a real object with
a test, not a naming convention.

| Component | What it is | The rule it carries |
|---|---|---|
| `Panel` | the one resting container; `quiet` is tighter padding, `onClick` makes the whole card a control | fill plus a hairline, never a shadow (`ui.md`) |
| `StateChip` | a short label in a pill, optionally with a dot | the WORD carries the state; the dot is an addition, never a replacement |
| `EmptyState` | what a surface says when it holds nothing | takes `read`: a surface may not answer "nothing here" before it has looked (M108) |
| `Row` | one line in a list — lead, content, trail | a clickable row is a real `<button>`, reachable from a keyboard |
| `Toolbar` | a cluster of controls with one spacing rule | — |
| `Stat` | a measured figure with its label | `onClick` opens the register it was counted from: every fact opens its receipt |
| `Field` / `FieldGroup` | a labelled control; a label over several | one binds by id, the other by role and `aria-labelledby` — never interchangeable |
| `Button` | the interactive control | one primary per task region, gold with dark text; the rest keep a hairline; the brand mark never becomes a button state |
| `Banner` | something that must be read before continuing | `role="alert"`, so a scrolled-away reader still hears it |
| `Claim` / `Tail` | what an agent SAYS beside what Fabric OBSERVED | `age` is required: a claim with no age reads as current (ADR-0008) |
| `StatusBar` / `StatusCell` / `Tick` / `StatusDot` | a band of facts that navigate | a cell with an action is a real button |
| `TabStrip` | the window tab strip | exactly one `aria-current`; every icon control named, its glyph hidden |
| `FileTree` | a directory listing with disclosure | — |
| `Caret` | the disclosure triangle | `aria-hidden` always: the state is on the control that owns it |

## Two kinds of entry, and the difference is the point

- **Component** — a named object with an implementation. Its classes are written
  by it and by nothing else.
- **Layout** — a class that positions components and owns no appearance of its
  own: grids, strips, page wrappers. Declared rather than banned, because
  inventing a component for "two columns" is how a set dies of ceremony.

A class has **exactly one owner**. That rule is enforced by a test rather than by
review, and it earned its place three times during M117: `caret` was claimed by
two components and became its own, `span-2` was declared as layout while `Panel`
already owned it, and `widget-list` was declared twice in one object.

## Adding to the set

1. Add the component under `components/`, with the rule it carries in its header.
2. Declare it in `registry.ts` — the same change, or the gate fails.
3. Add its styles to `components.css`, tokens only.
4. Cover the RULE, not the render: the tests here assert that a clickable row is
   a button and that an empty state does not answer before it has read. "It
   renders" is not a contract.

## What the gate does not see

Stated because a gate whose limits are unwritten gets trusted past them.

- **A class built by template.** `` `state-${x}` `` is invisible in both
  directions. One such class was found during M117 by hand — written by the
  agent tile, styled by nothing, doing nothing since its rules were removed.
- **A declared class nobody uses.** The gate checks stylesheet → registry, not
  registry → usage. `launcher` survived that way until it was found by a script
  written for the purpose.
- **Whether the screen is right.** It sees structure. It cannot see a panel in
  the wrong place, a contrast failure, or a layout that breaks at 900px. That is
  review and `/ux-audit`, and R-003 is the standing instruction that says so.
