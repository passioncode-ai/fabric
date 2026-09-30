# ADR-0086 — Positioning names teams; the public tools are source-available

**Status:** accepted narrative decision; no identifier, data store or authority boundary changes.
**Date:** 2026-09-29. **Decided by:** the operator, in the PassionCode.ai final-state run of
2026-09-29 (tagline and licence decisions). Amends [ADR-0070](0070-passioncode-toolkit-and-product-design-system.md)
in the two places named below and leaves the rest of it — toolkit hierarchy, Fabric as CEO,
shared design system — unchanged. ADR-0070 itself is not edited.

## Context

ADR-0070 set the positioning to "PassionCode.ai — A toolkit for AI-native work." and described
Fabric Switchboard as an MIT desktop beta. The public site had already moved on: its facts carry
"A toolkit for AI-native teams." and, as its homepage hero, "The agent-agnostic operating system
for AI-native teams." (site `docs/brand/facts.md`, rows `positioning` and `homepage hero`), while
the site's brand pack says the canonical positioning is maintained here. Fabric's narrative gate
(`scripts/check-narrative.sh`) still required the old line and refused the hero line as
"retired single-product positioning", so the two brand packs disagreed and the gate enforced the
wrong side.

## Decision

1. **Positioning:** "PassionCode.ai — A toolkit for AI-native teams." replaces "…for AI-native
   work." on every living surface. "The agent-agnostic operating system for AI-native teams." is a
   canonical line again and is no longer refused by the narrative gate. The category line
   "From vibe coding to passion coding." is unchanged.
2. **Name forms:** PassionCode.ai is the full name. PassionCode is the approved short family label
   in running text (as the site's terminology already states); it is not a wrong form.
3. **Licence wording:** Fabric Switchboard, Fabric Dashboards and the Project Observatory
   dashboard are described as **source-available** — "Source-available under PolyForm
   Noncommercial or Internal Use; commercial license on request." — never as open source or MIT.
   Versions already released under MIT remain available under MIT, and the surfaces say so rather
   than implying otherwise. Each product's own `LICENSE` is the receipt for its terms.

## Consequences

- Canonical facts, terminology, voice, the README, the vision, the domain glossary, the platform
  boundary, the organisation profile source, both guides and the narrative gate move together in
  the change that lands this record; the brand linter's positioning exception follows the new line.
- Dated records (`docs/audit/`, dated plans and reports) and earlier ADRs keep the wording of their
  day.
- Reversal requires a new ADR and the same coordinated update, as ADR-0070 already requires.
