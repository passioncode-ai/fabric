# N023 evidence: bounded Git lease snapshot

Source and tests are identified by SHA-256 in [builder receipt](receipt.json) and
[scoped independent acceptance](independent/receipt-final.json). The latter supersedes
the rejected first candidate, preserved in `rejected-first/` and `independent/`.
49 focused tests pass; ten independent probes include three child-process rejection
checks. The first rerun's48/49 failure is retained; concurrent ENOSPC was observed,
but environmental causality is not proven. Same-byte full rerun passed49/49.

From a checkout, run:

```sh
node --experimental-strip-types --test apps/desktop/test/git-lease-snapshot.test.mjs
N023_SOURCE="$PWD/apps/desktop/src/main/gitLeaseSnapshot.ts" node docs/reports/2026-10-13-resource-admission-contract/raw/n023/independent/probes-fixed.mjs
```

The encoding comparison against508 seeded keys used the installed1.22.2 producer
whose digest is in the receipt. That installed package is an external replay input,
not a file delivered in this repository. Default HTTPS authentication, complete
input/scope binding, native execution and all-host acceptance remain unverified.
Every production reader result explicitly denies execution authorization.
