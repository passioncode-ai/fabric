# The fabric is standalone, and the terminal runs inside it

- **Status:** Accepted
- **Consequences / affects:** `docs/vision.md`, `docs/evidence/backlog.md`, `CONTEXT.md`, `docs/evidence/specs/…-carryover.md` (CO-001)
- **Source:** operator decision, 2026-08-19, after the competitive measurement of 2026-08-19

## The alternative that was measured and declined

On 2026-08-19 three shipping products were measured against this project. One of them,
**Paperclip** (MIT, TypeScript + Postgres, 78 841 stars, 14 452 forks, pushed the same day),
models a company made of agents and has **already shipped** what seven of this project's
milestones describe: an org chart with roles and reporting lines, budgets with atomic
hard-stops, approval gates, scheduled routines with cron and webhook triggers, a plugin
system with out-of-process capability-gated workers, an MCP tool gateway, runtime skill
injection, git-worktree workspaces, and revisioned plans with plan approval.

The alternative was therefore real: **build the observer, adopt the company** — the fabric
would own the estate registry, the collectors and the declared-versus-observed comparison,
and hand goals into Paperclip for execution. It would have collapsed sixteen milestones to
about five.

**Declined.** The fabric is a standalone product. The operator's reason is that one piece of
software must watch everything — an operator who has to open a second application to see
what an agent is doing has the coordination problem back, one layer higher.

## What was decided

1. **The fabric does not sit on another orchestrator.** No adoption, no plugin slot in
   somebody else's product, no dependency whose roadmap decides ours.
2. **Choosing an agent and launching it with a task is a first-class action in the fabric**,
   not a shell-out. The operator picks the agent; the fabric hands it the node.
3. **Real console terminals run inside the fabric.** Not a log tail, not a transcript view —
   the terminal the agent actually runs in, rendered in the product, with the agent's output
   live and the operator able to type into it.
4. **The CEO monitors those same terminals.** Agent progress is read from the running
   session rather than reported by the agent about itself, which is what makes progress an
   observation rather than a claim (`CONTEXT.md`).

## The cost, stated rather than discovered later

This decision buys independence and pays for it twice.

- **It rebuilds what exists.** M3, M6, M7, M11, M13, M14 and M15 all have shipped
  counterparts in Paperclip. This is now a deliberate rebuild, not an oversight, and no later
  run may cite the overlap as a new finding.
- **The terminal layer is the most expensive component in this class of product.** Measured
  against Orca (MIT, 2026-08-17): five patches to `@xterm/*`, one to `node-pty`, a WebGL
  renderer, scrollback that survives restarts, cold-terminal parking, and a benchmark suite
  gating typing latency and foreground redraw. A terminal that drops output under load or
  lags on keystrokes reads as a broken product no matter how good the graph above it is.

**Mitigation, and it is not a compromise of this decision:** the expensive parts of the
terminal layer are MIT-licensed and can be lifted rather than written — the `node-pty` and
`@xterm/*` patches, the PTY provider shape, the SSH provider. Lifting a component is not
depending on a product; the seam is a library, not a roadmap.

## The non-obvious consequence: this does not force Electron

"Terminals inside the fabric" reads like a desktop-shell mandate. It is not. A real console
terminal needs two things — a PTY host process and a terminal renderer — and both shapes
satisfy this decision:

| Shape | PTY host | Renderer | Verdict against CO-001 |
|---|---|---|---|
| Electron end-to-end | main process | `xterm.js` in the renderer | satisfies it |
| Local web UI over a privileged daemon | the daemon | `xterm.js` in the browser, over a WebSocket | **also satisfies it** — the browser tab *is* the fabric |

So **CO-001 stays open and is merely constrained**: whatever shape wins must host a PTY and
stream it at interactive latency. The leading option recorded at stage 0 — local web plus a
privileged daemon, with an Electron wrapper later — survives this decision intact.
