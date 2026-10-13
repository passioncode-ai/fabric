# N029 implementation evidence

This archive is separate from the earlier N029 design-only artifacts. Candidate source hashes are in `receipt.json`; the normalization manifest retains each original and stored digest. Absolute private workspace paths in logs become named placeholders. Candidate/original source snapshots use `.snapshot.txt` and are evidence, not additional compiled production modules.

The source-only candidate passed 100 focused tests and targeted strict types. Separately listed offline legacy checks were run on the preceding candidate; final independent review records their corrected-source status. Original production consumer replay failed three unchanged tests; `base-red.log` preserves the outcome. The stack-backed `context-pack.test.mjs` did not run: its overlay import failed before stack activity. No DB, provider/native process, configured resource mode, full input closure or held ownership was established. Whole-project integration gates belong to the root's separate receipt.

Portable original-consumer replay, from a checkout with the candidate tests and existing dependencies:

```sh
N029_SOURCE_ROOT="$PWD" node --experimental-strip-types --loader <archive>/negative-loader-portable.mjs --test --test-name-pattern='shared required|bundle refuses|actual compiler, managed' apps/desktop/test/prepared-managed-launch.test.mjs
```

Expected original result: exit 1, three selected assertion failures. Candidate result: run the same tests without this loader, exit 0. The portable loader is an archival path adaptation of the original executed loader; it does not change production bytes. Its archival adaptation was executed by the builder and produced exit 1 with the same three failed assertions (`portable-replay.json`); this is not an independent review. Builder-owned probes and independent reviewer evidence remain labelled separately; final independent review is preserved under `independent/receipt-final.json`.

The rejected blanket-allSettled candidate is preserved under `rejected-unconditional-settlement/`: 99 passing focused tests did not detect its legacy rejected-query plus hung-sibling regression. Root identified that regression; the corrected compiler keeps default fail-fast behavior and opts into retained settlement only for the prepared producer. `n029-settlement-correction.patch` is the four-file delta from that rejected candidate; `n029.patch` is the complete patch from the original source.

Independent reviewer accepted the corrected source after five unchanged controls. `independent/receipt-final.json` retains the original receipt digest in the normalization manifest; prior 99-test reviewer results remain explicitly historical. Portable reviewer fixtures adapt only the import path in their fixture (authorship remains the reviewer; adaptation/replay is builder-owned):

```sh
N029_SOURCE="$PWD/apps/desktop/src/main/preparedLaunchInput.ts" N029_COMPILER="$PWD/apps/desktop/src/main/contextPack.ts" node --experimental-strip-types --test <archive>/independent/portable/{scope-probes,scope-closure,compiler-occupancy,legacy-settlement}.mjs
```

For historical negative replay, add `--loader <archive>/independent/portable/source-override.mjs` and set `N029_OVERRIDE_PRODUCER` and/or `N029_OVERRIDE_COMPILER` to the corresponding `.snapshot.txt` files listed in the independent receipt. Imports resolve through the real candidate module URLs. The original compiler and first producer reproduce required-query accumulation; the later blanket-settlement compiler reproduces the legacy failure. Use the named control for each stage, not the entire suite as if all snapshots were one candidate.
