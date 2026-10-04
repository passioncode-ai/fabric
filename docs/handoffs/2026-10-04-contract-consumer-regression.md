<sub>ssheleg skills — task-pipeline · working-in-passioncode</sub>

# Pinned Fabric contract consumer regression — 2026-10-04

## Scope and contract

This source packet turns the independent consumer review into a durable regression. Author branch
`codex/co193-consumer-regression-20261004` starts at
`7011ce429d2593951b9d99940f78ab5850f17309`. The independent input is
[`0c5735c9c1f2cdb85a5995d5b411555e216b56c7:docs/reports/2026-10-04-contract-consumer-review`](https://github.com/passioncode-ai/fabric/tree/0c5735c9c1f2cdb85a5995d5b411555e216b56c7/docs/reports/2026-10-04-contract-consumer-review).
Root owns importing that review packet unchanged and integrating the converged source candidate.
CO-193 remains open; this packet does not assert completion of COM onboarding.

The current normative pin is fabric-agent-contract
`df55c8c54a23251342a7ee57ba95642b7eb39e61`, version `0.1.0`. Four compiled surfaces are
manifest, interop-agent-call, service-well-known and pipeline. All seven referenced schema files,
four upstream positive documents, two legacy schemas and the upstream license are copied byte for
byte from commit-addressed Git blobs. [SOURCE.json](../../apps/desktop/test/fixtures/fabric-agent-contract/SOURCE.json)
records every upstream path, commit and SHA-256. The loader checks the complete 14-file set before
compilation and compiles the verified in-memory bytes. No network schema fetch or regex substitute
is used. The historical `2ce392291c6668598d12cd38327e24696b5ca15c` schemas are an explicit
negative control, never a fallback compatibility result.

## Modules and decisions

- [Fixture loader/compiler](../../apps/desktop/test/contract-consumer-fixtures.mjs) verifies exact
  repository, version, commits, paths and every byte hash, then uses strict Ajv Draft 2020-12.
- [Regression](../../apps/desktop/test/contract-consumer.test.mjs) checks 21 names on each of four
  compiled schemas, plus seven call-shape variants (91 compiled cases). It connects the actual
  `hubServerFor` through the real MCP SDK client and in-memory transport for 28 argument cases,
  checks refusals and dispatch counts, and compares exact received arguments. Dispatch uses a fake
  dependency: no product is called and no grant is tested or issued.
- Prototype names can be schema-valid while `normaliseAccessRequest` refuses them under separate
  local consent policy. The session `AgentSurface` is independently exercised: a valid stage report
  writes one fake journal event, malformed arguments and absent `agent.call` write none. Session
  tools do not claim interop-agent-call compatibility.
- The stale contract-deviation comment in [access.ts](../../apps/desktop/src/shared/access.ts) is
  reconciled with the current contract. No patterns, authority, grants, schema or supervisor change.
- The operator accepted exact direct **development** compiler dependencies `ajv: 8.20.0` and
  `ajv-formats: 3.0.1` before the lock edit. Both package snapshots already existed in the lock;
  only the desktop importer adds references. No runtime dependency changes.
- [Desktop scripts](../../apps/desktop/package.json) expose `test:contract-consumer` and include it
  in the app test chain. [ci.sh](../../scripts/ci.sh) includes the focused command beside the hub
  tests. Root owns reconciling both chains with concurrent changes and running the converged gate.

No guarded register is edited, no ID is allocated, and no coordination lease is needed for these
owned code, fixtures and handoff paths. Shared maps, architecture and evidence registers belong to
root for this delivery. Installed state and local caches remain local-only.

## Checks actually run

Machine-readable receipts are in [the validation ledger](2026-10-04-contract-consumer-regression.json).

| Command / check | Result |
|---|---|
| Initial missing-regression probe, `node --experimental-strip-types apps/desktop/test/contract-consumer.test.mjs` before fixtures existed | **RED**, exit 1: missing pinned compiled normative regression source; local regex tests are insufficient |
| `pnpm --filter @fabric/desktop test:contract-consumer` | exit 0; 9 tests, 0 skipped; 91 compiled cases, 28 real SDK parity cases |
| `pnpm --filter @fabric/desktop exec vitest run src/shared/access.test.ts src/shared/accessWords.test.ts` | exit 0; 2 files, 42 tests passed |
| `pnpm --filter @fabric/desktop typecheck` | exit 0; node and web TypeScript checks |
| Legacy negative control | current/legacy disagree for underscore, maximum-underscore and maximum-key; current SDK dispatches the underscore case |
| Planted schema drift | the changed common schema fails SHA-256 verification before compilation |
| `node scripts/check-regions.mjs` | exit 0; 112 markers closed, all documentation references resolve |
| `bash -n scripts/ci.sh` and `git diff --check` | exit 0 each |
| Independent byte comparison using `git show <commit>:<upstreamPath>` | 14/14 upstream blobs and SHA-256 entries equal |
| App and CI command resolution | focused command exists in both chains |

The separate consent-policy assertion is deliberately outside schema argument parity. An initial
session-tool test expected the SDK to throw; actual SDK behavior returns `isError: true`. The test
now checks that observed refusal and absence of a journal side effect.

The full `bash scripts/ci.sh fast`, full app chain, native/real CLI, live products, hosted CI,
release, installation, wiki sync and report index are **NOT_RUN** by this author. Root owns the
converged fast gate and independent review. Local focused green is not a hosted or live receipt.

## Remote delivery replay

Authenticated fresh clone of the pushed branch resolved source commit
`6d84380b7e5b9e08fbb2a47054a2281b88ca2744`. Offline frozen-lockfile development dependency
installation with scripts disabled exited 0; the focused Node gate replayed 9/9 tests with no skips,
and `git status --porcelain` remained empty. These are source/development receipts, not a product
installation or live receipt. The ledger records the exact commands and replayed SHA.

## Exact next task

Root: import the source author commit, reconcile the two test-chain additions, import the independent
review packet unchanged, and request independent review of the resulting exact candidate SHA.
Replay `pnpm --filter @fabric/desktop test:contract-consumer`, inspect all 14 provenance blobs, and
re-run the converged source gate. Keep CO-193 open until its remaining owning prerequisites and COM
runtime onboarding have their own receipts. Do not infer a release or installed update from this
pushed source branch.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — TDD and bounded source delivery
- `working-in-passioncode` — org pin and handoff policy — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
