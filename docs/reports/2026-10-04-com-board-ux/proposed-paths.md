# Proposed paths — COM-06 decision input

All cases: **Status draft; Coverage none yet; Product unobserved.** Labels below are
research-local case names, not reserved canonical SCN/ST/FLW/SCR IDs or second task
statuses. When accepted, translate into the existing UX contract fields and update the
canonical chain, index, product model and relevant previews in one owned iteration.
Terms below explain behaviour to implementers; shipped copy still requires brand review.

## Shared screen/state requirements

Within existing Fabric shell: Project context → Communications list → exact thread/detail.
Needs you, task Kanban and communication remain distinguishable. One stable ref names each
message/thread/request, not a display label. Detail exposes sender Project, destination,
capability, body/artifacts, permission-safe provenance and separate receipts. Two equal
provider names in different Projects never coalesce. Renderer only submits subject IDs,
command identity/digest and displayed revision; main derives Estate/principal authority.

Every view supports initial loading, complete empty, partial/stale known rows, unavailable,
refused, historical/restored, current, in-flight command and lost-response uncertainty.
Last good data retains its observed time; failed reads cannot assert current responder or
zero pending. No raw credentials, local command arguments or untrusted HTML cross IPC.
Each linked artifact requires its own access check before preview/open.

Stable filters: permitted Project, addressed capability, request state, provider provenance,
time interval and text search. Distinguish request state from mirror state. Facets/counts
must be computed from authorised coverage or displayed unknown. Filter revision binds
cursor; changing Project clears/rebinds private selection and preserves that Project's own
draft. Do not carry a secret-bearing draft into a new Project or hidden tooltip.

## Enroll the first responder

**Persona/Traces:** P-01/P-02; ST-002/045, JTBD-05/08; extend replacement/external access flows.
**Entry/Preconditions:** Project exists; actor may enroll a communication consumer; old
product-call grant or discovered registry agent alone is insufficient.
**Steps:** operator opens Project participation → sees unconfigured, refused or currently
known state; chooses eligible local consumer → reviews exact Project/capabilities, grant
expiry, provenance and replacement consequences; confirms → current authority issues one
generation; successful refresh shows current consumer and observed time.
**Expected result:** one current authorised responder for a selected capability; saved
Project identity unchanged; unrelated capabilities/consumers remain independent.
**Alt/Errors:** no provider/tool capability → actionable prerequisite with no launch promise;
conflicting registrant → show current server receipt; lost response → reconcile command;
revoked permission while prompt is open → refusal; cancellation leaves no enrolled consumer.
**Controls/Acceptance:** keyboard review/confirm/cancel, focus returns to invoking control;
fixture for product binding without communication grant must refuse enrollment. A native
prompt cannot approve an outdated scope or continue behind another application silently.

## Send a request to a Project

**Persona/Traces:** P-01/P-03; ST-007/030/045, JTBD-03/07/08.
**Entry/Preconditions:** sender and target are permitted participants; selected capability
exists; server contract supports request submission.
**Steps:** user drafts objective/context/artifacts → destination and disclosure preview are
visible; submit → only one stable command/digest is used; receipt → display board admission;
later observations separately display claim, delivery ACK, acceptance and result.
**Expected result:** request stays addressed to Project/capability, not provider session;
retrying original payload reconciles the same admission identity.
**Alt/Errors:** no live responder → queued only if contract authorises durable admission;
unavailable storage → retain draft and unknown result; same key changed body → conflict;
unsupported capability → typed refusal; oversized body/artifact → reject before append,
never silently clip meaning; private or foreign artifact → indistinguishable safe refusal.
**Controls/Acceptance:** pending disables duplicate submit synchronously; enter/IME behaviour
matches canonical composer. Browser fixture drops response after append: no second request.
Nonowner reading a destination does not receive execute or other-Project write permission.

## Read and reply without completing work

**Persona/Traces:** P-03/P-01; ST-009/034/045, JTBD-04/07.
**Entry/Preconditions:** permitted thread; visible parent and current participation scope.
**Steps:** open exact thread → messages show original author/source time; choose reply → parent
identity and destination preserved; submit → attributed reply receipt. Optional informational
read ACK is distinct from transport ACK, request acceptance and completion.
**Expected result:** discussion/history changes only by admitted event; reading or replying
cannot silently resolve Board question, task, derived obligation or accepted request.
**Alt/Errors:** revoked body access → redacted existence only where permitted; stale parent or
thread participation → refusal; duplicate imported reply → same event receipt; archived thread
→ read-only or explicit new related request according to policy, never restart terminal request.
**Controls/Acceptance:** composer draft survives permitted refresh/refusal, clears when authority
requires; old-generation reply must fail storage authority even if button remained visible.

