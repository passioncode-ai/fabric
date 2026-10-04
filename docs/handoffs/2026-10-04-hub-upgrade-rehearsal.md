# Fabric hub upgrade rehearsal

## Owned upgrade rehearsal

Objective: rehearse the candidate's migration-count 75→78 and 77→78, preserve canonical
estate/journal/projection data and independently held authority, and dump/restore the owned
database before testing restored-pending and reconnect CAS regressions. Last migration suffix
is 80; it is migration count 78, not schema 80. Baseline: `47247836`.

Run `node apps/desktop/test/run-hub-upgrade-db.mjs` with PostgreSQL 17 (`FABRIC_PG_BIN` may
name its binary directory). The runner creates a private nonce-owned Unix-socket-only cluster;
it accepts no existing database URL, strips PostgreSQL ambient connection settings, uses
port 58578 inside that private socket directory and removes its cluster/dumps on every path.
No installed/live 54321/54322 database, real token or private backup is addressed.

Completed: added reusable standard-library Node runner/test and registered it in the full
owned-cluster loop. The 75 path pauses at 77 to introduce neutral hub fixtures before the last
upgrade, so both paths prove existing-row repair as well as clean schema compatibility.
Core fixture includes person, independently owned estate, project, task and memory fact;
77 adds live request/binding/grant/product and a logically restored archive with a pending
poll verifier. Upgrade comparison preserves exact journal/core/hub rows, allowing only
intended nulling of restored poll verifiers. Physical dump/restore compares every
public/auth/migration-ledger table, then rechecks API privileges, replay, independently held
ownership/live access and restored history's absence of authority.

Actual receipts: [owned run and mutant outcomes](2026-10-04-hub-upgrade-rehearsal-receipts.json).
Both upgrades passed; restored pending decisions refuse without appending/changing rows;
missing/stale reconnect CAS refuses; two concurrent replacements produce one committed
winner, one explicit refusal, one live connection, no rejected events in the journal.
Mutants keep count 78 and change only owned migration text in memory: `restored-poll` skips
both verifier repairs, `reconnect-cas` disables the live-id comparison. Both failed their
semantic assertions and cleaned their owned clusters. No core correction was needed.

Verification scope: fixture SQL/data, owned PostgreSQL 17, row/ACL/replay/CAS invariants.
Application backup UX, HTTP/PostgREST, external provider/vault state, installed/live database,
real private archives, hosted CI, release and installation remain NOT_RUN. A physical backup
of an estate preserves its existing authority; logical `restore_estate` imports history
without issuing target credentials. These are intentionally separate acceptance paths.

Exact next task: coordinator cherry-picks this packet, updates the combined map, runs
`node apps/desktop/test/run-hub-upgrade-db.mjs`, then the already planned converged fast/full
gates. Read the upgrade/rollback runbook against those receipts before authorizing any actual
installed database change. This work does not authorize a live migration or rollback.
