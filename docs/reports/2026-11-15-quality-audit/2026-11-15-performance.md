# Fabric desktop: performance, latency, hangs and errors on this Mac (2026-11-15)

## Sources and their limits
- **Daily digests, 7 full days (2026-11-08 to 11-14):** counts per operation, no durations.
- **Hourly digests:** 172 hours since 11-08.
- **Raw operations log:** the first pass read 247,702 lines, 11-11T14:28Z to 11-15T01:25Z. The log rotated during the analysis and pruned its oldest segment, so later counts cover 11-11T21:50Z to 11-15T04:21Z.
- **Machine state:** `ps`, `vm_stat`, swap and `df` at 04:19Z, plus Observatory `observatory_machine`.
- **Code:** `/Users/example/DATA/_worktrees/fabric-0321-i3r4/apps/desktop/src`.
- **Duration caveat:** fast successful `ipc.*` calls are written only once per 10 minutes, but every call of 1 s or more is written. So counts of slow calls are exact, while `ipc.*` p50 values are biased high. `tool.*` and `mcp.*` calls are always written, so their percentiles are true.
- **Scripts in `scripts/`, run with `nice -n 10 python3 -I`:**
  - `ops_stats.py count|failed`: per-operation totals, durations and top errors, giving `count.tsv` and `failed.tsv`.
  - `op.py`: per-hour histograms and sample lines.
  - `slow.py`: slow-call bands, giving `slow.tsv`.
  - `digest7.py`: the 7-day totals, giving `digest7.txt`.
  - `seven.py`: the 7 s band.
  - `hourly_ipc.txt` came from an inline script over the hourly digests.

## Findings

**PF-1 Critical: the database goes down when the disk fills, and once read a corrupt block.**
- **What the person feels:** everything stops for minutes to hours. The home and the board are empty or show errors, agents get 503, board requests are not dispatched, and routines and chains stall.
- **Losses:** `stack.lost` 9 times in 7 days. In the raw log, 4 of 6 losses carry `disk_low: true` with 0.1, 0.1, 1.7 and 2.8 GB free.
- **Outage lengths:** 184 s, 19,923 s (5.5 h, back at 11-12T20:56Z), 272 s, 809 s and 883 s. The outage starting 11-11T17:56Z lasted about 3 h, until a restart.
- **During outages the cycle fails on every pass:** `cycle.receipt` 522, `routine.routines-unreadable` 521, `chain.links-unreadable` 520, `board.tick` 520, `work.sweep-read` 694. That runs at 120 an hour from 11-12T15Z to 20Z.
- **Disk full:** `ENOSPC` 4 times, and the log itself lost 95 records (`ops.gap`).
- **Possible corruption:** 371 lines in the hour 11-14T21Z read `could not read blocks 13145..13145 in file "base/5/16866": Input/output error`. This came right after the loss at 21:10Z with 0.1 GB free.
- **The warning is log-only:** `stack.disk-low` was written 55 times and changed nothing (`main/stackWatch.ts` only records it).
- **Now:** Observatory reports 2.8 GB free (0.6 %) and the disk guard at critical with `freedGb -0.01`; `df` shows 6.6 GiB. The Colima data disk is 60 GB.

**PF-2 High: the home reading is slow, serial and repeated for every reader.**
- **What the person feels:** the left column, «В работе» and the home lag by seconds and sometimes show a failure line.
- **Numbers:** `ipc.work:home` was called 6,939 times; 187 failed, 452 took 1 s or more, 165 took 5 s or more, max 18,604 ms. Up to 809 calls an hour.
- **Cause:** eight awaited stages run one after another (`main/index.ts:5709-5724`). `workRead.ts` alone has 14 database selects, and `withBranches` spawns `git rev-parse` for each held session.
- **No sharing:** there is no single flight or shared result in main. By contrast, `workRhythm.ts` reuses a reading younger than 15 s.
- **Cadence:** every reader re-reads on each `session` mark with only a 1.5 s gap (`HomeWork.tsx` `READ_GAP_MS`). With 40 agents, that gap is the effective cadence.

