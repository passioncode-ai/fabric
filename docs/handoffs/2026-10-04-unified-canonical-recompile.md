<sub>ssheleg skills — task-pipeline · evidence-docs · agent-sync</sub>

# Unified canonical source recompile — 2026-10-04

Objective: derive a complete, source-addressed execution graph from Fabric's canonical manifest, preserve the previous dated research cut, and give the integrator one reproducible current entry. This branch changes the compiler, validator and tests. The canonical queue remains the authority for task status and authorized work.

Base: [Fabric main 484600a3](https://github.com/passioncode-ai/fabric/tree/484600a338f2c413333e57c09a28712b8559c401). The root convergence branch and its uncommitted COM declarations were read only. No guarded register, map, canonical backlog, generated workspace view or report wiki index was edited here.

## Canonical source and privacy boundary

`scripts/unified-canonical-sources.mjs` reads every declaration in `docs/backlog-sources.json` using the common parser from the exact `workspace` gitlink at the requested Fabric revision. It verifies that parser's HEAD and parser bytes. Missing workspace checkout or a different parser pin stops compilation. The inventory explicitly covers Fabric-local declarations; organization-wide workspace aggregation remains a separate operation.

Identity is repository + canonical path + stable ID. Two files with the same ID retain two keys. Every declared source, including contexts and manifest, is pinned; every canonical task key must be represented in the graph. A missing row is a validation failure. Previously unrepresented rows become held source-review references with their full canonical source row, conditional prerequisite text and owning URL. Coverage does not make them executable or duplicate their editable status.

Every compiler input has a full commit and SHA-256. Git must contain exactly those bytes at that commit before an output is written. This includes research packets, impacts, check receipts, generator code and ADR-0101. A dirty input cannot be silently repinned. Historical proof claims retain their original revision/scope separately from new input byte pins. Inherited candidate and done records are held for a current bounded owner context review; historical CO-179 preparation is not native acceptance. CO-179 remains a release prerequisite.

Public generation requires `--privacy-deny-file`: a local JSON array of private literal identifiers supplied by the operator. Keep it outside Git with mode 600. The contents are never copied into output or diagnostics. The gate checks every selected source, full research packet and generated plan for those literals, and rejects explicit private metadata. Error labels redact a matching private path. A private owning plan remains in its private repository; the public example name is `example-agent`. No exact private identifier is stored in this patch or its test fixtures. Synthetic negative sentinels prove refusal without publishing real identifiers.

The [local scan receipt](unified-canonical-recompile-20261004/privacy-scan.json) checked 616 files in the existing unified input/output and task source scope and found zero offending files. This is a bounded source scan, not an organization-wide privacy claim. The compiler requires a current local deny list; it cannot discover unnamed private repositories automatically.

Project communication history/queries still need participant authorization, including counts, cursors and filter facets. This graph grants no estate journal replay permission. COM read acknowledgements do not dismiss board obligations or change canonical task status.

## Exact recompile and one current entry

First commit the reviewed canonical source changes, COM manifest/table and generator patch. The new source revision must contain the planned schema migration and lane declarations before the generated cut can describe them. Initialize the exact workspace gitlink. Use Node 24 (the repository's supported gate runtime).

```sh
git submodule update --init workspace
UNIFIED_SOURCE_REV=$(git rev-parse HEAD)
UNIFIED_CUT="docs/reports/2026-10-04-unified-converged-$(git rev-parse --short=12 HEAD)"
# FABRIC_PUBLIC_PRIVACY_DENY_FILE names an operator-provided local-only JSON file.
python3 scripts/build-unified-plan.py \
  --source-revision "$UNIFIED_SOURCE_REV" \
  --output "$UNIFIED_CUT" \
  --privacy-deny-file "$FABRIC_PUBLIC_PRIVACY_DENY_FILE"
node scripts/unified-plan.mjs --report "$UNIFIED_CUT" \
  --privacy-deny-file "$FABRIC_PUBLIC_PRIVACY_DENY_FILE" check
node scripts/unified-plan.mjs --report "$UNIFIED_CUT" \
  --privacy-deny-file "$FABRIC_PUBLIC_PRIVACY_DENY_FILE" next
```

Generation writes only the new cut's `plan.json`, `audit-graph.json` and `cold-packets/`. It refuses an existing generated cut, the historical input directory, dirty inputs or an output escaping through a symlink. It does not rewrite the old dated research data or a canonical task row. For a published new report, the integration owner creates its report header and runs the owning report checks; this handoff does not publish an unreviewed new report cut.

After the new cut passes, the integration owner sets **one** current pointer, `docs/unified-plan-current.json`, with exactly:

```json
{"schema":1,"report":"docs/reports/REVIEWED-NEW-CUT"}
```

The default `check`, `next`, `packet ID` and `impacts [ID]` resolve that pointer. It contains only a path, never status or authority. `--report` selects an explicit dated cut reproducibly. Until integration creates the current pointer, the old default path remains selected and the old cut fails the stronger source-coverage/revision validation; it must not be called current. The compiler never automatically activates its output.

To inspect computed coverage without copying another editable source:

```sh
node scripts/unified-plan.mjs inventory \
  --source-revision "$UNIFIED_SOURCE_REV" \
  --privacy-deny-file "$FABRIC_PUBLIC_PRIVACY_DENY_FILE"
node scripts/unified-plan.mjs --report "$UNIFIED_CUT" \
  --privacy-deny-file "$FABRIC_PUBLIC_PRIVACY_DENY_FILE" packet COM-01
```

The base manifest yields 543 source-qualified task rows. The real-parser fixture adds 14 synthetic COM rows and verifies all 557 keys. These counts are computed test evidence for the base, not a claimed count for the integrator's changing canonical source. The root's final 13 lanes, COM identities and schema-78 source pins must be computed after its source commit; no candidate migration or release is stamped complete here.

## Checks and integration

- Regression first: the new-source unit control failed against the original validator (13 pass, 1 fail). The original compiler also fails the immutable-new-cut regression by rewriting the historical input.
- Node 24.10.0: `node --test scripts/test/unified-plan.test.mjs scripts/test/build-unified-plan.test.mjs` passes 25/25 with zero skipped. Controls include missing source coverage, identical IDs across owner files, forged source commits, dirty immutable inputs, private full-packet data, private metadata, overwritten cuts, held-source dispatch and current pointer status/path rejection.
- Unit tests use a synthetic common-parser response and require no private checkout. The real compiler integration test uses the actual pinned common parser in disposable Git fixtures; run it after initializing `workspace`. It is deliberately separate from the existing public-checkout unit CI command. No hosted trigger, token or secret policy was changed.
- Raw executed receipts: [validator baseline](unified-canonical-recompile-20261004/validator-baseline-red.log), [compiler baseline](unified-canonical-recompile-20261004/compiler-baseline-red.log), [supported Node green](unified-canonical-recompile-20261004/node24-green.log). Region references and Python syntax pass; `git diff --check` passes. [Full fast, supported Node](unified-canonical-recompile-20261004/fast-node24-excerpt.log) exits 1 at the expected shared design-map iteration gate after type/interface and earlier documentation checks. Root owns that map integration, so this branch does not refresh it or claim a green full fast. Product/runtime, hosted, native, deployed and workspace-publication checks were not run.

Next task: the integration owner reviews and incorporates this source patch, commits the final canonical P-08/CO-179/COM packets, computes the new cut, reconciles bounded dispatch contexts, validates it and activates the one current pointer. Root retains the map/ledger integration and report index lease. This branch is a source handoff, not a merge, package release, live acceptance, workspace publication or hosted CI result.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — isolated regression and review handoff
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — immutable pins and executed receipts
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — guarded registry boundary

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
