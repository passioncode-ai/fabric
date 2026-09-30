# S14 — the read envelope, and local state that does not lie

**Run:** `2026-09-08-s14-read-envelope` · task-pipeline, autonomous mode by operator
direction ("в автономном режиме"), so the grill's branches are resolved against the
harvested sources rather than asked. Every decision taken for the operator is named.

Baseline of the card is `5051def`; this run measured against `20f8d3f`.

## Source ledger

| Source | What it gave this run |
|---|---|
| `docs/architecture/engineering-specs.json` items[S14] | the target contract: `ReadEnvelope`, `LocalRead`/`LocalWrite`, `PackAdmission`, seven failure tests |
| `docs/evidence/retro.md` (read in full) | R-001…R-004. **R-001 checked:** no ADR changes hierarchy, ownership or cardinality — a read DTO adds vocabulary, not structure. **R-002 binds:** every deferral below leaves with an id in this commit. **R-003 checked:** no privilege, credential or filesystem-boundary change — the local writes stay inside `userData`, already owned. **R-004 binds:** a test that cannot reach the thing is inconclusive about the harness |
| `AGENTS.md#iteration-contract` | the map entry, the gates, the close-out question |
| `apps/desktop/src/shared/memoryOverview.ts` | **the honesty model already exists** — `rows: number \| null` + `problem`, "a rate with no denominator is not zero". S14 lifts it from one panel to every read rather than inventing a parallel vocabulary |
| `apps/desktop/src/main/contextPack.ts#compileContextPack` | already counts `omitted_facts` / `omitted_transcripts` (M49); the gap is `error`, not omission |
| `docs/evidence/backlog.md` | at intake: 78 of 110 carry-over rows open; 61 of 506 verification rows never watched failing |
| `graphify-out/` present · `~/.obsidian-wiki/config` present | stage 9 owes the graph and the wiki |
| `CONTEXT.md` | "Observation — a measured fact with a source and a timestamp"; the envelope's `sources[]` is that noun, plural |

## What was measured, and one claim of the card corrected

| Card claim | Measured on `20f8d3f` |
|---|---|
| `contextPack` destructures `data` only | **holds** — four reads, `error` never read |
| `MemoryOverviewSection` — one rejection prevents both updates | **holds** — `Promise.all` over overview + misses |
| …and a late A response can overwrite B | **corrected: already handled.** The effect's cleanup sets `alive = false` before the next effect runs, so a late response for the previous project is dropped. The defect in that line is the `Promise.all`, not the race |
| `settings.ts` defaults on parse failure, non-atomic write | **holds, and it is the worst of the six**: a malformed file reads as DEFAULTS, and the next `writeSettings` merges onto those defaults and overwrites the file — the operator's workspace path, tabs and locale are destroyed by a save that reports success |
| `localStore.write` swallows failure | **holds** — returns `void`, logs, caller cannot tell |
| `toggleFavourite` returns optimistic next | **holds** — returns `next` whether or not the write landed |
| `index.ts#memoryOverview` already models unknown | **holds** — retained, not replaced |

## REQ table — frozen; adding is free, removing needs the operator

| REQ | The request | Verified by |
|---|---|---|
| REQ-S14-1 | `ReadEnvelope<T>` names availability, freshness, the sources it consulted and what it omitted; a zero is expressible only as a measured zero | `apps/desktop/src/shared/readEnvelope.test.ts` |
| REQ-S14-2 | A failed source is never an empty answer: the context pack reports `partial`, names the source and its error | `apps/desktop/test/context-pack.test.mjs`, fault injected at the query seam |
| REQ-S14-3 | A pack for unattended work is not `complete` when a mandatory source failed | same probe, mandatory-source case |
| REQ-S14-4 | A local read is typed `ready \| recovered \| default_missing \| unreadable` and carries a revision; a malformed file is quarantined and never overwritten by defaults | `apps/desktop/test/local-state.test.mjs` |
| REQ-S14-5 | A local write is atomic — temp beside the target, `0600`, fsync, rename — and returns committed or failed with the revision | `apps/desktop/test/local-state.test.mjs`, write-denied and interrupted-before-rename cases |
| REQ-S14-6 | `toggleFavourite` returns a save result, not an optimistic value | `apps/desktop/test/local-state.test.mjs` plus the type refusing the old return at its call sites |
| REQ-S14-7 | One source failing does not hide another that succeeded: overview 5 shows with its stamp while misses shows an error and a retry | `apps/desktop/src/renderer/src/MemoryOverviewSection.test.tsx` |
| REQ-S14-8 | Settings are validated per FIELD rather than spread, and a file that will not parse is never overwritten by defaults | `apps/desktop/src/shared/appSettings.test.ts` (validation) plus `apps/desktop/test/local-state.test.mjs` (quarantine) |

## Deferred, with an id in this commit (R-002)

Not a count, and not a promise of ids. The cursor half of the card —
`minimumCursor`, the per-consumer seen cursor, and a generation token beyond the guard
that already exists — has no consumer in the tree: the feed cursor surfaces are `M185`
and `M186`, and the restore contract is `S12`. Filed as **CO-111**, homed there, rather
than half-built here.

## Module cut (stage 2), walking skeleton first

1. **the contract** — `shared/readEnvelope.ts`: pure, no I/O, consumed by the other two.
2. **local state** — `main/localStore.ts`, `main/settings.ts`, `main/favourites.ts`.
3. **honest reads** — `main/contextPack.ts`, `renderer/MemoryOverviewSection.tsx`.

## Stage 9, declined per-task with the reason (recorded, not silent)

`graphify-out/` and the wiki are both present, so the pipeline's third and second
artifacts apply. They are refreshed ONCE at the end of the Board-unblocking chain
(`S14 → S10 → S03.boundary → S06 → M177`) rather than on each task: a full graph
rebuild five times in a row costs more than the staleness it removes, and the
per-iteration documentation duty is carried by the living map entry and the
recomputed registers, which is this repository's own contract
(`AGENTS.md#iteration-contract`).

## What this run found that was not in the card

| Found | Fixed here |
|---|---|
| `AppSettings` had TWO definitions — three fields in `shared/types.ts`, five in `main/settings.ts` — so the renderer's type asserted settings carry no `workspace` and no `tabs` while the main process sent both | collapsed to one, with one set of defaults. The compiler then rejected the renderer's hardcoded three-field fallback, which is how the drift had stayed invisible |
| the panel's `onError` prop became dead once the panel owned its own failures | removed, with its one caller updated — a prop that claims a channel nobody uses is worse than no prop |
| the exposure counter matches `[A-Z]{2,6}-REQ-`, so this run's first nine rows, filed as `S14-REQ`, were invisible to it | renamed to `ENVL-REQ`; the near-miss is recorded on M115, the row that owns the counter, because it is that row's blind spot in a new shape |
| the i18n gate reads a generic arrow `<T,>(…)` in a `.tsx` file as JSX literal text | the loader is a module-level `function` instead — clearer anyway, and the ambiguity is real rather than a gate bug |
