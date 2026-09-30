# V1 workspaces use a constrained responsive grid

- **Status:** Accepted
- **Consequences / affects:** `docs/architecture/passioncode-platform.md`,
  `docs/ux/foundation.md`, `docs/ux/flows.md`, `docs/ux/screens.md`,
  `docs/ux/scenarios.md`, future layout schema and host UI
- **Source:** operator, 2026-08-29 — resolves CO-076 and completes ADR-0020's open
  interaction-model choice

Owner and role workspaces use a host-owned constrained responsive grid, not a free-form
canvas.

1. Every tile occupies a rectangular set of host-defined tracks and one of the admitted
   size ranges declared by its view contract. Tiles cannot overlap, rotate, float on a
   z-axis or persist arbitrary pixel coordinates.
2. Add, remove, reorder and resize operate only inside those constraints. Invalid
   collision, minimum-content, scope or focus states block publication and name the tile
   and recovery.
3. The canonical reading/focus order is stored separately from visual coordinates and is
   keyboard-editable. Responsive reflow never changes the semantic order.
4. Narrow layouts linearize the same ordered tiles and select an admitted span/height;
   they do not shrink a desktop canvas. A provider's structured fallback remains
   available when its interactive view cannot meet the viewport or host capability.
5. Layouts are immutable revisions scoped to Estate + Project + Role. A role starts from
   a host template; an owner may fork and publish a new revision. Existing sessions move
   only after authorization and validation of that revision.
6. Providers describe minimum/maximum spans, content constraints and fallback; they do
   not place themselves or mutate another tile.

Free-form spatial canvases may later exist as a separate purpose-built surface for jobs
that genuinely depend on spatial relationships. They are not a mode switch inside the
v1 operational workspace.

Still open for visual/schema design: column/track count, breakpoints, exact span presets,
host templates per role and conflict-rebase UI. Those values may vary without reopening
the no-overlap, canonical-order, narrow-linearization and immutable-revision contract.
