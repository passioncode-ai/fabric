# AD01 — source-bound adoption contracts

Objective: bind the approved progressive-adoption plan to actual producers before new native ports are implemented. Base/source inspected: [c1fb56125c28f14de88191e7ffb162b7eb0eed72](https://github.com/passioncode-ai/fabric/commit/c1fb56125c28f14de88191e7ffb162b7eb0eed72). Input: [AD00 passed pure receipt](../receipts/AD00.json). This source review does not grant runtime readiness.

## Completed and decisions

[The matrix](../contract-bindings.json) binds eight capabilities: creation, source observation, context return, conversation, attention, execution, cycles and personal adoption. `node scripts/check-adoption-bindings.mjs` reports 79 distinct symbol/handler/comment anchors across 50 committed files, six partial capabilities and two missing; none ready. File hashes are checked against the immutable source, not silently refreshed from the worktree.

[ADR-0061](../../../adr/0061-project-setup-precedes-managed-activation.md) accepts saved setup before managed activation. Exactly one admitted PM is required for managed activation; existing manual capabilities retain their own gates. A developer selection is not PM assignment. Blueprint of configured organisation remains distinct from partial setup. Existing accepted ADR history is unchanged; broad ADR-0046 remains proposed.

One canonical `Scope`, `EntityRef`, journal, Project/Task/Agent store and local-state mechanism remain authoritative. Missing ports name their future owners and exact per-packet prerequisites in [contracts](../contracts.md#exact-dispatch-prerequisites). ST001/JTBD01/JRN01/SCN001/031/FLW01/SCR02 are qualified consistently; runtime coverage is not promoted.

## Scope expansion and checks

Packet AD01 originally named the two contract documents. Resolving its required PM contradiction necessarily includes `CONTEXT.md`, new ADR0061/index and canonical UX files above; the new matrix and source checker prevent an unverified proposal becoming a producer. `scripts/ci.sh` runs the new checker/tests. Generated model/report/previews and the living map are serial integration outputs. The existing pipeline reservation gate requires its unexecuted ADR to remain next after the newest actual ADR: creating ADR0061 exposed that dependency, so the guarded pipeline plan reserved ADR0062 through agent-sync; no historical ADR or migration was changed. No production database schema, provider or IPC is changed in this slice.

- `node scripts/check-adoption-bindings.mjs`: exit 0, source-only integrity; no runtime acceptance.
- `node --test scripts/test/adoption-bindings.test.mjs`: 30/30; injected missing producer, moved declaration, hash drift, unknown field, unsupported readiness and duplicate canonical authority are rejected. These are negative validator probes, not claims that a native provider was exercised.
- `node scripts/check-registers.mjs`: exit 0 after fixing an ADR-index table blank line introduced during authoring.
- Existing matrix initially cited a historical comment as `IPC.attentionList` handler. The strict check rejected it; verified live handler is at source line 2634 and the matrix was corrected. No source hash was changed to hide the mistake.
- Model/report/coverage regenerated. Independent semantic review completed in two rounds: fixed an accidental string-only revision proposal to preserve producer-owned numeric/string types through R/B, and made Save setup/cancel explicit in FLW-01. Round 2 found no remaining bounded blocker; source checker and 30/30 tests passed. Final fast CI outcome belongs to the subsequent immutable AD01 receipt.

## Remaining and exact next task

AD02 remains blocked on native Computer Use permission acceptance; real renderer/disk regressions pass, but this does not satisfy its native output. AD04 must not consume AD02 as passed. Native command atomicity/ACL/voice/activation/migration are implementation work retained under CO-167, with exact prerequisites in the contract; they are not implied by ADR0061.

After this source iteration is committed, add the immutable AD01 receipt. Then AD03 may implement the unified target create journey using AD00/AD01 inputs: one page-local draft authority, old route aliases, normalized idea source before duplicate lookup, optional advanced setup, exact Help resume and immutable reviewed payload. Native and prototype proof remain distinct. No member repository branch or pin was changed.

Rollback: revert the new contract consumers and UI target amendment together if the decision is reversed through a new ADR. Do not edit old ADRs or delete saved Projects/drafts. The source matrix is historical evidence pinned to its commit; later producer changes require a new inspected binding revision.

## Source acceptance receipt

Source committed as `375b18db59c12124204c5e7273a9bfecc1053fcf`. Final `bash scripts/ci.sh fast`: exit 0, fast tier green; stack-backed probes not run. [AD01 source receipt](../receipts/AD01.json) records the exact input and write set. Native partial/missing states remain unchanged.
