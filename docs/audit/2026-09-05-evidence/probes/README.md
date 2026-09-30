# Implementation audit probes — evidence archive

Saved on 2026-09-05 from already executed audit commands. No probe was rerun when this archive was created. Saved scripts contain the same module bodies as the earlier `node --input-type=module` stdin invocations, with explanatory comments added.

`receipts.json` maps each command and SHA-256 to its observed output and findings. `receipts.txt` is the readable aggregate. An exit code of zero means execution completed, not that the product meets its contract: these probes print the defect rather than asserting success.

Run each listed command with the original checkout dependencies available and a Node version supporting TypeScript stripping. Absolute imports intentionally pin the audited checkout at `.`; examined HEAD was `844c7a3c787d3f1bc87703a548e6099fc546a880`.

- `01-module-boundaries.mjs`: injected DB only, no database/network/file writes.
- `02-schema-acl.mjs`: local PostgreSQL metadata reads; never runs TRUNCATE.
- `03-schema-authority-rebuild.mjs`: random fixture estate/project/grant UUIDs in one local SQL transaction, always ROLLBACK.
- `04-policy-mcp-errors.mjs`: injected DB plus ephemeral loopback MCP server, no real database or external service.
- `05-schema-replay-history.mjs`: random fixtures and corruption of only those fixtures inside one SQL transaction, always ROLLBACK.

SQL commands use the standard local Supabase development endpoint. They do not target org #1 or alter existing user estate rows. Coordinate database probes with other DB tests. No credentials are emitted by the receipts; ephemeral MCP credentials stay in memory.


Archived invocation paths: run `node docs/audit/2026-09-05-evidence/probes/01-module-boundaries.mjs` (and the other numbered .mjs files) from the audited checkout. The receipts retain the original temporary invocation paths; these archive paths reference the same captured module bodies. Architecture probe provenance and invocation form are in `architecture-receipts.txt`.