## Observe current work and route a dependency finding

**Persona/Traces:** P-01/P-03; ST-004/007/030/034/037, JTBD-02/03/07.
**Entry/Preconditions:** scoped current-work and finding projections from COM-05.
**Steps:** open live work → each row names Project/task/consumer, evidence source and heartbeat
age; researcher submits important finding with affected canonical task refs, evidence,
consequence/severity → permitted current owner sees one addressed item; owner records read/
acknowledgement → finding retains routing evidence and remains unresolved until its own ruling.
**Expected result:** future task research can affect current implementation promptly without
creating a second editable backlog or writing another Project's plan directly.
**Alt/Errors:** absent owner → visible pending recipient status; stale heartbeat → not verified
alive; denied task reference → no hidden name/count; owner replacement → current eligible
recipient with old receipt preserved; unverifiable finding → refusal or clearly labelled claim.
**Controls/Acceptance:** deep link opens exact owner task after scope check. Duplicate notice
must not duplicate finding; display pause does not stop this durable routing.

## Replace Claude with Codex while requests are pending

**Persona/Traces:** P-01/P-02; ST-002/020/045, JTBD-01/05/08; extend SCN-061/096/114.
**Entry/Preconditions:** Project/capability has enrolled responder; replacement authority exists.
**Steps:** inspect current consumer → source/age and pending work are visible; choose replacement
→ preview which unaccepted work is eligible and which accepted/unknown work is held; confirm →
server generation changes; request thread remains stable; new consumer claims only eligible work.
**Expected result:** original authors and accepted attempts remain historical, current generation
is sourced, old consumer cannot ACK/reply/complete/renew new-generation work.
**Alt/Errors:** process seen but enrollment expired → unavailable responder; command conflict →
show winner; source read failed → cannot say stopped/current; accepted effect unknown → held
until reconciliation, not blanket reassignment. No automatic transfer of provider credentials.
**Controls/Acceptance:** two-claimer fixture and resumed obsolete Claude write must refuse;
real native Claude→Codex smoke receipt must show versions, granted scope and persisted history.

## Reconcile an unknown effect

**Persona/Traces:** P-01/P-02; ST-005/018/034, JTBD-02/07; extend SCN-050/067/108/116.
**Entry/Preconditions:** admitted request/attempt has possible effect with no conclusive receipt.
**Steps:** inspect request → committed admission/accepted work remains visible; open attempt →
exact effect boundary and known evidence shown; refresh/reconcile against source → outcome
receipt or unresolved state; authorised ruling records evidence and consequence as new event.
**Expected result:** no automatic resend, second paid/action effect or fabricated success.
**Alt/Errors:** source cannot answer → stays unknown; no ruling authority → inspect only; safe
pre-effect refusal with receipt → same contract-approved retry path; contradictory evidence →
new correction/ruling, never overwrite the old report.
**Controls/Acceptance:** no Retry/Mark done when operation lacks proven safety and authority;
Cancel reports stopping future dispatch, not undoing an already-started effect. Losing focus
or reopening app preserves durable uncertainty and original command identity.

## Search history and follow a causal chain

**Persona/Traces:** P-01/P-03; ST-005/034/048, JTBD-02/07; extend SCN-053/058/115/116.
**Entry/Preconditions:** authorised query/filter cursor; complete history is not App's last500.
**Steps:** query Project/state/time → coverage/freshness and page bounds shown; select event →
exact thread/receipt; follow caused-by, reply-to, delivery-attempt or replacement edge → source
entity; return → original query/selection/scroll retained. Graph and chronological list agree.
**Expected result:** all edges are typed and sourced; same text/time/provider never implies
causation. Missing trace or cost receipt stays unknown; task status comes from task owner.
**Alt/Errors:** source deleted/redacted → scoped tombstone or missing edge; cursor epoch changes
→ explicit restart/catch-up; long history → bounded load more; restore → Historical with no
live claim or mirror replay eligibility; foreign deep link → safe refused without fallback.
**Controls/Acceptance:** keyboard equivalent list for every graph action; focused row retained
while live events arrive; privacy fixture proves no foreign counts/search snippets/cursor deltas.

