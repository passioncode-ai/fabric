# ADR-0047 — Service feedback separates local learning, consent and durable export

**Status:** proposed · 2026-09-07 · recommended privacy design for review.
**Affected work:** M182, M183.local, M183.upstream, M184, S12, S14, S15.

## Context

The user wants cross-project service insights to improve Fabric, a disable switch,
and no project/person linkage in the reported problem. ADR-0041 specifies closed
categories and service-only export but does not make arbitrary free text anonymous.
Project paths, source excerpts, rare values and transport metadata can still identify
an origin after obvious names are removed. A local toggle also cannot erase a request
that a server has already received.

Evidence: `docs/adr/0041-insights-carry-a-category-and-only-service-categories-ever-leave.md`,
`apps/desktop/src/shared/redact.ts#redactPayload`,
`docs/architecture/retro-and-signals.md`; implementation gaps and pinned external
memory-contract sources are retained in [the catalog](../architecture/engineering-specs.json), M183.

## Proposed decision

1. Keep categories `project | agents | harness | fabric | process`, default project.
   Only agents/harness/fabric are service-export candidates. A process question uses
   `kind=decision, topic=process`; it does not invent an unsupported QuestionKind.
2. Local service-insight collection is enabled by default. **Outbound contribution
   has a separate visible activation choice**, recommended initially off until the
   endpoint and payload contract pass the gates below. The interface does not label
   local collection as an already enabled outbound channel.
3. Default v1 outbound payload uses a closed issue-code vocabulary and only enumerated
   category/capability fields approved by the schema. No raw/free text, file paths,
   usernames, project names/IDs, transcripts, URLs, tool arguments or arbitrary metadata.
   An unmappable issue remains local; it is not squeezed into an `other_text` escape hatch.
4. Local evidence remains richly useful to its estate; a minimized export is a separate
   object with a preview, schema version and consent revision. It is not the source
   of the original problem and cannot become an executable product backlog command.
5. Outbox, consent and suppression live in durable estate-private operational storage,
   not disposable installation preferences. One stable lineage key survives consent
   re-enablement and schema upgrades. Delivery-generation IDs may change; suppression
   identity does not. Opt-in does not automatically backfill suppressed items.
6. Check consent again immediately before dispatch. Opt-out suppresses pending entries.
   If dispatch already happened, status remains `unknown` until receipt/reconciliation;
   confirmed receipt remains `sent`. Remote deletion is a separate request and requires
   a separate server confirmation. Never report deletion or cancellation from local intent.
7. Aggregation reports distinct incident occurrences, not duplicate reports about the
   same occurrence. A repeated model summary is not additional evidence. Local retro
   lifecycle may update/supersede/retire a lesson without deleting its history.

## Activation gates

- Approve an explicit payload schema and enumerate all allowed fields/values; plant
  sensitive canaries through every ingress and demonstrate they never reach the exporter.
- Specify endpoint ownership, authentication or anonymous transport mode, request-log
  retention, aggregation threshold, deletion semantics and abuse controls. Document what
  transport metadata exists; do not claim mathematically guaranteed anonymity.
- Exercise restart during send, lost acknowledgement, opt-out during in-flight request,
  replay after suppression, schema upgrade, settings reset and host move.
- Treat accepted remote entries as untrusted product research. A manager/checker and
  person decide what enters the development backlog; data submission grants no authority.

These gates intentionally separate useful local learning from external activation.
No outbound data is sent by this documentation change.

## Alternatives and trade-off

Automatic free-text export would retain more nuance, but no deterministic identifier
scrubber proves that arbitrary problem prose contains no sensitive detail. Closed issue
codes lose nuance and therefore keep the full evidence locally. A later richer export
requires its own concrete review/consent contract; it cannot be introduced by extending
an untyped metadata field.

## Propagation

On acceptance update ADR-0041's successor references in the index, the terminology and
privacy setting copy, retro/export schemas, local backup manifest and the relevant
UX scenario. Historical ADR-0041 is preserved. The implementing agent must execute this
contract and its activation gates, not decide default sharing or anonymity claims alone.
