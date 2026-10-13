# N033 child environment propagation evidence

Author: pipeline_research. This archive contains author checks, not independent acceptance. Final integrated source hashes are in source-manifest.json. N032 admission confirmation is peer-authored; the N033 delta is separately reviewed.

Focused final command: `node --experimental-strip-types --test apps/desktop/test/resource-worker-launch.test.mjs apps/desktop/test/prepared-managed-launch.test.mjs apps/desktop/test/resource-launch-adapter.test.mjs` — 90 PASS, zero skip. Targeted strict unit/PTY type check exited 0. Original accepted N032 source with the same two new assertions produces 2 intended failures: configured bundle key wins, and malformed child environment is never checked. Run `python3 replay.py --source-root <checkout>` to repeat those narrow positive/negative controls against the actual modules.

The first combined fixture run failed because the peer deadline test's wrapper forwarded only the old single reserveOwnedUnit argument; N033 adds an environment argument. Corrected fixture forwards all arguments; assertions unchanged. Both logs are retained. This is a fixture integration correction, not an additional product defect.

Owned real Git/filesystem fixtures, actual installed pinned agent-sync identity derivation and actual production producer/PTY functions are used. Spawn, resource ownership and SQL responses are synthetic: no DB, paid provider, native child, lease acquisition, complete inventory or activation evidence. The test's two cases deliberately skip when the pinned installed agent-sync source is absent; skips are NOT_RUN. No authority to arbitrary same-process injection is claimed.

Logs replace private path prefixes; archive-manifest.json preserves original and stored hashes. Original production snapshots and test bodies have no normalization. Source pins and earlier failed logs remain historical evidence.
