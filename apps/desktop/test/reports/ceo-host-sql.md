<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# CEO host → owned HTTP bridge → PostgreSQL 65

Measured on 2026-09-27. Source base:
[`6efe3ce14180350f59310c993201bb2ad8ad5543`](https://github.com/passioncode-ai/fabric/commit/6efe3ce14180350f59310c993201bb2ad8ad5543).
This packet adds only an isolated runner, its executable test and this report.

## Reproduce

```sh
node apps/desktop/test/run-ceo-host-sql.mjs
```

Requires installed PostgreSQL tools, defaulting to
`/opt/homebrew/opt/postgresql@17/bin`; `FABRIC_PG_BIN` may select another installed
binary directory. Missing binaries return `NOT_RUN` with exit 2. The command does
not accept a database URL or start an existing cluster.

The [runner](../run-ceo-host-sql.mjs) owns a temporary data directory, nonce, Unix
socket and database. The [test](../ceo-host-sql.test.mjs) verifies that ownership,
that the database is initially empty and that PostgreSQL has no TCP listener.
It applies all 65 migration files and verifies the real `schema_version()` result.

## What is composed

The actual imported [CEO host](../../src/main/ceoConversationHost.ts) constructs
the actual service and local private-file storage. The existing
[Identity producer](../../src/main/identity.ts) resolves membership against the
owned database through its injected database port. The host uses its real Node
HTTP transport against an ephemeral loopback fixture. The fixture supplies the
trusted identity source `authenticated`; it does not exercise authentication with
an external identity provider.

That fixture accepts only the four static CEO RPC paths, exact argument rosters,
POST, bounded request bodies and a synthetic fixture key. It converts values to
SQL literals with hex encoding, executes only those fixed SQL functions as
`service_role`, and returns actual PostgreSQL JSON. It never accepts SQL or an
arbitrary function name from HTTP. Database setup/assertions use the owned
privileged connection separately.

**This fixture is not PostgREST.** It does not prove PostgREST routing, JWT,
Supabase networking, schema-cache reload or deployed authentication. It closes
the gap between the separate real-HTTP/fake-RPC and service/direct-SQL checks.

## Observed checks

Seven actual composed groups passed:

1. Opening a project conversation uses identity/actor from the trusted producer;
   another open returns the same conversation through actual SQL and HTTP JSON.
2. Prepared text persists once. SQL history, canonical digest and the actual HTTP
   envelope agree. The synthetic secret is removed before local/durable storage;
   generic journal events remain opaque. Dispatch remains `pending_unavailable`.
3. The fixture discards the HTTP response **after the SQL commit**. Recreating the
   host over the same private files reconciles through the receipt RPC without
   another send or duplicate message. Real history pagination remains contiguous.
4. The fixture drops a request before SQL. A receipt lookup reports not-found;
   only the explicit retry sends again. Both HTTP bodies are identical and exactly
   one message is committed.
5. A valid member of another Estate, another private owner in the same Estate and
   an out-of-scope project cannot obtain or append the target private conversation.
6. Revocation after HTTP arrival but before SQL execution prevents a message even
   though the client held the earlier identity. Subsequent guard failures prevent
   additional HTTP calls and local draft/cached receipt access.
7. Unknown paths and missing fixture credentials do not execute a SQL RPC.

Observed final output: `PASS 7 actual host→owned HTTP bridge→PostgreSQL65 groups`.
An independent reviewer reran the same command against these three files: all
seven groups and cleanup passed, with no concrete blocking findings in this
bounded packet.

Both the HTTP/socket cleanup and PostgreSQL/data/private-file cleanup receipts
passed. The runner uses command deadlines and a 90-second child deadline; its
finally block stops only its owned data directory. If stopping fails it does not
print successful cleanup or erase the still-owned evidence directory.

## Limits and next integration step

No user database, credential, provider, model, worker, product IPC, renderer or
production bootstrap is used. No production service or global configuration is
installed or modified. PostgreSQL is Unix-socket-only; HTTP is loopback-only with
synthetic credentials. TLS acceptance is covered separately by
[the owned TLS fixture](ceo-conversation-host-tls.md).

Root owns test registration, shared contracts/map, full gates and publication.
After independent review, integrate these three files and rerun this command on
the integrated source. This is a storage/transport composition receipt; private
backup and product activation remain separate prerequisites.

---
**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded implementation and review
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — command, composition evidence and limits