**PF-3 High: the window polls on fixed clocks whether or not anyone looks.**
- **What the person feels:** an open window slows the whole app, including the hub that agents call.
- **The clocks in `renderer/src/App.tsx`:**
  - `feed:replay` every 2 s (lines 96 and 474), up to 1,800 an hour. Each batch with events also re-triggers the home, rhythm, attention and board readings.
  - `terminal:list` every 3 s (lines 97 and 528), up to 1,200 an hour.
  - `comms:heads` every 5 s (lines 100 and 496), up to 5,000 rows each time. Its cost is unmeasured (PF-8).
  - The Comms screen every 2.5 s, and `board:query` up to 1,677 an hour.
- **Totals:** all `ipc.*` calls run at a median of 526 an hour, p95 3,734, max 6,915.
- **Estimate with 40+ agents and one open window:** about 8,000 IPC calls an hour. The home alone is about 12,000 database requests an hour, at a load average of 15 to 26 on this machine.
- **No pause:** none of these clocks checks whether the window is visible or focused.
- **Costliest readings, in order:**
  1. The home (PF-2).
  2. The feed replay and the cascade it starts.
  3. `comms:heads`.
  4. `board:query`.
  5. The board dispatcher in main every 30 s.

**PF-4 High: board requests lose their answers in the dispatcher.**
- **What the person feels:** a request one project sends another goes unanswered, with no visible reason.
- **Starts:** `board.dispatch.started` 440 ok, 247 failed, 306 unknown (the session never accepted its hand-over). Failures by reason:
  - 120 after the third attempt.
  - 63 `PacketFrozen`.
  - 58 "Observatory names several projects for this folder".
- **Over 7 days:** 1,762 failed starts, 1,293 of them on 2026-11-09.
- **Ends:** 75 of 436 `board.dispatch.ended` lines (17 %) are `exited-without-answer`.
- **Decisions flip:** `board.dispatch.decided` has 43,989 lines, 10 % of the log. They flip between `live-session` (12,641) and `launch` (9,567) at the 10-minute liveness edge (`boardDispatchRun.ts:286-291`).

**PF-5 Medium: an agent in a removed folder loops on enrolment.**
- **What the person feels:** that agent never gets its Fabric tools.
- **Evidence:** `hub.session.enroll` failed 2,400 times with `spawn git ENOENT`, 100 to 182 an hour from 11-11T16Z to 11-12T21Z, and `work.origin-read` failed 36 times on 11-14.
- **Cause:** git is spawned with `cwd` set to a folder that no longer exists (`gitRun.ts:133` and `:203`; `index.ts:1693-1700`), and Node reports a missing `cwd` as ENOENT. The refusal doesn't name the folder, so `fabric-mcp` retries every 30 s.

**PF-6 Medium: the operations log holds 3 days, not 7.** `ops.retention-short` appears 11 times, with `kept_hours 74`. The log writes about 1.1 MB an hour against the 190 KB an hour it was sized for (`ops.ts:35-38`). Share of bytes by operation:

| Operation | Share of bytes |
|---|---|
| `tool.com.claim` | 17.8 % |
| `mcp.tools/list` | 13.0 % |
| `mcp.notifications/initialized` | 10.1 % |
| `mcp.initialize` | 10.1 % |
| `board.dispatch.decided` | 10.0 % |
| `tool.com.enroll` | 8.6 % |
| `tool.fabric.session.enroll` | 8.0 % |
| `tool.com.status` | 6.6 % |

Over 84 % is routine successful traffic, and this analysis lost a segment between two commands.

**PF-7 Medium: MCP clients re-initialise constantly.**
- `mcp.initialize` ran 46,865 times in 7 days, a median of 251 an hour.
- One caller, `binding:f1147f7f...`, initialised 7,833 times in about 76 h (roughly every 35 s); the next, `binding:9192620b...`, 2,861.
- Each call is cheap (p50 6 ms) but adds a `tools/list` and a notification every time.

**PF-8 Medium: blind spots in the measurements and in error messages.**
- **Polled channels go unrecorded:** `comms:heads`, `terminal:history`, `work:session` and `work:messages` never record a success or its duration, so slow calls are invisible (`ipcOutcome.ts` `QUIET_WHEN_OK`; `index.ts:274-277`).
- **Unreadable errors:** 320 errors read `[object Object]` (`boardDispatchWiring.ts:416`), and 23 `board.rpc-unreadable` errors have no message.

