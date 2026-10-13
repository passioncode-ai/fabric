# N032 immutable attachment storage evidence

This is a separate extension to the accepted N031 durable registration substrate.
It preserves the schema1 registration and adds one ordered admission attachment and one
process attachment per intent, each bound to exact predecessor bytes. This archive covers
storage/provenance validation only. The managed-unit consumer, actual reservation readback,
PtyManager/native capture, and combined launch composition have separate owners/evidence.
Every API remains `complete:false` and `executionAuthorized:false`; no retirement exists.

## Source and checks

Candidate source/test/doc hashes and base N031 hashes are in builder/receipt.json. The
builder ran29 focused tests with zero skips and strict scoped TypeScript checking. Actual
N028, owned filesystem/Git, and pinned installed function execution run; membership and
attachment facts are fixtures. No SQL/native process/active DDL/install or full CLI was run.
The first scoped type check lacked an unchanged type-only dependency and failed; the final
check includes that dependency and passed. Both logs remain. Existing dependencies are
captured in candidate/; node_modules is deliberately excluded.

The cross-unit uniqueness issue was a reviewer source lead, confirmed against the ordinary
managed-unit consumer's one-unit/one-run/one-reservation contract. The preserved actual
pre-correction source yields two intended RED assertions: duplicate attachment input could
be recorded and retained duplicate SQL run identity could pass scans. Corrected source
refuses both. A separate controlled source plant removes only the admission parent digest
check and yields an intended RED. These have different provenance and are labelled in the
receipt. An accidental control command against current source passed; its named log is not
negative evidence. A pre-control command was rejected because its workdir did not exist;
it did not execute a test or change source.

## Replay

Requires Node strip-types, Python3, Git, and existing agent-sync1.22.2 source SHA256
fba3e2d99cad3982b3d81cab9c2ae7a255265ddddcd249aee81dca866e457ee1. Missing installed source
causes explicit skips, not acceptance. No installation or real lease operation is requested.

```sh
export N028_AGENT_SYNC_SCRIPT="$HOME/.codex/plugins/cache/agent-sync/agent-sync/1.22.2/skills/agent-sync/scripts/agent_sync.py"
python3 path/to/raw/n032-intent-events/replay.py candidate
python3 path/to/raw/n032-intent-events/replay.py cross-unit-before
python3 path/to/raw/n032-intent-events/replay.py parent-digest-removed
```

Candidate expects exit0; negative variants expect exit1 at their specified assertions.
The runner materializes only an owned temporary layout, then removes it. Source archives
are `.snapshot.txt`, not live application source. Normalization records original/stored
hashes for private prefix and log-whitespace changes; historical embedded digests are never
rewritten. Independent review accepted the exact candidate29 focused plus3 additional production
controls; see reviewer/receipt-events.json. Review scope remains storage only.

The builder separately replayed the portable candidate layout:29 PASS, zero skips, exit0
(`portable-candidate.log`). This packaging replay is not an independent review.

Independent controls have an import-only portable derivative in event-controls.mjs. Run
`python3 path/to/raw/n032-intent-events/replay.py independent` with the same pinned-source
environment to reproduce the three controls. The original normalized probe is separately
archived; assertions remain unchanged. `manifest.json` hashes every delivered artifact
except itself. No accepted consumer or full-harness claim is implied by this archive.
