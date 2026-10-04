# Bounded execution packets for COM-06/07

Research-local packet names below decompose the canonical COM parents; they do not allocate
new task IDs or introduce editable status. Root selects/integrates them into the one work
graph. No packet is ready for implementation merely because this file exists. Shared
context: [README upstream requirements](README.md#upstream-requirements-before-com-ui-can-be-safe),
[proposed paths](proposed-paths.md), [COM source](../../evidence/plans/2026-10-04-project-communications.md),
[core source map](../../handoffs/2026-10-04-comms-core-research.md), actual candidate AGENTS,
UX chain and COM01 contract/COM02 storage/COM03 fencing receipts when implemented.

Each implementation packet owns code/docs/tests plus handoff, names candidate SHA and
actual outcomes; independent acceptance is separate. Root-owned global files are serial
integration boundaries. A task receiving an upstream schema change reports affected
path/field/evidence/consequence immediately rather than silently adapting its copy.

## 06.A — Freeze scenario and authority trace

**Owner:** Fabric UX author; **input edge:** accepted COM01 identities/states/actions/limits;
core research supplies participant/restore/fence requirements; root supplies current UX IDs.
**Scope/output:** update `docs/ux/foundation.md`, `flows.md`, `screens.md`, `scenarios.md` and
`product-model.json` under project coordination policy. Use existing ST002/007/030/034/045/048
where adequate; add stories only for uncovered channel jobs. Map every proposed-path edge
to a current COM RPC/result/role. Keep new scenarios draft/unobserved and screens blocked
where contract/ruling remains unsettled. No interface or public copy in this packet.
**Decisions needed:** exact current responder cardinality per capability; archived/restore
read policy; rule-unknown authority; display pause vs policy stop; draft privacy; bounds.
**DoD:** no untraced control or graph-only act; error/empty/loading/offline/revoked/outdated/
unknown/cancel paths accounted. `python3 docs/ux/lint.py`, product sync/report/coverage and
map checks at the integrated source. Inspect next-free IDs before any allocation; no reuse
of research names as canonical IDs. Root applies required map top entry.
**First action:** construct a row per path → story/flow/screen → COM schema/action → authority
→ refusal → planned acceptance; resolve missing contract fields before authoring controls.

## 06.B — Permission, disclosure and intervention review

**Owner:** Fabric UX + admission reviewer; **depends:**06.A and accepted COM03 actor/fence.
**Input edge:** server-authorised roles/actions, artifact visibility and request revision.
**Output:** canonical enrollment/replacement/disclosure/reconciliation/stop flow branches;
a control eligibility matrix in the owning spec, not a frontend permission authority.
**Seams:** extend `AgentAccessPanel.tsx` only if its purpose explicitly gains participation;
otherwise Project settings/detail exposes the new enrollment surface. Product hub grants
stay separate. `shared/readEnvelope.ts` conveys unreadable/stale source; old board question
answer and `board.addTopic` do not authorize participation.
**DoD:** privilege expired while review is open refuses on submit; reader cannot enroll;
replacement previews accepted/unknown held work; no broad retry; no background stale consent.
Test current-eligibility and revocation with contract fixtures before UI implementation.
**First action:** enumerate each proposed control's exact authenticated command and positive/
negative role fixture. An absent command blocks only that control, not core inspection.

## 07.A — One scoped read-only communication list

**Owner:** Fabric main/read + renderer; **depends:**06.A, accepted COM02 query fixtures/COM03
participation. **Input edge:** authorised message projection, cursor/filter binding,
ReadEnvelope, current responder observation; no external product grant reuse.
**Output proposed:** `shared/projectComms.ts` types; narrow API fields/constants in
`shared/types.ts`; bridge in `preload/index.ts`; handlers in `main/index.ts` or owned module;
renderer `CommunicationPanel.tsx`/tests plus existing App Project/Board navigation seam.
These proposed names must be checked against the current tree before creating them.
**Suggested API shape, nonnormative:** `communications.query({projectId, filters, cursor,
limit}) → ReadEnvelope<page>` and `communications.responder({projectId, capability})`;
server derives actor/Estate, validates every Project selection and hides private facets.
Do not forward `feed.replay` unchanged or expose raw event payload to an external consumer.
**States:** loading/complete empty/partial/stale/unavailable/refused/historical/current;
observed times; current responder vs asserted provider label; bounded explicit load-more.
**DoD:** own fixture with two Projects/two Estates; only allowed rows/counts/facets visible;
foreign/missing refs indistinguishable; failed reads not empty; old read completion after
new read ignored; supported old renderer/client APIs unchanged. Tests plant foreign count
and confident-zero defects and fail meaningfully. Browser verifies focus/narrow layout.
**First action:** implement scoped unavailable then successful small page using real COM02
fixtures; root serialises shared API/App changes before next renderer packet branches.

## 07.B — Stable thread detail and reply

**Owner:** Fabric renderer + command owner; **depends:**07.A and COM01/02 admitted reply command.
**Input edge:** typed thread/message refs, participant policy, parent/digest/receipt semantics.
**Output:** exact thread route in `shared/entityRef.ts` plus exhaustive resolver tests;
detail/composer under communication component; new IPC command via trusted main ingress.
`BoardScreen.tsx` link integration only for approved actionable obligations.
**Suggested API:** `thread(ref,cursor)` and `reply({commandId,parentId,digest,body,revision})`;
no caller estate/sender/provider identity. Scope checked again at artifact preview/open.
**DoD:** reading/reply cannot resolve question/task/request; stable draft per Project;
double submit locked synchronously; lost response retries same command; wrong-parent or
old-generation reply refused; untrusted rich body is text/sanitized output; revoke drops
forbidden content without showing hidden neighbours. Browser keyboard, IME and back preserve
context. No native-provider live acceptance claimed from these fixtures.
**First action:** reproduce lost-response-after-append and unauthorized parent reply as RED
before implementation; keep result receipt distinct from stale post-command read.

## 07.C — Request receipts, replacement and unknown intervention

**Owner:** Fabric main/admission + renderer; **depends:**06.B/07.B, COM03 fences and COM04
adapter acceptance. **Input edge:** request/attempt state axes, eligibility/reconciliation
commands, attributed current generation and replacement event.
**Output:** request detail panels/actions, responder history, draft preserved refusal;
command tests exercise current server authority, not button disabling alone.
**Suggested actions:** submit/cancel/reconcile/replace only where COM01 defines them;
no Mark done for unknown effect and no automatic safe retry on generic transport failure.
Use `continuationDelivery.ts` uncertainty precedent without its task-bound identity.
**DoD:** resumed old consumer attempts reply/ACK/renew/complete after takeover all fail;
queued work can reach new responder; accepted unknown work held; cancellation during effect
reports boundary honestly; recorded command+failed refresh does not say failed commit.
Real native Claude→Codex test separately records versions/source/permissions, same Project,
request/thread and historical author; test does not install a release or expose secrets.
**First action:** show a request with admission success + delivery unknown fixture end-to-end;
absence of reconciliation command leaves inspect-only state with precise prerequisite.

## 07.D — Awareness and dependency finding

**Owner:** Fabric COM05 renderer integration; **depends:**07.B and COM05 canonical findings,
current owner routing and work claims. **Input edge:** canonical owner-qualified task refs,
source-qualified evidence, observation age, subscriber ACK, unresolved ruling state.
**Output:** scoped live-work list, important finding detail and exact current owner link;
no new editable backlog, no direct mutation of target Project plan from observer.
**DoD:** future researcher finding visible once to current permitted owner; offline owner
pending; duplicate wakeup/import deduped; read ACK does not resolve finding/obligation;
unauthorised reference redacted; provider replacement re-routes eligible notice preserving
old author. Demonstrate two authorised local Projects collaborating after fixture tests.
**First action:** walk future finding → current owner read → proposed action → independent
result; link each stage to its canonical event/entity and authority receipt.

## 07.E — Historical query and causal graph/list

**Owner:** Fabric read/history renderer + COM10 export reviewer; **depends:**07.B and COM02
cursor/COM10 causal schema. **Input edge:** durable typed edges, safe counts/snippets,
filter/read epoch and redaction/tombstone policy.
**Output:** participant-authorised history query module, pagination, graph projection and
keyboard-equivalent list; exact links routed by `entityRef.ts`; back restores state.
Do not relabel App.tsx's retained500 feed rows complete history. Neither timestamps nor
provider string manufactures edges. Missing usage/cost receipt stays unknown.
**DoD:** restart/replay yields same chain; related-thread links cannot enumerate foreign
Projects; deleted body visible only as permitted tombstone; filter change invalidates
cursor; restore history has no active responder or dispatch eligibility. Long fixture
proves no truncated authority/data silently considered complete. Test graph/list parity
and keyboard navigation before native screenshot acceptance.
**First action:** reconstruct submit → claim → acceptance → reply → replacement from durable
fixture with one explicitly missing edge; verify both views show the gap rather than invent it.

## 07.F — Live refresh, bounded rendering and accessible recovery

**Owner:** Fabric UI/runtime transport; **depends:**07.A/B and cursor/wakeup contract.
**Input edge:** storage watermark, notification-only wakeups, bounded poll/abort semantics.
**Output:** scoped subscription/poll adapter and hook; current read generation/cancellation;
explicit pause-display/new-events/resume; focus-safe pagination before virtualization.
**DoD:** duplicate/out-of-order/drop/restore/cursor-reset fixtures recover from storage;
pause display keeps durable processing live; no stale completion overwrites current state;
failed fetch retains labelled old observation; no every-message assertive announcements.
DOM browser checks plus real Electron VoiceOver/keyboard at actual supported widths,
200% zoom, EN/RU if still supported, themes/reduced motion; logs classify NOT_RUN separately.
**First action:** use slow-old-fetch/newer-current-fetch race plus focused row incoming-event
fixture; only choose ARIA feed after its focused-article loading contract can be observed.

## 06.C / 07.G — Optional Telegram UI, separate acceptance lane

**Owner:** Fabric UX/renderer with COM08/09 transport owner; **depends:**06.B and actual COM08
mapping/outbox+COM09 admitted replies/discussion policy. Not a prerequisite for core board.
**Input edge:** numeric enrollment revision, disclosure preview, mirror mappings, lag/outcome,
origin/echo budget, current policy and allowed actor actions; tokens remain in vault/main.
**Output:** optional transport settings/status and thread origin labels; approved stop/resume
policy controls, channel-specific canonical scenarios. Per-agent bots display attributed
Project identity without becoming authority simply by joining a chat.
**DoD:** board survives transport absent/down; mirror unknown cannot change request completion;
revoked mapping blocks new disclosures; username spoof/private ref refused; echo loops stop;
reply to retired provider routes to Project's current eligible responder; archived bot output
does not bypass restore boundary. Enabled transport rollout owes actual enrolled private chat
receipt; disabled core rollout records optional live tests NOT_RUN.
**First action:** render disabled/not-configured and lost-send-response fixtures before any
live chat. No privileged bot mode may be silently enabled or guessed from obsolete FAQ.

## Acceptance, delivery and conflict boundaries

Core order:06.A →06.B →07.A →07.B →07.C;07.D/E/F can work on isolated modules after stable
schemas/API signatures, then converge once.07.G stays optional. Registry aliases/lease
coordination for developers and COM consumer claims are separate systems.

Write collisions: `shared/types.ts`, `preload/index.ts`, `main/index.ts`, `entityRef.ts`,
`App.tsx`, canonical UX/model/locale files and design map are serial root integration
boundaries. Parallel authors own new bounded module/tests and exchange contracts before
editing shared files. Shared register claim policy applies before edits. Package/migration
IDs reserved at implementation, not inferred from this proposal.

Gate commands at then-current candidate: focused command/module tests, canonical UX lint,
product/model/mockup generation checks, `bash scripts/ci.sh fast`; storage/fence changes
require owned disposable full tier, not operator database. COM14 owns converged adverse
failure acceptance. Browser fixture screenshots carry demo label; real product screenshots
owe built candidate/build provenance, safe data and observed native functionality.
No source push means release, installed bytes, public website or universal policy ACK.

Every task handoff contains exact source/branch/SHA, artifacts, decisions, edge inputs,
commands/exit codes/fixture vs live coverage, exclusions, open blockers and next ready
packet. Root integrates map/source graph/publication once and keeps COM status canonical.
