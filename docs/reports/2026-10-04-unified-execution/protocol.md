# Cross-task findings and dispatch protocol

## One plan, one status owner

ADR-0101's canonical backlog remains the authority for delivery state. This snapshot is a dispatch design, with source digests, dependencies and decision/implementation distinctions. `next` emits candidates, never an execution grant; first acquire a task lease and the resource claims for guarded edits, in an isolated worktree. Reconcile source freshness before dispatch.

## Message contract

Every researcher immediately sends the root coordinator and affected peer: impact id, discovered fact + source, affected canonical ids, severity (blocking/advisory), exact contract or assumption invalidated, recommended action, and confirmation criterion. Live collaboration.send_message is used during this run; future agents can use their coordinator's mailbox. A session mailbox is not durable evidence: the coordinator promotes messages into impacts.json and the next tracked plan revision.

Blocking finding → affected task stops before its next effect, coordinator records a disposition, and the recipient acknowledges the corrected contract and source revision. Silence, elapsed TTL, a delivered message or a successful test on old code is not acknowledgement. Advisory finding → record and inspect at next packet boundary. A packet's `impacts` output is checked before execution. An unresolved blocking impact removes affected task from `next`.

## Shared files and authority

Research agents write disjoint files only. Root owns plan.json, shared brief, backlog link and map. Product implementers use separate branches/worktrees. Shared registry edits require task lease + exact resource claim. Convergence reviews every combined diff before integration; complete source checks then commit/push. Existing human release environments, source-system mutations and private commercial publication remain gated in their owning contract. Research output or peer opinion grants no new external authority.

## Recovery and source change

`check` validates source hashes, coverage, packet context, dependency shape and impacts. `next` sorts by canonical Now priority first, then computed number of downstream packets, then id; no model-dependent ordering. `packet ID` prints the program constraints and exact leaf content together. Unknown ids, cycles, missing references and changed canonical files fail. A source change requires reconciliation and a new dated version before dispatch. Completed implementation evidence is added only to its owning source; a research packet never closes that row.
