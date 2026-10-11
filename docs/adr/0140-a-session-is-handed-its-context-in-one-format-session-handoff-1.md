# ADR-0140 — A session is handed its context in one format, `session-handoff/1`

**Status:** accepted · 2026-10-11 · resolution R-01 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#decisions), agreed with Fabric Dashboards the
same day (fabric-dashboards-76: «I agree with all three corrections») · the format's home is the contract repository
`fabric-agent-contract` · plan row P-16, canvas node C3, REQ-06.

## Context

Fabric hands a session a per-session bundle — a 0700 folder with `mcp.json` holding a one-shot bearer, a compiled and
cited `context.md`, a preamble naming one first tool, and per-runner flags (`sessionBundle.ts`). Fabric Dashboards'
consoles hand a pack of their own: persistent per agent key, a stdio `mcp.json` with no secret, its own brief, no
`--strict-mcp-config`. The knowledge base asks for one format across products (principle 8, `agents-first.md`); the
name the family first used, `execution-packet/1`, already means two other things (Fabric's content-addressed integrity
manifest, `executionPacket.ts`; task-pipeline's dispatch packet).

## Decision

1. **The format is `session-handoff/1`**, defined once as a schema in `fabric-agent-contract`, beside
   `execution-context.schema.json`. Fabric, Dashboards and Switchboard conform. Fabric keeps `execution-packet/1` as
   the integrity layer underneath.
2. **Fixed for every product:** the files live in the product's user-data folder, never in the repository; the
   preamble names exactly one first tool and holds no rules (`fabric_whoami`, `service_context`); Claude Code gets the
   joined `--mcp-config=<path>`, which closes its variadic list.
3. **Declared, not forced:** `lifetime` (per session | per agent key), `mcp.strict` (Fabric's launched sessions keep
   `--strict-mcp-config`), `brief.delivery` (inline up to 1000 characters | a file), `mcp.auth` (a one-shot bearer in
   a 0700/0600 per-session folder | a stdio command with no secret — Fabric's terminal path is `fabric-mcp`).
4. **Symmetry:** a Fabric agent opened in Dashboards' console and a Dashboards agent opened from Fabric carry the
   same pack.

## Consequences

- A contract PR with the schema and its fixtures; Fabric's bundle compiler emits the declared fields; a validator
  test runs on Fabric's output; Dashboards conforms after the PR.

## Evidence

- Fabric `sessionBundle.ts#createBundleCompiler`, `shared/preamble.ts#PREAMBLE`, `executionPacket.ts#PACKET_SCHEMA`; Dashboards
  `src/core/handoff.ts`; the joined flag shipped by Switchboard #141 and Dashboards #68 (relayed 2026-10-11).
