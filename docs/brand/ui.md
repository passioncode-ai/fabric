Contract: brand-contract v1
Status: accepted
Last calibrated: 2026-09-26

# Visual identity

PassionCode.ai shares one design system across its toolkit: dark surfaces, gold
interaction emphasis and a distinct glyph for each product. The passion-fruit mark
identifies the umbrella; Switchboard uses **S**, never F, on a dark tile.
[ADR-0070](../adr/0070-passioncode-toolkit-and-product-design-system.md) records the
operator’s direction. Brand colour never substitutes for a state label.

## Shared system and adoption boundary

The canonical [PassionCode design system](https://passioncode.ai/design-system/) owns
`--pc-*` semantic tokens and usage rules. The initial source is
[design-system/ at 508e917](https://github.com/passioncode-ai/passioncode-ai.github.io/tree/508e91793fcb79d6a59bd2265551dbc76f7a8f97/design-system).
Consume or vendor that source with its commit and digest; do not sample colours from screenshots.

Gold means action, selection or focus. Warning, positive, negative and information use
their separate semantic roles and text labels. Unknown usage stays unknown. Dark text
on gold identifies a primary action; one primary action per task region. Keep visible
keyboard focus, underlined prose links and reduced-motion behaviour. Marketing can use
spacious composition; desktop work retains compact rows, restrained surfaces and readable density.

**Adoption status, 2026-09-28 (D0):** the Fabric desktop runtime and the product
mockups consume PassionCode 1.1.0. The tokens are vendored byte-for-byte as
[`tokens.passioncode.css`](../../apps/desktop/src/renderer/src/tokens.passioncode.css) from
commit `6085d10`, with source and SHA-256 in
[its manifest](../../apps/desktop/src/renderer/src/tokens.passioncode.manifest.json);
`scripts/check-design.mjs` rejects a local edit. Every colour, focus, state, radius, font and
motion role in `tokens.app.css` resolves to a `--pc-*` role, and components still consume only
the `--app-*` aliases. Both themes were checked in the browser on the mockups
([verification](../evidence/verification.md#d0--the-passioncode-design-system-in-the-fabric-runtime-and-mockups)).
Not yet migrated: the About/i18n product hierarchy (CO-169) and the generated brand exports.
To upgrade, copy the new canonical file, update the manifest, and review both themes.

## Current Fabric implementation sources

| Concern | Source |
|---|---|
| Shared design system, vendored | [`../../apps/desktop/src/renderer/src/tokens.passioncode.css`](../../apps/desktop/src/renderer/src/tokens.passioncode.css) + manifest |
| Type ramp and terminal tokens not in PassionCode | [`../../apps/desktop/src/renderer/src/tokens.paperclip.css`](../../apps/desktop/src/renderer/src/tokens.paperclip.css) |
| Product semantic aliases | [`../../apps/desktop/src/renderer/src/tokens.app.css`](../../apps/desktop/src/renderer/src/tokens.app.css) |
| Primary brand mark | [`../../assets/brand/favicon/source/passioncode-passion-fruit.svg`](../../assets/brand/favicon/source/passioncode-passion-fruit.svg) |
| Generated favicon matrix | [`../../assets/brand/favicon/`](../../assets/brand/favicon/) |
| Generated PNG/JPG brand pack | [`../../assets/brand/brand-pack/`](../../assets/brand/brand-pack/) |
| Mechanical icon build/check | [`../../scripts/build-brand-icons.mjs`](../../scripts/build-brand-icons.mjs) |
| Mechanical raster build/check | [`../../scripts/build-brand-pack.mjs`](../../scripts/build-brand-pack.mjs) |

The token files currently implement Fabric surfaces. This document owns the intent and the
boundary between interface semantics and brand expression; it does not copy the
full token tables.

## Mark construction

The mark is an upright, vertically symmetric passion-fruit cross-section. A
slender plum rind contains a magenta interior; five broad golden chambers and
five large aubergine seeds repeat around a round golden centre. Left and right
geometry uses mirrored coordinates, so vertical symmetry is structural rather
than eyeballed. The top chamber and round centre are aligned to that same axis.

| Role | Vector paint | Use |
|---|---|---|
| rind | `#2D0039` → `#4B0354` | outer silhouette |
| interior | `#F20673` → `#D90066` | inner field and chamber separation |
| flesh | `#FFD21A` → `#F5B800` | five chambers and filled centre |
| seed | `#41054B` → `#26002F` | the five seed forms |
| dark canvas | `#0A0A0A` | full-canvas dark export only |
| white canvas | `#FFFFFF` | full-canvas white export only |

The four mark roles use restrained two-stop linear gradients to preserve the
depth of the approved reference. Gloss, shadows, filters, white interior holes,
additional seeds and freehand asymmetry are not part of the identity.

## Favicon contract

- The canonical view box is `0 0 1024 1024`.
- Production SVG metadata sizes are `1024`, `512`, `256`, `128` and `64`.
- Transparent, dark and white files share identical artwork geometry.
- Dark and white variants differ only by one rectangle covering the full view box.
- The smallest current contract is 64 px. A future 16/32 px micro-mark must be a
  separately approved optical simplification, not an accidental edit to this mark.
- Keep at least the built-in 72-unit clear area between the artwork and canvas.

## Raster export contract

- PNG exports cover transparent, dark and white canvases at 1024, 512, 256,
  128 and 64 px.
- JPG exports cover dark and white canvases at the same five sizes. There is no
  transparent JPG variant because the format has no alpha channel.
- Raster assets are generated from the matching SVG variant; they are not
  independent drawings.
- The graphical overview is 1920 × 1080 px in both PNG and JPG.
- `assets/brand/brand-pack/manifest.json` binds every export to its dimensions,
  background, checksum and the checksum of the canonical SVG.

## Existing Fabric product application

The favicon is a brand object, not a functional accent. It may appear in app
metadata, launch surfaces, browser tabs, avatars and brand-led empty space. Do
not use its magenta or gold to encode running, complete, warning or failure
states. Product components continue to consume semantic aliases from
`tokens.app.css`; resting elevation remains fill plus hairline rather than
shadow.

## Existing Fabric component and state rules

- Resting cards and panels use the surface ladder and a one-pixel hairline;
  shadows are reserved for elements that actually float over the interface.
- The one primary action of a task region is gold with dark text; secondary controls keep a
  visible hairline. Focus uses `--app-focus` (gold on dark, readable gold-brown on light),
  selection may use gold, and no brand colour becomes an implicit success or authorization state.
- Controls have 8 px corners (`--app-radius-control`), resting panels 16 px
  (`--app-radius-panel`); state chips and dots stay round (`--app-radius-pill`).
- A state is carried by its word; colour supports it. Never replace `running`,
  `blocked`, `done` or `failed` with an unlabeled brand-colour dot.
- Components consume `--app-*` semantic aliases. They do not reach through to
  stock names in the pack and do not introduce local colour literals.
- Product spacing uses the six-step `--space-1` through `--space-6` ladder.
  Favicon clear space is part of its view box and is not a component spacing token.

## Type, spacing and motion

Fabric interface space, radius, font family and motion come from PassionCode through the app
aliases; the rem-based type ramp still comes from the Paperclip layer, because PassionCode
defines only five fixed sizes. The favicon adds no typography and no motion. On a
brand-led surface, treat the mark as the single loud chromatic object and give
it clear space rather than surrounding it with competing gradients.
