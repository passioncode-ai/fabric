# N031 durable logical-unit intent evidence

This slice provides crash-gap-safe immutable registration only. Every API returns complete:false and executionAuthorized:false. Empty/no-active-evidence does not mean zero workers. Actual complete coverage and process/provider retirement remain the concrete N032 adapter contract.

The first frozen source7ddd2dc6 passed16 focused tests but independent review found an actual FileHandle fsync/retry defect: full bytes survived a refused sync and exact retry returned recorded without reestablishing durability. The corrected source2ff89b1f reopens and validates the same bytes/inode, fsyncs both event and directory for initial registration and exact retry, then rechecks provenance. Corrected builder focused18PASS0skip. Independent reviewer accepted the corrected source with18 focused plus4 independently authored controls, zero skips (reviewer/receipt-final.json); root types/combined gates remain outside builder evidence.

Historical builder receipt and source are preserved under builder/ and rejected-first/. Prior source before-uniqueness.snapshot.txt reproduces another real defect identified by reviewer source inspection and reproduced by builder: duplicate retained run/event IDs could evade whole-registry refusal. Its original RED and portable source replay are preserved. Two separate source plants remove host binding or invent complete:true; selected checks fail. Initial focused-initial.log contains a fixture defect (changed backing state after an unchanged result was captured), not a production finding.

## Replay and archived identities

All source/test/dependency artifacts use .snapshot.txt. They are evidence, never live repository source. accepted/ includes exact corrected candidate plus actual N028/N026, policy, ScopedStore, sharedscope, Git reader and installed-function helper dependencies. No external node_modules are required for these strip-types fixtures. Root may integrate a later nonbehavioral N026 alias correction; these receipts bind the actual older dependency bytes recorded here.

Requires Node strip-types, Python3, Git and the existing pinned agent-sync1.22.2 source with SHA256 fba3e2d99cad3982b3d81cab9c2ae7a255265ddddcd249aee81dca866e457ee1. Set N028_AGENT_SYNC_SCRIPT to its actual local path; no installs or real lease acquisition. Missing installation causes explicit focused skips, which are not zero-skip acceptance. DB membership remains a fixture; actual N028/filesystem/Git/functions run, not full CLI/native/provider.

```sh
export N028_AGENT_SYNC_SCRIPT="$HOME/.codex/plugins/cache/agent-sync/agent-sync/1.22.2/skills/agent-sync/scripts/agent_sync.py"
python3 path/to/raw/n031/replay.py accepted
python3 path/to/raw/n031/replay.py durability-before
python3 path/to/raw/n031/replay.py uniqueness-before
python3 path/to/raw/n031/replay.py host-binding-removed
python3 path/to/raw/n031/replay.py false-completeness
```

The runner restores only its own temp layout. accepted runs focused and independent controls, expected exit0. Other variants deliberately fail: durability-before restores preserved7ddd and the unchanged independent retry probe; uniqueness-before restores actual prior source and its portable current selected probe config without the later maxRegistryBytes field (so failure reaches the intended assertion); last two are source plants. No negative exit is called product acceptance.

Normalization manifests preserve every original and stored digest. Private prefixes and log whitespace are normalized; historical embedded original digest values are intentionally not rewritten. Portable independent probes resolve the tested source/dependencies from N031_SOURCE instead of original private paths; bodies/assertions remain the same. manifest.json hashes all delivered files except itself. Packaging itself does not count as an independent review.

## Portable replay timing supplement

Two initial packaging replays passed18 focused checks but failed the 30ms independent
fixture's successful retry assertion (3/4 controls). Both failed logs remain in
reviewer/budget-supplement/. This was not suppressed or relabelled as product acceptance.
The independent reviewer changed only the fixture deadline30→1000ms; its unresolved
membership promise still forces the timeout, and all occupancy/lock/assertions are unchanged.
The reviewed corrected fixture passes4 controls; the original7ddd source still fails the
actual file/directory durability probes. Original reviewer receipt and probe are preserved.
The portable runner serializes test files and uses the corrected fixture. No production
source, timeout policy or historical source digest was changed by this supplement.
