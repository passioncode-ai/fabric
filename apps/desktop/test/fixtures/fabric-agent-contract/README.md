# Pinned normative consumer fixtures

`SOURCE.json` owns the exact upstream repository, immutable revisions, file paths and
SHA-256 byte receipts. All files named there are copied directly from the recorded Git
objects, with no schema edits. The current df55 closure compiles the four capability-name
surfaces: manifest, interop-agent-call, service-well-known and pipeline. Shared dependency
schemas are included because compilation must resolve the normative references.

The legacy 2ce interop-agent-call/common pair is only an historical negative control.
It is never a fallback or a claim of current consumer compatibility. An underscore call
accepted by the current real SDK handler must be rejected by that historical schema.

The portable loader verifies every recorded file before compiling with exact direct dev
pins `ajv@8.20.0` and `ajv-formats@3.0.1`, matching the pinned contract compiler's resolved
versions. Missing files or dependencies fail; there is no regex-only fallback, network
fetch or optional skip. Changing a schema byte without its provenance fails before compile.
Normative source is licensed by the included upstream `LICENSE`.

Run `pnpm --filter @fabric/desktop test:contract-consumer`. The test uses only SDK
in-memory transports and fake handlers. It starts no listener, user service or agent,
and grants no product authority. See the bounded
[handoff](../../../../../docs/handoffs/2026-10-04-contract-consumer-regression.md).
