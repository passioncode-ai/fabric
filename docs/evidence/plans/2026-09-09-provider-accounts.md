<sub>ssheleg skills — ux-scenarios · ux-flows · copywriting · sheleg-design · evidence-docs · agent-sync · task-pipeline · maintaining-fabric-workspace</sub>

# M199 — Provider accounts: design and implementation handoff

**Entry point for the next agent.** Date: 2026-09-09. Status: proposed design;
product implementation and live A→B→A acceptance remain open under CO-112.
Operator request: design optional provider account connection and switching without
losing conversation, following the [pinned Orca/cswap comparison](../../audit/2026-09-09-provider-accounts.md).

## Reviewable result

[Accounts prototype](../../reports/product.html#view-provider-accounts),
[conversation switch](../../reports/product.html#view-account-switch),
[full journey](../../reports/product.html#journey-PJ-36),
[proposed contract](../../architecture/provider-accounts.md),
[ADR-0051](../../adr/0051-provider-accounts-and-conversation-continuity.md).
Canonical scenarios SCN-081–087, flows FLW-50–52 and screens SCR-62–63 remain draft/
designed, Coverage none yet, Product unobserved. The fixture cannot authenticate,
spend credits or restore a real CLI process.

The first slice targets Claude Code and Codex, using official CLI login on the
execution device. System default remains optional. Default selection affects new
conversations; explicit switching keeps the native conversation and open Task but
creates a new Session/TaskRun after a certified boundary. Unsupported resume remains
unavailable; a separate context handoff must be named as a new conversation.

**Concrete review choice:** pin existing conversations, and require verified restart /
resume for an explicit account switch. No global credential replacement and no automatic
quota-driven account rotation in this slice. ADR-0051 is proposed, not marked accepted
by the act of designing it. No accepted domain vocabulary is reversed.

## Sources and integration baseline

- [Research source commit d2a84b1](https://github.com/passioncode-ai/fabric/tree/d2a84b15b690636cb838dca1f921a0be421111c2): account gaps and synthetic quota probe.
- S09 baseline is merged from [`32bfe67933bb259f2dd6d9fdeed56ae65e076ef1`](https://github.com/passioncode-ai/fabric/commit/32bfe67933bb259f2dd6d9fdeed56ae65e076ef1). Its membership floor is included; application sign-in remains unimplemented. This is not a claim that S09 fully supplies trusted human authentication.
- Existing [system contract](../../architecture/system-contract.md) defines TaskRun, Session, explicit admission and native reuse constraints. `apps/desktop/src/shared/taskRun.ts#RUN_OUTCOMES` supplies cancellation/unknown outcomes; no new TaskState is introduced.
- [Map](../../reports/map.html#provider-accounts-design) is the living entry; [CO-112](../specs/2026-08-16-software-fabric-carryover.md) remains the single deferral home.
- [Brand voice](../../brand/voice.md), [terminology](../../brand/terminology.md), [facts](../../brand/facts.md) and existing paperclip/app tokens inform the prototype. Design settings: structure 4/10, motion 1/10, information density 6/10. Existing typography, components, dark/light tokens; no new visual direction or motion.

## Packets

All packets belong to **proposed M199**, not an automatic promotion over the active
foundation queue. Shared module/contract context for every packet:
[provider accounts](../../architecture/provider-accounts.md),
[system contract](../../architecture/system-contract.md),
[agent contract schema](../../architecture/engineering-specs.json),
[SCN-081–087](../../ux/scenarios.md), and `node scripts/product-spec.mjs M199`.
Each packet must preserve existing Session/TaskRun authority and journal ordering.

| Packet / owner | Prerequisites | Concrete output | Acceptance / falsifier |
|---|---|---|---|
| PA-01 · Fabric main / local account store | trusted principal seam (S09 floor alone insufficient), provider adapter capability inventory | opaque account/runtime IDs, redacted read model, versioned default selection, login staging/cleanup, dependency-safe removal; no credentials in shared storage | duplicate subject, cancellation, expired login, revoked principal, runtime offline, in-use delete and secret-leak probes; a real provider secret in a fixture is a failure |
| PA-02 · fabric-agent-contract + fabric-agent-adapter | PA-01 IDs and secret reference schema; versioned compatibility contract | per-runtime identity/login/context/refresh ownership ports; supported/unsupported/unverified capability receipts for Claude and Codex | conflicting env scrub, macOS Keychain vs config resolution, CLI-compatible concurrent refresh, external writer conflict; no certified isolation → capability unavailable |
| PA-03 · Fabric admission/session + adapter | PA-01–02; M188 TaskRun config and admission; selected task/native identity | pinned ConversationBinding, account/default resolution, native ref capture, per-conversation writer fencing and isolated child environment | default B leaves session A unchanged; account revision drift blocks dispatch; same-provider conversation resume eligibility explicit |
| PA-04 · Fabric switch coordinator + adapter | PA-03; S03 effect-outcome reconciliation; S12 recovery primitives where available | persisted SwitchOperation and checkpoint manifest, confirmed boundary, stop/spawn intent, native resume ack, CAS binding commit, rollback/reconciliation | busy cancel before stop; crash at every transition; revoked rights during preparation; same operation cannot spawn twice; unknown stop cannot start target |
| PA-05 · Fabric quota + UI | PA-01–03; SCN-081/082/086 | usage keyed by resolved identity/runtime/auth revision; account setup/read models; current session account control with explicit scope | reproduce then fix both research-probe failures; no A data under B, unknown quota stays unknown, login/default does not impersonate a switch |
| PA-06 · Integration acceptance / releases | PA-04–05, authorized two-account test environment and certified native adapter | live A→B→A evidence for each provider/CLI/runtime, UI failure recovery and safe migration from system default | native identity + conversation markers + no duplicated effect + other session unchanged; intentionally wrong identity/resume ack fails the gate |

A read-only PA-02 feasibility spike establishes the port shape before PA-01 implementation; this does not require a working account store. PA-01 and then PA-02 implementation come first. PA-05's usage seam can follow the auth-context
contract without waiting for all recovery UI; **native continuation cannot ship before
PA-04 and PA-06**. S12 and M169 remain adjacent owners rather than substitutes for M199.
No estimates or runtime support promises are inferred from the two upstream repositories.

## Multi-repository handoff index

| Owner / remote | Branch / baseline | Status | Entry / next task |
|---|---|---|---|
| Fabric · [origin](https://github.com/passioncode-ai/fabric) | `codex/provider-accounts-design-20260909`; committed source addressed by publication receipt | design authored; no runtime account implementation | This file; begin PA-01 after reviewing ADR-0051 and capability feasibility |
| [fabric-agent-contract](https://github.com/passioncode-ai/fabric-agent-contract) | baseline `1eeb5a302518a25af4c3ef82f1942aa3288bc9b9`; no task branch | PA-02 proposed, unpublished | Read contract above; inspect the sibling's own AGENTS and registry before defining ports |
| [fabric-agent-adapter](https://github.com/passioncode-ai/fabric-agent-adapter) | baseline `5d2ccd7a124d7052f743529d8dcf0caf294bfdfd`; no task branch | PA-02/03/04 proposed, unpublished | Certify identity, refresh and native resume by exact CLI/runtime before exposing supported capability |
| Private workspace · existing configured remote | `main`; source/workspace SHAs in [publication receipt](../../workspace-receipt.json) | publication verified separately from product acceptance | [Publication contract](../../architecture/report-workspace.md); no production dependency pins changed |

The sibling repositories have no delivered changes or new branches in this iteration.
Do not treat this central index as a claim their contracts have already been extended.

## Verification and limits

Executed checks and captured outputs are in the [verification receipt](2026-09-09-provider-accounts/checks.md). The fast gate and browser fixture checks passed; existing brand/design warnings remain. Model consistency checks prove registry coverage and
addressability, not behavior of a CLI. Browser checks exercise the **generated report**
and its fixture state, including A→B→A, busy/cancel, failed resume, unknown outcome,
usage attribution, deletion, no cross-project substitution and responsive layouts.
The existing [synthetic runtime probe](../../audit/2026-09-09-provider-accounts.probe.mjs)
continues to document the unfixed quota gaps. No real account was imported or switched.

Open work: all PA-01–06 runtime work, trusted application identity, provider/runtime
certification, scoped live account acceptance. Same CO-112 owns these deferrals; the
prototype and this design do not close it. First next task: validate PA-02's auth-isolation
feasibility for macOS Claude and Codex against the installed CLI builds, using synthetic
stores first; record capability unsupported until identity/native resume are measured.
Then implement PA-01 with the agreed port shape and the repository's delivery route.

## Actual tools

[Generated skill signature and individual roles](2026-09-09-provider-accounts/signature.md).
The routing instructions were read from `AGENTS.md` and `docs/AGENT_SYNC.md`; the design
reused the existing paperclip system. No alternate design direction was commissioned.

<sub>ssheleg skills — ux-scenarios · ux-flows · copywriting · sheleg-design · evidence-docs · agent-sync · task-pipeline · maintaining-fabric-workspace</sub>