## Recover a stale or dropped live subscription

**Persona/Traces:** P-01/P-03; ST-004/037, JTBD-02.
**Entry/Preconditions:** subscription negotiated; persisted query/poll is recovery source.
**Steps:** connection drops → keep last observed state and show age; retry/poll catch-up → duplicate
wakeups do not duplicate rows; ordered authorised query advances read watermark; operator
resumes display → buffered new-event count is scoped and focused selection stays stable.
**Expected result:** events are recovered from storage; notification receipt is not completion.
**Alt/Errors:** quota/backlog pressure → explicit omissions and next page; unknown/read refused →
no empty board; filter change → new cursor; cancellation aborts local polling cleanly. Rendering
pause does not pause consumers, delivery, ingestion or clocks.
**Controls/Acceptance:** out-of-order wakeup + restart fixture and old-fetch-after-new-fetch test;
current command result cannot be overwritten by a slower stale read.

## Enroll optional Telegram and review disclosure

**Persona/Traces:** P-01/P-02; ST-007/016/045, JTBD-03/08; new channel-specific path required.
**Entry/Preconditions:** core board works; optional service and numeric chat/topic/actor mapping
exist; grant permits disclosure; vault/token operations remain outside renderer.
**Steps:** configure allowed mirror target → show verified numeric target with user-readable
name as presentation only; preview exactly permitted fields/artifacts → confirm scope/revision;
observe mirror queued/delivered/unknown/failed independently of canonical request lifecycle.
**Expected result:** disabling or revoking Telegram stops future outbound disclosure; no loss
of board messages. Per-agent bot represents project identity, not autonomous access grant.
**Alt/Errors:** no transport → disabled/not configured; send response lost → unknown, never
blind resend; changed chat/topic mapping → new consent; foreign reply or spoofed username →
refused; bot capability off → reason, no silent enabling; deleted external post → provenance
retained with permitted tombstone, no claim its prior readers forgot it.
**Controls/Acceptance:** consent includes privacy/redaction and which history is eligible;
fixture uses neutral IDs, real chat acceptance is a separate private receipt after enrollment.

## Stop a bot discussion without hiding its history

**Persona/Traces:** P-01/P-02; ST-018/045, JTBD-07/08.
**Entry/Preconditions:** optional discussion policy exists and actor may stop the exact scope.
**Steps:** inspect discussion → remaining turn/time/depth budget and origins shown; stop →
server policy blocks new eligible turns; committed prior events remain; pending/unknown effects
shown separately; authorised explicit resume uses a new policy revision.
**Expected result:** echo loops terminate through origin/dedup/budgets; display pause cannot
claim the durable discussion stopped. Stopped session's bot request still targets Project.
**Alt/Errors:** grant revoked → refuse turn; in-flight external effect → possible completion
remains unknown; no authority → inspect only; Telegram down → board remains usable.
**Controls/Acceptance:** adversarial rapid bot replies terminate at configured Fabric bounds;
no operator action implicitly re-enables privileged bot-to-bot settings or expands recipients.

## Accessible inspection and safe return

**Persona/Traces:** all permitted personas; each path above includes equivalent keyboard route.
**Entry/Preconditions:** list/detail and current supported theme/locale/viewport are known.
**Steps:** navigate using keyboard → selected row/context announced; open detail → heading focus;
inspect status/edge/artifact → explicit controls; return → invoking row/filter and draft restored;
new events arrive → polite scoped summary without stealing focus or repeating whole transcript.
**Expected result:** no graph-only action, colour-only state, unreadable empty/loading state or
focus loss when a row leaves current results; paused display and reduced motion remain usable.
**Alt/Errors:** focused item removed/revoked → safe status target receives focus; screen reader
loading completes → aria-busy resets; narrow view → one reading order; manual load more remains
available if virtualized feed cannot satisfy APG focus contract.
**Controls/Acceptance:** real Electron keyboard + VoiceOver each supported language/theme,
200%zoom, supported minimum width, reduced motion and high-volume arrival. Browser/DOM checks
are necessary but do not substitute for native assistive-technology observation.