**PF-9 Low: the network-exposure notice blocks up to 5 s every 5 minutes.** `ipc.stack:exposure` was called 409 times; 218 took 1 s or more, p95 3,515 ms, max 5,011 ms. The handler waits up to 5 s for a fresh check (`index.ts:4875`), and that check runs `supabase status` (`index.ts:905`).

**PF-10 Low: 49 fabric-mcp processes hold 2.7 GB.** That is 2,684 MB RSS, about 55 MB each, because each runs the full Electron binary as Node. The machine had 754 MB free and 5.9 of 7 GB swap in use. The main process sits at 250 to 260 MB.

**PF-11 Low: a 7 s ceiling, cause still open.**
- 437 calls ended at 7.0 to 7.1 s, all in the segment covering the 0.3.19 outage of 11-11 17:56Z to 20:45Z.
- That segment is now pruned, so the band can't be re-read.
- No Fabric deadline is 7 s (the database deadline is 15 s, the hub's 5 s). The likely cause is connection-failure timing while Docker was down.

**PF-12 Low: the hub refuses agents while the database is slow.** `agentSurface.hub-authenticate` failed 56 times, 45 of them on the 5 s database deadline, all during PF-1 outages. Agents get 503 and retry, which is correct; fixing PF-1 removes it.

**PF-13 Medium: every update stops the start until a manual migration.** `startup-failure.log` shows `schema-not-ready` on 11-05, 11-08 (a downgrade), 11-11 and 11-12 (twice).

**Not found:** no `renderer.error` lines and no quit that needed the 10 s deadline (no exit code 3).

## Proposed fixes, ranked by effect per effort

1. **Disk floor (PF-1, PF-12; high effect, low to medium effort).**
   - Below 10 GB free, say it on every screen and through the communicator.
   - Below 5 GB, stop dispatcher runs and routines and refuse new enrolments.
   - Keep a 2 GB ballast file to release during an outage.
   - After any Postgres I/O error, run a read-only `amcheck` and record the result.
   - Machine side: trim the 60 GB Colima disk.
2. **Home reading (PF-2; high effect, low effort).** Run one shared reading in main with a 2 to 3 s reuse window, and run the independent stages in parallel after `readHome`.
3. **Sample routine successes (PF-6, PF-4; very low effort).** Sample successful fast `mcp.*` protocol messages and no-op `com.claim`, `com.status` and `com.enroll` answers. Log a decision only when it holds for two passes. This should cut log volume by about 70 % and bring the log back to about 7 days.
4. **Pause the window's clocks (PF-3; medium effort).** Pause polls when the window is hidden, push feed events from main with a 15 s safety poll, read the terminal list from PTY events, and poll `comms:heads` every 15 s while Comms is closed.
5. **Typed `folder-gone` refusal (PF-5; low effort).** Check that the folder exists before spawning git, name it in the refusal, and have `fabric-mcp` back off.
6. **Dispatcher (PF-4; medium effort).**
   - When Observatory maps a folder to several projects, pick the deepest repository root or Fabric's own project.
   - Write a new packet on `PacketFrozen` instead of failing the start.
   - Show `exited-without-answer` to the asker.
   - Add hysteresis at the 10-minute liveness edge.
7. **`stack:exposure` (PF-9; very low effort).** Answer the last value and refresh in the background, without waiting.
8. **Measurement fixes (PF-8; very low effort).** Time the quiet channels, format error objects properly, and put dispatcher reasons in the `error` field.
9. **Migration on update (PF-13; medium effort).** For Fabric's own local stack, take an automatic verified backup and migrate at start instead of stopping.
10. **Re-initialising client (PF-7; low effort, needs its owner).** Identify `binding:f1147f7f...` and keep its MCP session open; cache `tools/list` per caller.
11. **Lighter `fabric-mcp` (PF-10; medium to high effort).** Run it on bundled Node or with a capped heap, about 1.5 to 2 GB saved at 40 sessions.

**Open:** the cause of the 7 s band (PF-11), and whether block `base/5/16866` is still readable. Checking that needs a read inside the database, which was out of scope for this read-only pass.