# ADR-0070 — PassionCode.ai toolkit and shared product design system

Date: 2026-09-26. Status: accepted direction from the operator’s website, Switchboard launch and design-system request.

## Decision

**PassionCode.ai — A toolkit for AI-native work.** PassionCode.ai is the umbrella brand
and toolkit. **Fabric** is the CEO AI agent for coordinating agents and Projects,
currently in development. **Fabric Switchboard**, short form **Switchboard**, is the
first product selected for public download: an MIT desktop beta for AI-provider account
management with distinct macOS and Windows release links.

This supersedes the public single-product hierarchy in ADR-0018 and the positioning
line carried by ADR-0033. It preserves ADR-0018’s technical kernel boundary, ADR-0033’s
Project-level category and ADR-0057’s CEO name. Historical decisions stay unchanged.
“Fabric the kernel” remains valid in technical contracts. No identifiers, data stores,
app IDs or authority boundaries are renamed by this decision.

One PassionCode design system owns shared tokens and interaction rules. The passion-fruit
mark belongs to the parent brand. Switchboard has a gold **S** on a dark tile. Dark
surfaces, restrained borders and gold action/selection/focus form the shared language;
status colours retain text labels and distinct semantic roles.

The canonical source is the public-site repository’s
[design-system/ at 508e917](https://github.com/passioncode-ai/passioncode-ai.github.io/tree/508e91793fcb79d6a59bd2265551dbc76f7a8f97/design-system).
Products consume or vendor that source with provenance. Fabric’s current runtime tokens
are documented as legacy implementation, not silently declared migrated.

## Scope and evidence

The user explicitly requested the umbrella toolkit, Fabric CEO in development,
Switchboard as first downloadable open-source product, and a common design system with
an S icon. This is a narrative and design-direction change in Fabric. It serves the
vision’s progressive adoption and replaceable-provider principles without changing its
anti-vision or adding a session cockpit to the Fabric runtime.

[Public facts](../brand/facts.md), [terminology](../brand/terminology.md),
[visual guidance](../brand/ui.md), [domain terms](../../CONTEXT.md),
[vision](../vision.md), [UX scope](../ux/vision.md),
[platform boundary](../architecture/passioncode-platform.md), README and the English/Russian
guides carry the distinction. [The launch handoff](../launch/passioncode-toolkit.md)
records exact member commits and publication checks; intent here is not a delivery receipt.

## Consequences and remaining work

The Switchboard release must state macOS signature/notarization and Windows build/native
verification separately. Public availability never implies live-provider or native
Windows acceptance. Fabric stays in development. Its runtime token migration, About/i18n
alignment and native acceptance remain [CO-169](../evidence/specs/2026-08-16-software-fabric-carryover.md).
The current runtime scope recorded by CO-166/167/168 is unchanged.

Reversal requires a new ADR and coordinated updates to canonical facts, public surfaces,
the narrative gate and design provenance; changing one slogan or screenshot is insufficient.
