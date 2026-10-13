# N027 coherent accounting source evidence

The [builder receipt](receipt.json) and [independent review](independent/receipt-final.json)
accept only source scope:31 focused tests,7 independent probes and the clock-rollback
control pass. Root desktop TypeScript passes on the integrated source, exit0; dependencies
are reused with a drift warning, not a clean-install receipt. Actual SQL is NOT_RUN until
the one owned cluster executes with at least1.5GiB free, preserving the1GiB reserve.
The initial headroom watcher was stopped before it started a cluster; the root combined
gate now owns that shared check slot. No live database is used.

The negative reproduces observation880/maxAge100 becoming apparently fresh under
clock1000→950. The original returns observed and fails; retaining the start time refuses
the rollback. Historical `accounting-before.ts` maps to
`independent/accounting-before.snapshot.txt`. For replay copy that snapshot to an owned
`.ts` beside the unchanged tracked `resourceHostPolicy.ts`, then run the archived
`clock-rollback.mjs` with `N027_SOURCE` pointing at it (expected exit1). The same probe
against the current module passes; `production-probes.mjs` uses that environment too.
Do not execute or mutate source archives in this report directory.

The SQL change preserves every byte of prior pending107 and its publisher read RPC.
The new service-only read uses one snapshot and bounded root materialization. Logical
LIMIT does not establish a hard physical scan/runtime bound. Its digest covers aggregate
contents, not reservation identities, a ledger revision or a fence. No ownership, complete
inventory, native PostgREST transport, active schema or execution authority is claimed.
