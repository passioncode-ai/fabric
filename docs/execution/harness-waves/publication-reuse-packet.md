# Proposed bounded packet: publication check reuse

Read-only proposal, not a changed gate or an execution receipt. Source checkout HEAD6c8b3718302dd7a3e981ce792f9c0c13db780b27 with staged N032/N033/main7bdd integration. Per-file hashes in publication-reuse-source-pins.json identify inspected working bytes. No suites, database, provider, publication or config writes were performed.

## Existing behavior and measured opportunity

`scripts/workspace.mjs:97–100` runs full fast when Fabric differs from the last *published* source; it does not consume the already completed local gate receipt. `:140–142` repeats it after staging the new workspace gitlink/receipt using the same fabricChanged boolean. Thus a source iteration already gated before commit can run it twice again in publication. No blanket absence-of-optimization claim: `workspace-release.mjs:43–45` already skips Fabric gates when an ancestor published source differs only in publication paths; `workspace.mjs:73–78` validates an already completed deployment and pushes the parent without rebuilding. Child npm test/content checks and race revalidation remain mandatory at :105–106 and :119–128.

Historical observed full fast cost: n031-fast.json binds 3253ccc7 tree at source6c8b3718, exit0,1208.8s. It records pnpm_config_verify_deps_before_run=warn and staged tree equality, not a verified complete runtime/dependency environment. Do not assert 40min guaranteed savings: two future runs, same duration and successful reuse were not measured.

## Critical boundary: an exact Git tree alone is insufficient

The full gate reads HEAD and dirty status in build-manifest.mjs:56–59 and exports committed HEAD in ci.sh:480–485. It also reads origin/main for migration order (:80), sibling repositories, a realized private workspace parser, installed packages and native runtimes. A staged-tree pass under old HEAD is not automatically a clean committed-HEAD full-gate receipt. A pin update changes the root Git tree and child parser checkout. Existing publicationOnly excludes workspace and workspace-receipt.json (workspace-snapshot.mjs:8); that export rule is not a proven full-test dependency exclusion.

## Smallest safe implementation packet

1. Introduce a versioned structured receipt producer/verifier around ONE explicit selected check, initially the expensive unified-compiler suite. Keep full gate orchestration and every unrelated check. Consume it from the compiler step of ci.sh, so repeated publication gates can reuse only that exact successful check. Do not initially add a blanket `skip full fast` option.
2. The wrapper derives its inputs itself, before and after execution; never accept caller-supplied PASS, arbitrary file list or current-tree echo. A hit requires schema/command/check-implementation/input/toolchain/dependency identity equality, exit0, completed cleanup, complete tests, no source mutation or unresolved child. Missing witness, invalid receipt, skip, NOT_RUN, rejection or change means execute, not pass. Concurrent callers share bounded work/atomic receipt write; timeout retains occupied ownership until child teardown is confirmed.
3. Store operational reuse receipts outside tracked source, with durable review receipts copied into the source report separately. Committing the cache itself must not recursively change its key. No secrets or raw all-environment dump. Cross-machine/host reuse is outside the first packet.
4. Preserve publication locks, staged-file hazards, parent/child identity checks, actual child tests/content verification, deployment readback and push/ancestry guards. After this selected-check packet is measured, a broader gate decomposition can use proved check-specific manifests; it is a separate design, not an automatic exclusion of docs or workspace.

## Exact initial compiler input closure

