# Pinned normative consumer fixtures

`SOURCE.json` owns the exact upstream repository, immutable revisions, file paths and
SHA-256 byte receipts. All files named there are copied directly from the recorded Git
objects, with no schema edits. The current closure, `d4c8831`
(DEC-0022 accepted), compiles the four capability-name surfaces (manifest, interop-agent-call,
service-well-known and pipeline) and the seven `fabric-project-comms/0.1` surfaces. It carries
the contract's own `fixtures/catalogue.json` and every comms fixture it grades, 7 positive and 10
negative, so the consumer test reaches the same verdicts as the contract (ADR-0117). Shared
dependency schemas are included because compilation must resolve the normative references.

Repin only with `node scripts/repin-agent-contract.mjs --checkout <fabric-agent-contract checkout>
--commit <sha>`, then set `CURRENT_COMMIT` in `../../contract-consumer-fixtures.mjs`. The script copies
exactly the files that module lists, from the commit's Git objects, never from a working tree.

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
