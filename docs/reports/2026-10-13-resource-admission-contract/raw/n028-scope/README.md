# N028 scope correction supplement

This supplements the historical `n028` package; no historical source, acceptance receipt or normalization manifest was rewritten. Parent/N029 review identified a mutable ScopedStore boundary. Both author and reviewer reproduced actual `createScopedStore` scope drift during membership completion producing observed identity on original source7827f362…. Author additionally reproduced replacement with an equal-looking scope object. Original accepted scope therefore requires this correction.

Corrected source e51e8e044f9d72505ea72e17bfdb297451b0df3a78fb8d929c86449d2d0ed366 captures the original scope object and checks exact binding before/after allSettled, after canonical-directory await, and operation/final-result checks. The original pending-sibling accounting remains. Author focused tests29PASS, zero skips; independent new scope + prior five controls6PASS. Original author two tests and reviewer scope probe are RED. [Builder receipt](builder/scope-receipt.json) remains historically pending review; the later [independent receipt](reviewer/receipt-scope-supplement.json) supplies scoped acceptance. Root types/full gate are separate.

## Replay

Requires Node strip-types, Python3, Git and actual hash-pinned installed agent-sync1.22.2; no installation or foreign writes. Set `N028_AGENT_SYNC_SCRIPT` to the installed source (expected SHA fba3e2d99cad3982b3d81cab9c2ae7a255265ddddcd249aee81dca866e457ee1).

```sh
export N028_AGENT_SYNC_SCRIPT="$HOME/.codex/plugins/cache/agent-sync/agent-sync/1.22.2/skills/agent-sync/scripts/agent_sync.py"
python3 path/to/raw/n028-scope/replay.py accepted
python3 path/to/raw/n028-scope/replay.py before
```

Accepted should run29focused then6independent tests and exit0. Before restores original7827 and runs the independent scope control, intentionally exit1. The runner restores exact `.snapshot.txt` bytes in its own temp layout and cleans only that layout. The archive includes actual `scopedStore.ts` and `shared/scope.ts` dependencies, since the new tests execute production ScopedStore rather than replacing its scope behavior. DB transport stays a fixture. Packaging did not rerun29tests; recorded builder/reviewer results are authoritative.

`normalization.json` records each original/stored digest and path/whitespace transformation. Historical embedded hashes identify original bytes. Probe derivatives replace the private installed path with a required environment variable and resolve ScopedStore beside N028_SOURCE; source snapshots are not executable repository files. `manifest.json` hashes all delivered files except itself. No native launch, fullCLI, held authority, real lease acquisition or actual membership SQL acceptance is claimed.
