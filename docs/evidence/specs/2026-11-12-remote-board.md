# A remote board: two independent Fabrics, one board on the Mac Studio

**Status:** design, stages 0 to 4 of a task-pipeline run · 2026-11-12 · board task `a14b9520` · the operator's words of
2026-11-12 in this session, verbatim: «удаленная доска», then «это две независимыве машины но с доступом». The ask it
answers: board message `7608c368` (thread `bf30da77`), «диспетчер живёт в приложении Fabric на MacBook, и спящий
MacBook задерживает запуск. Может ли диспетчер работать на Studio?».

## 1. What is true today

| Fact | Evidence |
|---|---|
| The board, the journal and every task live in the local Supabase stack on the MacBook (`supabase_db_fabric`, `supabase_kong_fabric`). | `docker ps` on the MacBook, 2026-11-12: `supabase_kong_fabric 0.0.0.0:54321->8000/tcp`, `supabase_db_fabric 0.0.0.0:54322->5432/tcp` |
| The board dispatcher runs only inside the Fabric app on the MacBook; 351 of its 354 records ran here, 3 on `studio-sshlg` (2026-11-11 16:27, test runs). | `userData/board-dispatches.json`, counted by `target` |
| The Mac Studio has Fabric.app 0.3.19 in all three spaces (the operator's and two organizations'), not running; no `board-dispatches.json`. | `ssh studio-sshlg 'pgrep -fl Fabric.app/Contents/MacOS/Fabric; ls ~/Library/Application Support/@fabric/desktop'` |
| The Studio never sleeps (`sleep 0`); its `sshlg` space has Colima (stopped), the Docker CLI and the Supabase CLI; 595 GiB free, 64 GiB RAM. | `pmset -g`, `colima list`, `df -h ~`, `sysctl hw.memsize` over ssh, 2026-11-12 |
| The MacBook reaches the Studio over ssh (Tailscale `100.69.20.19`); the Studio does not reach the MacBook's stack (`curl http://100.72.246.104:54321/rest/v1/` timed out after 5 s). | the two probes, 2026-11-12 |
| Fabric already runs against a stack it did not start: with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set it never starts, heals or restarts that stack. | `main/env.ts#resolveSupabaseEnv`, `main/index.ts` (the `SUPABASE_URL` check beside the stack ownership comment) |

So the board is down whenever the MacBook sleeps: a request a Studio agent submits has nowhere to go, and no dispatcher
reads it. Moving only the dispatcher would not help.

## 2. The decision

Two Fabrics, one per machine, each with its own window, hub and agents ("independent"). **The board's home is the Mac
Studio** (the `sshlg` space), the machine that does not sleep; the MacBook's Fabric reaches it over ssh ("with access").

| Role | Machine | Runs the stack | Writes on its own (cycle, sweep, dispatcher, review default) | Hub and agents |
|---|---|---|---|---|
| `host` | Mac Studio, `sshlg` | yes, as today on the MacBook | yes, the only one | yes |
| `client` | MacBook | no: reaches the host's stack through an ssh tunnel it opens and keeps | none | yes, writing to the host's board |

Why not the other way (the MacBook as host, the Studio reading it): the board would still vanish when the MacBook
sleeps, which is the problem asked about. Why not one stack each: two boards, and requests between machines would need
a federation that does not exist yet (`docs/architecture/federation.md`, design only).

Why one writer: the routine cycle starts runs, the sweep releases claims, moves tasks and accepts reviews, the
dispatcher starts sessions. Two of each against one board would start every run twice. The client runs none of them;
the switch for the dispatcher already exists (`dispatchBoardRequests`), the others gain the same role check.

## 3. What changes in Fabric

1. **A role in settings**, `boardRole: "host" | "client"` (default `host`, so every install behaves as today) and,
   for a client, `boardHost` (an ssh host name, read by `shared/boardDispatch.ts#dispatchTargetOf`'s rule).
2. **The client opens its own tunnel**: `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:<free port>:127.0.0.1:54321
   <boardHost>`, restarted with the stack watch's backoff (10 s to 2 min), killed on quit. It reads the host's service
   key once per start with `ssh <boardHost> supabase status -o env` in the host's stack folder, holds it in memory, never
   writes it to disk, argv or the log. Then `resolveSupabaseEnv` answers the tunnel's URL and that key, the external-stack
   branch that exists today.
3. **Background writers check the role**: the cycle, the abandoned-work sweep (with its review default), the
   dispatcher and the daily digest sender start only on `host`; on a client the lifecycle table says so.
4. **The stack watch on a client** watches the tunnel and the remote `schema_version` read; it never runs `supabase
   start`, `stop` or a heal (the external-stack rule), and says «доска на Studio недоступна» when the tunnel is down.
5. **Migrations** run only on the host; a client whose `schema_version` is behind its own build refuses writes and says
   which version the host needs (one Fabric version on both machines is the rule).

Each of 1 to 5 carries its region marker and its test (TDD), in a 0.3.21 release after 0.3.20.

## 4. The move (one cutover, reversible)

1. Release 0.3.20 (per-owner `dispatchTargets`), then 0.3.21 (this design), on both machines.
2. Studio `sshlg`: `colima start`, Fabric 0.3.21 starts its stack (empty).
3. MacBook: Fabric quits its writers (role `client` set but not yet pointed), `pg_dump` of `postgres` from
   `127.0.0.1:54322`, copied over ssh, restored on the Studio's stack; row counts of `events`, `tasks`, `board_messages`
   and `projects` compared on both sides; the journal's last `seq` equal.
4. MacBook: `boardHost: studio-sshlg`, restart; Fabric reads the Studio's board; agents re-enroll by themselves
   (`fabric-mcp` rejoins after a restart).
5. Studio Fabric: `dispatchBoardRequests: true`, `dispatchTargets` by owner: `ssheleg` runs in its own space,
   each organization's owners in that organization's space.
6. Rollback for 14 days: the MacBook's stack volume is stopped, not removed; `boardRole: host` and a restart bring the
   old board back (writes made on the Studio after the move are then the Studio's only).

## 5. Found on the way

The MacBook's stack publishes its API and its database (default password) on `0.0.0.0`, so any machine on the same
LAN can reach them; Tailscale and the firewall block the Studio today, nothing in Fabric does. The host must publish
on `127.0.0.1` only (the tunnel needs nothing else). Filed with this design.

## 6. Open, decided here

| Question | Decision | Why |
|---|---|---|
| Which Studio space hosts the board | `sshlg` | the operator's own estate; the other two are organizations' spaces |
| The organizations' spaces | keep their own Fabric, not joined to this board | separate organizations; their boards are a later federation step |
| Sessions the board starts | on the Studio, in the space of the repository's owner (`dispatchTargets`) | the Studio holds the checkouts and never sleeps |
