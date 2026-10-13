# N-021 — concurrent board admission

Incoming `ac874946db2487ab8101464d1abf1e8345eda199` adds board-only joins. Its
join path bypassed the existing per-binding enrollment serializer. Eight simultaneous
retries minted eight sessions instead of one; the same serializer now covers board
and coding admission, retaining separate caps and exact native runtime identity.

[Builder receipt](receipt.json): five new regressions fail before correction; all33
pass after it. [Independent receipt](independent-review.json): all33 plus four
adversarial controls pass; the same independent probe fails original source.
[Patch](n021.patch) applies to [resolved pre-fix source](before.ts).
`adversarial.mjs` accepts a sessionEnroll source path; historical before.ts needs its
relative imports rebased to repository dependencies before running.
[Root merged seam tests](merged-focused.log):117 pass; [merged UI/shared tests](merged-vitest.log)
record the separate Vitest result. Synthetic local functions only; no native provider claim.

The [integration review](incoming-integration-review.json) also found deferred-file
collisions: incoming future migration107 conflicts with this branch's preparation107,
and its unapplied carryover patch uses CO282 for an unrelated row. Neither deferred
patch nor active DDL is applied. Canonical CO282 stays partial; migration order must
be reconciled with the source owners before activation. Names under pending-migrations
are preparation names, never reserved active ledger positions.

[Normalization manifest](normalization.json) retains original and stored artifact hashes.