The actual test owns the list in scripts/test/build-unified-plan.test.mjs:14–34; derive the receipt manifest from that actual closure or one factored shared selector, never maintain a parallel copied list:
- test file; scripts/build-unified-plan.py; scripts/unified-plan.mjs; scripts/unified-canonical-sources.mjs; all their imported/read implementation inputs; scripts/lib dependencies as actually resolved.
- docs/reports/2026-10-04-unified-execution/plan.json itself; every oldPlan.sources[].path and task evidence.path; its checks/execution.json, impacts.json and packets release/start-adoption/agents-memory/reach-horizon.
- docs/backlog-sources.json plus every declared source path; ADR0101; AGENTS.md. Include file kind/exact bytes/absence; selected-input source can expand the closure and invalidates the old receipt.
- realized parser root from FABRIC_COMPILER_TEST_WORKSPACE or workspace, its actual HEAD, clean/dirty state and lib dependency bytes. Fixture clones that actual HEAD (:40–47); root gitlink alone does not prove checkout equality. Initially invalidate on any parser HEAD change even if lib appears equal.
- effective FABRIC_COMPILER_TEST_BASELINE override, if present, with resolved bytes; GITHUB_ACTIONS branch and any skip status. Initial implementation may refuse reuse whenever either override or missing private parser exists.
- exact argv `node --test scripts/test/build-unified-plan.test.mjs`; Node executable/runtime, Git and Python executable/version identity, host platform/architecture; explicitly sanitized effective environment/profile (PATH resolutions, relevant GIT_* behavior, locale/timezone, Node loader options). Unknown external influences mean no reuse. Test-private HOME/config changes must be isolated or included; do not fingerprint raw secrets.

This list is a source-backed starting closure, not an assertion that every transitive dependency has already been audited. The implementation must complete that enumeration before any hit is enabled.

## Required identity if later extending to full fast

- All root tracked file bytes/modes, relevant untracked/ignored generated inputs, index and worktree relation, HEAD/ancestry, resolved origin/main, submodule pins AND actual checkouts, sibling Git objects/refs used by checks.
- ci.sh, package script expansion, check implementations and argv/tier. fast and full are different contracts; a fast exit0 can contain owned-SQL/browser NOT_RUN (ci.sh:399–425,495–501). Preserve per-check outcome/skip coverage, not just aggregate exit.
- Package lock plus realized install lock, package/version/entrypoint identity, executable/native binary identity and symlink targets. package.json's pnpm@11.21.0 is requested identity, not evidence of actual executable or installed dependency bytes. toolchain.mjs:31–48 supplies useful partial observations only; build-manifest.mjs:143 explicitly disclaims reproducibility. `verify_deps_before_run=warn` must remain visible and cannot imply frozen dependencies.
- Node/V8/libuv/Electron/node-pty runtime tuple, OS/arch/release, Python/Git/bash/pnpm binaries, compiler and native build tools actually called. Darwin runs real Electron cases (ci.sh:452–460); other hosts have a different coverage outcome.
- Effective relevant environment including CI/GITHUB_ACTIONS/FABRIC_CI_AWAKE, NODE_OPTIONS/loaders, PNPM/npm/Corepack controls, FABRIC_REQUIRE_TOOLCHAIN, FABRIC_PNPM_EXECUTABLE, parser overrides, N028_AGENT_SYNC_SCRIPT and actual installed source hash, FABRIC_PG_BIN/binary identity, browser module/browser selection and binaries, locale/timezone/PATH/HOME config effects. Prefer a controlled allowlisted execution profile over hashing arbitrary environment. Secret values must never enter public receipts.
- Output artifact digest and presence where later stages consume generated files. Build output cannot be inferred from source receipt. Fresh availability, disk headroom and locks are operational prerequisites checked again; historical SQL/browser/native outcomes are not current service health or authorization.

## Negative acceptance and invalidation

Same closure/toolchain/profile+completed PASS can reuse that one check; wrong command, edited test/compiler, selected docs addition/removal, changed source declaration, parser HEAD/dirty bytes, baseline override, Git/Python/Node change, loader/env change, malformed/forged/truncated receipt, incomplete log/skip/NOT_RUN, timeout, partial cleanup or concurrent mutation must miss. Publication changes outside the proved compiler closure may retain that compiler receipt while child/publication/doc gates still execute. Adversarial fixture must mutate each admitted input and show actual command execution resumes; reject an arbitrary caller-supplied known-good manifest. Test concurrent same-key callers and late child exit without starting duplicate heavy work.

## Ownership and actual dependencies

Fabric source owner can implement this local packet without external COM approval. Root-owned scripts/ci.sh and workspace publication code must be coordinated under their current ownership; do not change a frozen gate. This is a new execution optimization contract requiring focused independent negative review. No permission to skip current gates is implied; live publication/access credentials and existing human consent remain separate.
