Contract: brand-contract v1
Status: accepted
Last calibrated: 2026-11-20

# Fabric UI kit

One place to build a Fabric screen from. The owner, 2026-11-20 (the CEO window, brief
`2026-11-20-fabric-focus-protocol-backup-billing-brief.md`, package 4): «где у нас вообще фабричный бренд-бук,
бренд-пак, короче стили, гайды для верстки, для элементов, собрать это все, чтобы у нас все новые экраны типа
элементы, они быстренько собирались».

- **See it:** [`ui-kit.html`](ui-kit.html), opened from the disk, both themes. It is built from the app's own
  stylesheets and component registry by `scripts/build-ui-kit.mjs`, and `--check` in CI fails a page that no longer
  matches them, so it cannot show a colour, a size or a component the app does not have.
- **The intent** stays in [`ui.md`](ui.md) (the PassionCode design system, gold, states carried by words); **the set**
  in [`components.md`](components.md) (each component and the rule it carries). This file is how to USE them.

## The layers, and where a decision goes

| Layer | File | Holds | A new screen |
|---|---|---|---|
| PassionCode | `tokens.passioncode.css` (vendored, byte-for-byte) | `--pc-*` colour, radius, font, motion roles | never edits it |
| Type ramp | `tokens.paperclip.css` | rem-based sizes and line heights | never edits it |
| App aliases | `tokens.app.css` | `--app-*`, `--state-*`, `--space-*`, `--avatar-*` | reads only these |
| Components | `components/*.tsx`, `components.css`, `registry.ts` | buttons, chips, cards, plates, rows, fields | composes them |
| Screens | `launch/`, `ceo/`, `start/`, … | layout of components | owns layout only |

A value is decided once, in the lowest layer that can hold it. A screen that needs a colour, a size or a corner the
layers above do not have asks for a token or a component in the same change; it does not write a literal.
`scripts/check-design.mjs` refuses raw colours in the renderer and raw sizes in the app sheets, and a class no
component declares.

## Tokens to reach for

- **Colour:** `--app-bg` (window), `--app-panel` (a card), `--app-panel-quiet` (hover, nested), `--app-ink`,
  `--app-muted`, `--app-line` (dividers), `--app-line-control` (the edge of something clickable), `--app-accent` (the
  one primary action, selection, focus). States: `--state-running`, `--state-idle`, `--state-blocked`, `--state-good`,
  `--state-ended`, on borders and dots only; the word carries the state.
- **Type:** `--app-fs-body` (reading size), `--app-fs-caption` (meta, muted lines), `--app-fs-label` (section
  headings), `--app-fs-badge` (chips), `--app-fs-title` (a page or window title), `--app-fs-stat` (figures).
  Six sizes on a screen is the ceiling; a seventh is a design question, not a CSS one.
- **Space:** `--space-1` 4 px and `--space-2` 8 px inside a control or a row; `--space-3` 12 px between parts of a
  card; `--space-4` 16 px around a card's content; `--space-5` 24 px and `--space-6` 32 px between blocks of a screen.
- **Shape:** `--app-radius-control` 8 px (buttons, inputs, tags), `--app-radius-panel` 16 px (cards, popups),
  `--app-radius-pill` (chips, dots). `--shadow-modal` only for what floats.

## Recipes

Each recipe names the components; the live sample is the same section of [`ui-kit.html`](ui-kit.html).

### A button row
`Toolbar` with `Button`s. One primary (`btn`, gold, dark text) per task region, on the right of a dialog's foot and
first in a form; the rest `btn-ghost` (with a hairline) or `btn-quiet`. A destructive act is `btn-danger` and never
the default. A row of four equal buttons is a menu: make it one primary and a «Ещё» disclosure.

### Chips
`StateChip`: a short word in a pill, a dot when the state is live. `chip-info` running, `chip-warn` waiting,
`chip-good` done, `chip-danger` needs a person, `chip-quiet` ended. Not for counts in a heading (use the heading's
muted tail) and not as buttons.

### Cards
`Panel`: fill and a hairline, no shadow. `panel-head` holds the title and at most one chip or action; `panel-quiet`
is the tighter card in a list of cards; `onClick` makes the whole card one control. A card inside a card is a
`Row` list instead.

### Plates
`Banner`: something that must be read before going on, with at most two actions. `banner-warn` for a risk the person
can act on, `banner-error` for a failure, each saying what happened and the next step. A tip or a greeting is not a
banner: it is a muted line.

### Popups
A floating `Panel` over `--app-scrim`, with `--shadow-modal` and `--app-radius-panel`: a head (title, at most one
quiet control), a body, a foot `Toolbar` aligned to the end with Cancel then the one primary. Escape and the scrim
close it unless something would be lost. A popup that holds a whole screen (a console, a chat) is a window, not a
popup: give it a head of one line and let the content take the rest.

### Lists
`Row`s in a `Panel`: lead (a chip or an avatar), main (one line, wraps), trail (time or a quiet action). A clickable
row is a real button. More than one line of meta under a row's title is a card, not a row. A long list states its
count and its bound («показаны 50 из 312»), never an implied «всё».

### Empty, loading and failed
`EmptyState` only after the read has happened; a read in flight says so; a failed read says what failed and offers
the retry. «Ничего нет» for a read that did not happen is the defect `components.md` names (M108).

## How a screen is checked

1. `node scripts/check-design.mjs` (in `scripts/ci.sh`): no raw colour, no raw size in the app sheets, no undeclared
   class, every string from the registry.
2. `node scripts/build-ui-kit.mjs --check`: the kit page is what the sheets build.
3. The ratchet: the counts of raw `px` font sizes, raw spacing and raw radii in the screen sheets
   (`launch/launch.css`, `launch/rail.css`, `start/start.css`) are recorded in
   [`ui-kit-baseline.json`](ui-kit-baseline.json) and may only go down. Measured by the gate 2026-11-20, before any
   migration: `launch.css` 345 raw font sizes in 22 distinct values (8 px to 32 px), 171 raw spacings, 37 raw radii;
   `rail.css` 40, 66 and 14; `start.css` 6, 11 and 1. A screen moved onto the kit lowers its numbers in the same
   change and writes them back with `node scripts/check-design.mjs --ratchet` (which refuses to write while any count
   is above the record).
4. A screen that changes shows before and after captures in its change, both themes.

## How the page is made

`scripts/build-ui-kit.mjs` inlines `tokens.passioncode.css`, `tokens.paperclip.css`, `tokens.app.css`, `styles.css`
and `components.css` (fonts loaded by URL are left out, the system font stands in), lists the tokens of each family
from `tokens.app.css` with their comments, renders each component's markup with its real classes, and reads every
token's resolved value in the theme shown from the page itself. The page carries a fingerprint of its sources.
