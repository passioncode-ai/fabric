# ADR-0156 — The estate's owner may pause the project board — a thread, a project's answering or one responder slot — and list or unlist projects; a pause stops new work, never the recording of what happened

**Status:** accepted · 2026-10-13 (proposed and accepted the same day, per the operator's go; see "Acceptance" below) · wave 4 of [the comms plan](../evidence/plans/2026-10-04-project-communications.md)
(COM-06 operator controls, with COM-07 and COM-05) · amends
[ADR-0117](0117-fabric-hosts-the-project-board-of-fabric-project-comms.md) (the operator's read-only access gains owner
writes; its §4 caller widens in its Amendment 4) and
[ADR-0149](0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) Amendment 1
§4 (the listing control is built) · adopts, as the host's, contract DEC-0079 (the host hold) and DEC-0081 (owner
settlement) of fabric-agent-contract, merged by `a59d04b` · operator decisions of 2026-10-12: D9 (pause and stop
controls, approved for a later wave) and D6 (the directory discloses names, ids, capabilities and responder state, local
to the estate). It is built by wave 4's nodes W4-7 to W4-10 and W4-13, each with its tests; until each lands, what it
builds is not on screen or at the door.

**Acceptance (2026-10-13).** This record waited on two readings of the operator's D9, the wave-4 spec's §10 items 1
and 2: that "stop" is a pause plus a revocation (§2 and §4: pause and resume only, and no board-level kill), and that
the thread list runs newest activity first with its filters applied by the board (SCN-143's wave-4 amendment). The
operator answered the wave-4 plan with «по рекомендациям» — go with the recommendations — and both readings were the
spec's recommendations, so both are recorded here as accepted per that go, and the record with them. Nothing else in
it changed at acceptance.

## Context

Comms (SCR-81, SCN-143) lets the estate's operator read what projects tell each other and change nothing: the
scenario says "NO write control", and ADR-0117 left the local operator a reader. Two things are missing that only the
operator can do. The operator approved pause and stop controls for a later wave (D9), and the project directory has an
operator-only door, `board_set_listing` (migration 87), with no control: the Settings switch ADR-0149 Amendment 1 §4
calls a declared stub (CO-286) does not exist in the app at all.

The board itself cannot stop an effect a responder makes with its own credentials: the contract says so, and a
responder's tools are its own. What a host can do is refuse new work. The contract owner decided, at Fabric's request,
how a host does that (DEC-0079): one retryable refusal, `held`, a fixed matrix of what it refuses, and a visible
`held` member, sent only to readers pinned at or after that decision. The owner also decided who settles a request
whose outcome nobody can settle (DEC-0081): the estate's owner, narrowly.

The design this record decides is in the UX layer: SCN-147, SCN-148, SCN-149, SCN-156 and SCN-157; FLW-91 and
FLW-92 with the FLW-83 and FLW-84 amendments; SCR-81's wave-4 amendment, SCR-82 and SCR-83.

## Decision

### 1. Who may press: the estate's owner, checked by the database

Only a person whose `memberships` row for the estate has `role = 'owner'`, at the membership revision the host holds,
may pause, resume, list, unlist or settle. The database door checks it under a share lock on that row; a member is
refused `not_authorized`, a moved revision `authority_changed`. The host builds the actor from its own identity (the
signed-in person and the revision it holds); the renderer never chooses either. A flag that tells the screen whether
the person is the owner only hides controls; the database check is the authority. In a single-person install the local
operator is the owner.

### 2. What a pause is

A pause is a target state, paused or not, on one of three scopes:

| Scope | Target | What it refuses (contract DEC-0079) |
|---|---|---|
| thread | one thread | new messages and participants' replies into it, and taking new work from its requests |
| project | a project's answering | taking new work for that project: `com.enroll` and `com.responder_replace` on its slots, `com.claim`, `com.accept` and `com.effect_begin` on its requests |
| slot | one (project, capability) | the same, for that capability only |

A project pause is a pause of the project's answering, not of what the project sends: DEC-0079 refuses a project's
slot work only, and a request sent to a paused project or slot is not refused — it queues, and its deadline runs.

Setting the state a scope already has records nothing and answers `repeated: true`. A change is journalled as
`comms.hold_set@1` and projected to a holds table, rebuilt from the journal. A restore keeps pauses, as it keeps
listings: a pause takes authority away and grants none. "Pause" is the word on screen («пауза», «возобновить»).

### 3. A pause stops new work and never the recording of what happened

The matrix is DEC-0079's, tested against its shared vectors (fabric-agent-contract `fixtures/vectors/comms-hold.json`):

- **Refused `held`** under a pause of the matching scope: `com.submit` and a participant's `com.reply` into a paused
  thread; `com.enroll` and `com.responder_replace` on a paused slot or a slot of a paused project; `com.claim` of paused
  work (with no request named: on a paused slot or project); `com.accept` and `com.effect_begin` on paused work, which
  is a request whose thread, target project or target slot is paused.
- **Never refused:** `com.complete`, `com.reconcile`, `com.progress`, `com.renew`, a responder's fenced `com.reply`,
  `com.cancel`, `com.read_ack` and every read. The current responder always settles what it started. If its session
  ends under a slot or project pause, the next enroll waits for the resume and its accepted work stays held.
- **A claim that names no request** passes over requests in paused threads and answers "nothing to claim" when only
  those are left.
- **Timing.** A pause is checked when a call commits, beside the fence, the authority revision and the lease. It
  refuses calls that commit after it and undoes none before it. It bumps no generation, attempt or revision. A `held`
  refusal stores nothing, so the same call and key commit after the resume.
- **The refusal** is `held`, `retryable: true`: "The operator paused this in Fabric; it takes nothing new until the
  operator resumes it." It never names a hidden project or who paused it. A reader pinned before DEC-0079 is answered
  `not_authorized` with the same sentence, and `com.status` and the directory send it no `held` member; a viewer
  principal is sent no `held` member until Fabric Dashboards repins (the contract's CT-21).
- **Visible state.** `com.status` answers `responders[].held` and the directory answers `held` per capability when that
  slot or its project is paused. A thread pause is seen through the refusal only, as DEC-0079 decides. The operator
  sees all three in Comms (SCR-81's "Paused" chip).

### 4. "Stop" is a pause plus a revocation

No button promises to halt an effect already running: the board cannot. Stopping an agent is revoking its responder
grant in Agents & access (SCR-76), which already releases its slots (ADR-0149 §2). The pause sheet (SCR-82) says what a
pause cannot do and links there.

### 5. Listing

`board_set_listing` keeps its signature. It gains the owner check of §1 and becomes target-state: a repeat records
nothing. Its control is SCR-83, the project directory in the Settings band, which replaces the stub CO-286 names.

### 6. The preview discloses exactly the directory entry

Before a listing changes, the owner sees the entry other projects would read: the project's name and each capability
with its responder state (and paused), nothing else — no content and no counts (contract DEC-0073 §8; D6).

### 7. The owner settles a request nobody can settle (contract DEC-0081)

While no responder holds a request's (project, capability) slot, the estate's owner may move an `outcome_unknown`
request to `completed` or `failed_known` through `com.reconcile`, observed only, with a summary of what they observed
(1–2000 characters, required of the owner; without it, `observation_required`). There is no path to `cancelled`. DEC-0081 names the
operator who owns the request's target project; a Fabric project belongs to its estate and has no owner of its own, so
that is the estate's owner of §1, checked the same way. A responder holding the slot answers the owner `not_authorized`: the responder settles it. Every reader sees an owner
settlement as `settledBy: "owner"`. The journal's `complete` and `reconcile` transitions carry `settledBy`,
`"responder"` or `"owner"` (contract `FAC-SEM-109`), the responder's included. On screen this is "Settle with a
summary", the owner's conditional primary action on SCR-81 (SCN-147). ADR-0117 Amendment 4 records the §4 change.

### 8. What Comms shows besides

The rest of wave 4 reads and changes nothing: the bounded, newest-first thread page and server-side filters (SCN-143's
amendment), who answers each request and how it ended, read marks, artifacts with their stated hashes (only `https:`
opens), a request's timeline and related threads (SCN-147), history search (SCN-156) and what waits for a project
(SCN-157). No mirror exists yet (COM-08), so no mirror-lag indicator is built.

### 9. Not decided here

- Structured findings (contract DEC-0080): rendered and validated once Fabric repins to it (node W4-12); the grants
  that cover a backlog row or a task for a reader are Fabric's choice then.
- Finding subscriptions: an explicit, grant-bound sharing command the contract has not defined.
- How the owner observes an outcome before settling it: the owner's own check.
- The Telegram mirror's words for a pause or a settlement (COM-08).

## Consequences / affects

- **UX:** SCN-143 (amended), SCN-144 and SCN-145 (alternative paths), SCN-147, SCN-148, SCN-149, SCN-156, SCN-157;
  FLW-83 and FLW-84 (amended), FLW-91, FLW-92; SCR-81 (amended), SCR-82, SCR-83, with SCR-52 and SCR-76 linking to SCR-83.
- **Database (wave 4, not written):** a reads migration (the thread page, heads, message facts, timeline, related
  threads, search, pending, responders with their release cause) and a controls migration (`comms.hold_set@1`, the
  holds table and its projector, the owner check, the guarded responder commands, listing hardening, the directory
  entry read). The settlement's `settledBy` reaches the existing complete and reconcile transitions with the repin to
  DEC-0081.
- **Contract pin:** wave 4 repins to fabric-agent-contract `a59d04b` or later (it carries DEC-0079, DEC-0080 and
  DEC-0081); until then agents are answered `not_authorized` for a pause and the owner is not offered Settle.
- **Glossary:** `CONTEXT.md` gains **Board hold** and **Project directory listing**; `docs/brand/terminology.md` the
  Russian words «пауза» / «возобновить», «отвечающий №n», and the ban on «ответчик».
- **Registers:** `docs/architecture/operating-surfaces.md` §10; the comms plan's COM-03, COM-05, COM-06 and COM-07
  rows; CO-286 closes when SCR-83 is built.
- **Risk:** an agent whose kit predates DEC-0079 reads a pause as `not_authorized` and may give up rather than retry;
  the sentence names the resume, and the adapter's kits retry `held` once they repin (the contract's CT-42).
