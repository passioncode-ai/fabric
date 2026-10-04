<sub>ssheleg skills — task-pipeline · evidence-docs · agent-sync</sub>

# Current-owner directory scope correction — 2026-10-04

The independent review rejected source `537ca82d90e7bb814a907209cb303bbed8633e1e`: an existing directory in `context.scope` did not require descendants in `basis_sources`. A neutral production-parser fixture committed a child, changed it at a later commit, then omitted its contract; compile and `next` accepted the leaf. The [original rejection](https://github.com/passioncode-ai/fabric/blob/9a1a07fc5d993ffcf53c891681fa4b04746b1d3c/docs/reports/2026-10-04-unified-owner-reconciliation-review/README.md) remains immutable. This author correction changes no actual owner source, current pointer, canonical status, guarded map or release gate.

## Input and output contract

`context.scope` contains existing input/edit paths. A regular file or complete directory subtree must exist at both the packet basis and current live tree. The compiler compares every committed regular descendant at the basis with every live regular descendant, including ignored/untracked files. Missing, added, type-changed, hidden, linked or nonregular entries refuse. Every descendant requires its exact same-basis byte contract; changed bytes refuse even when the inventory matches. Scope traversal is bounded to 1,024 entries and 256 unique regular files, with safe paths and existing 32 MiB per-input limits. Glob syntax is refused.

Each packet now requires `output_scope`, an explicit array (possibly empty) of new output paths. A new output must be absent from the basis Git tree, selected Git tree and live tree. Existing directory/file outputs, symlink/non-directory parents (including immutable basis/selected ancestors), and overlap with any input scope, declared context source or another output refuse. Absence in input scope no longer implies an output. Existing source-bearing directories cannot be disguised as outputs. Actual task/resource claims still belong to execution and root; no live lease or release authority is minted here.

The corrected proposal moves `docs/handoffs/p08-source-qualification` from `context.scope` to `output_scope`. Its `2e06e5013595ec96b52b85cae2c486050632565b` basis remains a proposal requiring root refresh after incoming native code. All descendant/authority/dependency refs now travel in the bounded task context, `packet` source pins and cold-reader inputs. Cold packets separately retain `input_targets` and `new_output_targets`; their authorized edit targets combine the two declarations. This projection does not enlarge the source-owned scope.

## Reproduction and verification

The new regression first ran against unchanged rejected compiler bytes and returned compile exit 0; its refusal assertion failed with exit 1. [Before-RED receipt](unified-owner-scope-repair-20261004/before-red.log) preserves that observation. The positive directory control requires all descendants and checks production `check`/`next`/`packet` and cold-input pins. Counter-controls cover changed/deleted/added/untracked/ignored/hidden/linked/FIFO/type-changed/bounded inventories, implicit missing input, existing/deleted/overlapping/linked-parent/file-parent/glob output designations. They use disposable neutral sources and actual Git revisions.

Frozen supported Node 24.10.0 completed **38/38 tests, zero skips** ([log](unified-owner-scope-repair-20261004/node24-38-green.log)); Python syntax, 122 region markers and diff whitespace passed. `bash scripts/ci.sh fast` again exited 1 at the root-owned map fingerprint ([receipt](unified-owner-scope-repair-20261004/fast-node24-excerpt.log)). [Checks and exact source hashes](unified-owner-scope-repair-20261004/checks.json) retain these separate scopes. The earlier 34-test green and original author replay are historical evidence for the rejected source; this correction does not relabel them as acceptance. Independent acceptance requires the reviewer's new source-qualified replay.

## Next owning task

Root imports this correction, obtains independent review on its exact source SHA, refreshes its guarded map under its claim, then publishes the actual fixed `docs/evidence/plans/unified-current-reconciliation.json` with current source scope/basis/byte contracts. Recompile from that committed source; verify `check`, `next`, `packet` and impact applicability before activating one current pointer. The initial owner packet remains P-08 source qualification only. Parent P-08/CO-179 native/full/independent/human gates stay OPEN. No native product, full disposable application, hosted CI, live mutation, workspace publication or release acceptance is claimed by this compiler correction.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — source scope repair and bounded regression delivery
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — preserved RED and corrected inventory proof
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — root retains publication and guarded map ownership

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
