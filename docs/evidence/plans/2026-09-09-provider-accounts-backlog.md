<sub>ssheleg skills — task-pipeline · ux-scenarios · ux-flows · copywriting · sheleg-design · evidence-docs · agent-sync · maintaining-fabric-workspace</sub>

# Provider accounts — current backlog and automatic switching

Date: 2026-09-09. Operator requested detailed tasks in the **current backlog**, then
specified that cswap-like automatic switching must be available. This iteration adds
requirements, task contracts, dependencies and an updated interactive design; it does
not implement provider authentication, polling or native resume in Fabric runtime.

## Entry point and completed work

[Current queue F5A / M199](../backlog.md#work-m199) is the human entry.
[Engineering catalog](../../architecture/engineering-specs.json) is the detailed task
source; [interactive cards](../../reports/system.html#task-M199) expose every part.
`node scripts/task-spec.mjs M199.auto` prints the automatic-switch task, required inputs,
shared parent contract and UX context. Use any child ID below in the same command.

The earlier [six-packet design](2026-09-09-provider-accounts.md) remains a dated snapshot.
Its no-auto exclusion is overridden by the operator and [ADR-0052](../../adr/0052-provider-account-automatic-switching.md).
[ADR-0051](../../adr/0051-provider-accounts-and-conversation-continuity.md) is retained unchanged.
The living [account contract](../../architecture/provider-accounts.md#automatic-switching)
now includes opt-in automatic switching. Requirement scope is accepted; proposed defaults,
adapter support and future acceptance are not marked implemented.

| Detailed task | What and why | Former packet |
|---|---|---|
| M199.probe | Certify auth isolation and native-resume feasibility before freezing ports. | PA-02 feasibility split out |
| M199.accounts | Optional system login, local account registry, official login/cancel/default/removal with verified identity. | PA-01 |
| M199.auth | Resolve isolated auth context; coordinate CLI refresh and reject conflicting inherited credentials. | PA-02 |
| M199.binding | Pin account at admission and retain distinct Task, TaskRun, Session and native conversation identities. | PA-03 |
| M199.resume | Durable checkpoint, fencing, exact resume acknowledgment and crash recovery without effect replay. | PA-04 |
| M199.usage | Fix the observed profile/quota mismatch and account-blind cache; produce fresh typed observations. | PA-05 usage |
| M199.auto | Enable pool-based automatic selection and execution without per-switch confirmation; bound polling, cooldown and budgets. | new operator requirement |
| M199.ui | Wire setup, manual continuation and automatic policy controls into production read models with clear states. | PA-05 UI |
| M199.acceptance | Verify actual account and native-history continuity for manual and automatic paths with two authorized test accounts. | PA-06 |

Every card contains purpose, concrete work sequence, proposed files/modules, interfaces,
invariants, failure cases, future tests, migration and scope. M199 is a completion aggregate,
not a tenth duplicate implementation. Named edges carry required outputs; M199.usage may
follow M199.auth while resume work proceeds. M169 is cross-provider routing, not a mandatory
prerequisite for same-provider account rotation. S12 recovery conventions are reused where
applicable; M199.resume owns its small operation log and does not wait for a full backup product.

**First next task:** M199.probe. Inspect the exact Claude/Codex CLI builds and auth backends
on macOS with synthetic stores, then record supported/unsupported/unverified capability
receipts. Establish the trusted owner/identity seam before real local account management.
No real credentials are read, imported or switched by this planning iteration.

## cswap

Pinned source fetched in the preceding study:
[`realiti4/claude-swap@7187ce83b444c6af7b61ec8ee092623566a2d8fa`](https://github.com/realiti4/claude-swap/tree/7187ce83b444c6af7b61ec8ee092623566a2d8fa).
The earlier [comparison](../../audit/2026-09-09-provider-accounts.md) records the source and limits.
This additional review inspected README, autoswitch.py and settings.py on 2026-09-09.

| Source evidence | What is present | Fabric task / deliberate boundary |
|---|---|---|
| [README automatic mode](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/README.md#L84) | Foreground auto, one-shot, dry-run; threshold on account-wide and optionally model windows; best and consume-first policies | M199.auto has the same useful controls; one engine shared by UI and scheduler |
| [Settings defaults](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/src/claude_swap/settings.py#L34) | 90% used, 60-second normal interval, 300-second cooldown, 10pp hysteresis; API-key accounts excluded by default | Proposed editable Fabric defaults, not runtime measurements; separate proposed 12/hour hard cap is 3600/300, not claimed as a cswap setting |
| [Auto engine](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/src/claude_swap/autoswitch.py#L1) | UI-independent ticks/events; persisted cooldown/quarantine under a file lock, candidate freshening | M199.auto persists policy and scheduling; M199.auth owns provider-compatible refresh locks |
| [README controls and failure behavior](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/README.md#L99) | Exclusions, quarantine, adaptive polling and treatment of expired credentials; source also describes retained usage during errors | Fabric requires fresh eligible candidate identity/usage and holds on unknown evidence; unreadable quota alone does not authorize moving work |

The source's claim that global switching can run alongside Claude is an upstream claim,
not live acceptance performed here. Fabric keeps per-conversation account bindings and
uses certified checkpoint/resume rather than globally replacing credentials under unrelated
sessions. `next-available` is a selector/manual switch strategy in this revision; auto
strategies are `best` and `consume-first`.

## Integration and requirement receipts

- PA-R01: nine detailed current-backlog child tasks, each addressable by task-spec and the
  system report; canonical parent M199 remains proposed. The machine dependency graph
  and human rows must match.
- PA-R02: automatic switch available as opt-in, explicit pool/scope/enrollment, no second
  confirmation per eligible switch. SCN-088/089 and FLW-53 cover success and recovery.
- The [catalog extension manifest](2026-09-09-provider-accounts-backlog/catalog-extension.json)
  records the new task/requirements separately from the immutable 2026-09-07 audit.
  The checker preserves original coverage and rejects undeclared additions or dropped
  baseline tasks. The old 44/61 queue-progress report remains a dated snapshot; this
  iteration adds work and does not rewrite its denominator or restart stopped automation.
- The new capability fits [vision alignment](../../ux/vision.md): a Project retains its
  purpose, authority and history while an explicitly approved provider account is replaced.

## Handoff and repositories

Owning branch: `codex/foundation-priorities-design-map` in
[Fabric origin](https://github.com/passioncode-ai/fabric). The previous design branch
`codex/provider-accounts-design-20260909` at
[`aafd194d068dade9078cca44cdcc4d5b38b388fe`](https://github.com/passioncode-ai/fabric/commit/aafd194d068dade9078cca44cdcc4d5b38b388fe)
is integrated here with the current queue snapshot. No runtime feature is merged into main.

The [previous repository index](2026-09-09-provider-accounts.md#multi-repository-handoff-index)
records pinned sibling baselines. No implementation branches or changes were created in
fabric-agent-contract or fabric-agent-adapter; their future modules are named in each task.
The published documentation child and parent source are pinned in
[workspace receipt](../../workspace-receipt.json), not inferred from a healthy web response.

Open work: all M199 child implementations and live provider/runtime acceptance remain under
CO-112. This request schedules and describes them; it does not resume the previously stopped
execution loop, schedule recurring tasks or perform a real account switch.

Checks and actual tool roles are recorded in the [iteration receipts](2026-09-09-provider-accounts-backlog/checks.md)
and [generated signature](2026-09-09-provider-accounts-backlog/signature.md).

<sub>ssheleg skills — task-pipeline · ux-scenarios · ux-flows · copywriting · sheleg-design · evidence-docs · agent-sync · maintaining-fabric-workspace</sub>
