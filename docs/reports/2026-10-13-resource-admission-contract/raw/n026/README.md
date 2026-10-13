# N026 selected input snapshot evidence

Builder31 focused checks and independent8 filesystem/Git probes plus the index-flag
control pass. [Original metadata regression](receipt.json) and preserved source show
three failures; four source mutants fail their selected checks. The independent
[index control](independent/receipt-final.json) fails original source and passes fixed.

Root TypeScript rejected the initial candidate for nullable regexp result narrowing.
The same-body named refusal function fixes it: [typecheck receipt](root-typecheck.json),
[supplemental independent acceptance](independent/receipt-type-narrowing-supplement.json).
[Log normalization](normalization.json) retains original/stored hashes; historical
source snapshots are evidence, never current implementation.

[Composition review](composition-prerequisite-review.json) is pinned to193b0e1e.
It identifies locally executable coherent reservation accounting and actual input/run
binding prerequisites. Neither snapshot nor matching cooperative lease grants launch
authority, full dependency closure or continuous exclusive ownership. Combined source
gate, live activation, native execution and other project adoption remain separate.

## Archive layout and replay

Historical receipts retain the builder's original names. The independent name
`early-index-omission.ts` maps to `independent/early-index-omission.snapshot.txt`;
`resourceInputSnapshot.original.snapshot.txt` is the same original source.
`builder-accepted.snapshot.txt` preserves beefff49 before the root type-narrowing
correction. Source snapshots deliberately have non-executable archive suffixes.

Replay in a NEW owned temporary directory, never in this archive. Copy
`negative-controls.py` alone into that directory; create `apps/desktop/src/main`
and `apps/desktop/test` beside it. Copy `builder-accepted.snapshot.txt` as
`apps/desktop/src/main/resourceInputSnapshot.ts` and the tracked
`apps/desktop/test/resource-input-snapshot.test.mjs` from this source revision
(test SHA25686bd8ec24a9381c1c1314f0c6d95adace8b68df9e8068898911d05c970af11dd).
Read `apps/desktop/src/main/gitRun.ts` from the immutable Git source
`f2576c109f1de55179e07c7398aa2c4564e12087` into the corresponding temporary path
(SHA256015e2a23c0f5a3a803fb34dd0e01d996e65572769ee296bd1fd5176c63da8670).
Do not copy the archived `controls` directory: the historical script creates
fresh controls and intentionally refuses an existing layout. Then run
`python3 negative-controls.py` from that new directory.

For the independent original RED, place
`independent/early-index-omission.snapshot.txt` as a `.ts` file next to that
`gitRun.ts`, then set `N026_SOURCE` to its absolute path when running
`node --experimental-strip-types index-flag-check.mjs`. Expected exit1 is the
original defect. Point the same probe to the current tracked module for fixed
PASS, or run `node --experimental-strip-types --test production-probes.mjs`
with that current path for the independent8 checks. The environment path selects
source only; probes create and remove their own Git/filesystem fixtures.

Root repeated the documented fresh-layout procedure: all four mutated sources and
expected exits exactly match the archive ([replay receipt](archive-replay.json)).
This validates replay portability, not additional native or production acceptance.
