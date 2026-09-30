# Task brief — federation-filing

> Stage-0 intake artifact, run `2026-08-28-federation-filing`. Operator instruction:
> file it, given against the explicit filing tables of design passes 4–6 (members,
> federation, federation architecture) and the runner-agnosticism assessment, all
> reviewed in the same session.

- **Date:** 2026-08-28
- **Task (one line):** file the federation decision — the product branch chosen
  deliberately under ADR-0011's own reversal condition — as ADR-0016 and ADR-0017,
  the `federation.md` design document, the vision and glossary propagation, seven
  carry-over rows and four milestones.
- **UI verdict:** no UI is built in this run; the member-surface UX work is recorded
  as a milestone and a consequence, not designed here.
- **Coordination:** lease `FEDERATION-FILING`, branch `feat/federation-filing`,
  reserved ids ADR-0016, ADR-0017, CO-068…CO-074.

## R-001 fires — the propagation inventory

ADR-0016 changes hierarchy and ownership (Estate becomes the organization object;
owners gain cardinality N; the platform holds many estates), so retro rule R-001
requires every intent surface inspected in this run:

| Surface | Action here |
|---|---|
| `CONTEXT.md` | Estate definition evolves; new nouns: Person, Membership, Owner, Member, Interaction point |
| `docs/vision.md` | "The sentence" gains the federation paragraph; "Not a hosted product" bullet superseded in place with a pointer; two amendment rows |
| `docs/architecture/federation.md` | new — the canonical design (planes, member model, delegation, data, memory sharing, access) |
| `docs/adr/README.md` | two index rows, next-free bump |
| `README.md` | status paragraph + federation row; derived-surface rows marked as pre-federation snapshots |
| `docs/evidence/backlog.md` | M38–M41, decided-unscheduled |
| schemas / UX sources | structurally unaffected in this run; named in ADR-0016 consequences (estate_id enters at migration time; member-surface UX is M39) |
| derived HTML (overview, architecture-map) | not rebuilt; README rows now date them as pre-ADR-0016 snapshots, and both pages already state that the files win |

## Requirements

| ID | Requirement | How it's verified | Status |
|---|---|---|---|
| FF-REQ-001 | ADR-0016 recorded — the platform of estates: product branch chosen under ADR-0011's reversal condition, four prices paid line-by-line, tenant = estate; closes CO-058; supersedes ADR-0011 | file + index row; links resolve | open |
| FF-REQ-002 | ADR-0017 recorded — the federation seam: slot = capability, delegable as a point property, accountability non-delegable, artifact-only aperture, A2A v1.0 transport, Part-compatible artifacts | file + index row | open |
| FF-REQ-003 | `docs/architecture/federation.md` — planes, resolution order, interaction points, memory-sharing matrix, access stack, decision table, sequencing | file exists; README row; links resolve | open |
| FF-REQ-004 | CONTEXT.md and vision.md propagated per the R-001 inventory above | grep sweep finds no un-superseded "one operator"/"not a hosted product" claim standing alone | open |
| FF-REQ-005 | CO-068…CO-074 appended (hosting model; per-estate vault reopening CO-047; delegated-slot billing reopening CO-048; identity + app_metadata/revoke rule; interaction-point SLA policy; CO-040 live; runner conformance matrix); next free CO-075 | ledger rows present | open |
| FF-REQ-006 | M38–M41 in the backlog, decided-unscheduled, sequencing rule stated | backlog rows present | open |
| FF-REQ-007 | Checks green: schemas script, link resolution, `git diff --check`, propagation grep | command outputs in run log | open |
| FF-REQ-008 | Verification rows; retro stamped with **R-001 fired**; record → board --mirror → merge --key → push; lease released on every path | status clean; MERGES row | open |

## Scope out, deliberately

The mesh-review ADR candidates (extensibility law, knowledge pack as fabric-side ADR)
stay unfiled — their doctrine shipped upstream into `agent-stack` 0.14.1 and the
fabric-side record is a separate decision. Upstream items (contract profile `human`,
"estate as provider" A2A profile, conformance tiers) belong to the contract repository.
No schema, no code, no UI in this run.
