# N025 publication evidence

The [offset correction receipt](offset-correction/receipt-offset.json) pins the current
publisher/test source. Earlier [binding receipt](receipt.json) and independent rejection
history remain immutable; their hashes do not certify the later timestamp correction.
The first candidate allowed incompatible disk policies under one human revision.
A complete validated-policy digest now supplies a separate SQL binding revision.

Actual PostgreSQL then exposed UTC-only readback: a committed UTC instant returned with
`+02:00` was refused. The [diagnostic log](sql-offset-diagnostic.log) retains both instants.
Strict offset parsing fixes that comparison without truncating fractions or accepting
invalid dates. All seven stages of the owned cluster now pass; see
[root SQL receipt](root-sql-receipt.json) and [full log](sql-final.log).
The transport is a service-role psql fixture, not a live PostgREST test.

Replay from the repository root:

```sh
node --experimental-strip-types --test apps/desktop/test/resource-pool-publisher.test.mjs
node apps/desktop/test/run-resource-reservation-db.mjs
```

The runner requires the existing PostgreSQL binaries and its1.5GiB disk reserve.
Archived mutation folders retain only their source/test dependencies and logs;
unrelated copied application files were omitted. Builder historical paths are provenance,
not setup instructions. No dependencies, credentials or installed settings are included.

[Final independent acceptance](sql-review/receipt-final.json) binds the corrected source,
51 focused tests,121 independent offset/calendar controls and the inspected root SQL
log. This reviewer did not run a second database cluster.

Private-root prefixes and trailing whitespace in selected archived logs are normalized.
[Manifest](../closing/producer-log-normalization.json) maps original receipt digests to
stored derivatives; historical receipt hashes are not rewritten.
