# N028 immutable run-assignment evidence

Scope: local correlation producer, actual pinned installed identity-function extraction, immutable owned filesystem mappings and N028 → N026 fixture composition. No native launch, full agent-sync CLI, acquired lease, numeric fence, R1 held, authenticated exclusive ownership or actual DB membership transport is certified here.

Builder recorded 27 focused passes. Independent reviewer recorded those 27 plus 5 adversarial/composition passes, zero skips. Four original defects were independently RED and then GREEN: rejected membership with pending sibling; partial retained record; synchronous query-chain throw with pending sibling; nested Git timeout across handles. Builder's original 17-test run separately recorded a record-cap failure. See [acceptance](builder/receipt-accepted.json), [independent receipt](reviewer/receipt-final.json), and [normalization manifest](normalization.json). Root typecheck/combined gate was pending in these historical receipts; later integration evidence must be separate.

## Archived layout and original identities

All historical TypeScript/Python/probe sources use `.snapshot.txt` and are evidence, not executable repository source. `accepted/` includes exact accepted four-file candidate and three unchanged dependency snapshots. `builder/pre-hardening.snapshot.txt` is d611318b… and reproduces both early reviewer failures. `builder/pre-nested-transport.snapshot.txt` is 5e4db1c5… and reproduces lease and synchronous sibling failures. `builder/pre-sync-query.snapshot.txt` and reviewer `sync-sibling-before.ts.snapshot.txt` are intermediate snapshots, not the source claimed for the original synchronous-sibling RED. `early-before.log` and `lease-before.log` are interim artifacts; authoritative failure logs end `original-red.log`. Initial reviewer fixture syntax trouble is not counted as a production defect.

Normalization replaces private home and temp prefixes with `<HOME>`, `<BUILDER>`, `<REVIEWER>` and strips log trailing whitespace. Every imported file retains original and stored hashes in normalization.json. Historical receipt embedded digests still name original bytes; they were not restamped. The portable probes only replace a literal installed path with mandatory `N028_AGENT_SYNC_SCRIPT`; original probes remain archived. `manifest.json` hashes every delivered file except itself.

## Replay from any checkout or artifact directory

Prerequisites: Node with `--experimental-strip-types`, Python 3, Git, and the existing agent-sync 1.22.2 installed source with SHA256 `fba3e2d99cad3982b3d81cab9c2ae7a255265ddddcd249aee81dca866e457ee1`. The helper checks that exact source; never install or substitute a guessed implementation to make this replay pass. Set the environment variable to its actual local path; do not put credentials in it.

```sh
export N028_AGENT_SYNC_SCRIPT="$HOME/.codex/plugins/cache/agent-sync/agent-sync/1.22.2/skills/agent-sync/scripts/agent_sync.py"
python3 path/to/raw/n028/replay.py accepted
python3 path/to/raw/n028/replay.py early
python3 path/to/raw/n028/replay.py lease
```

`accepted` should exit 0 (27 focused + 5 independent). `early` and `lease` intentionally exit nonzero (two independent failures each). The runner materializes a fresh temporary repository-like layout including the helper at `scripts/resourceAgentSyncIdentity.py`, uses the archived exact source and dependencies, and cleans only its own temp directory. It does not mutate checkout files. To replay only current focused tests from a checkout: `node --experimental-strip-types --test apps/desktop/test/resource-run-assignment.test.mjs`. Installed-source tests can skip there if unavailable; a skipped run is not the zero-skip historical acceptance. Packaging verification ran `replay.py accepted`: exit 0, 27 focused and 5 independent passes, zero skips; [log](package-replay.log). Historical RED variants were not rerun during packaging; original RED logs remain preserved.
