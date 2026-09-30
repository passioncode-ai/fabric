# ADR-0031 — The v1 surface is a macOS desktop application with the terminal inside

**Status:** Accepted · **Date:** 2026-08-31 · **Source:** operator at the
iteration-ladder grill, 2026-08-31 · **Extends:** ADR-0008, ADR-0021 · **Settles:** the
host of M16/M17 for iteration 1

## Context

ADR-0008 requires real, typeable console terminals rendered inside the product, and the
runner contract names the TypeScript Agent SDK as the primary execution channel with the
CLI as fallback (`external-contracts.md` §1). The operator chose the surface at the
grill: a macOS desktop application, terminal-first, with UI assembled at React speed.
The choice of shell then follows from one asymmetry, checked against current
documentation on 2026-08-31: **Tauri runs Node code only as a sidecar binary** compiled
per target-triple and rebuilt on every SDK upgrade (tauri.app/learn/sidecar-nodejs),
with PTY on the Rust side — two runtimes for an app whose core dependencies (node-pty,
`@anthropic-ai/claude-agent-sdk`) are Node; **Electron ships Node** in the main process
and provides `utilityProcess.fork` with MessagePorts to the renderer
(electronjs.org/docs/latest/api/utility-process) — the sanctioned host for long-running
runner processes. xterm.js + node-pty is the same embedded-terminal stack VS Code uses.

## Decision

1. **Iteration 1 ships as a macOS desktop application: Electron + React
   (electron-vite), xterm.js + node-pty, packaged with electron-builder.** The hosted
   Claude Code terminal is slice-1 scope — ADR-0008 §3 is fulfilled by the first
   touchable slice, not narrowed.
2. **The main process is the v1 control plane.** It alone holds the Supabase service
   key and the journal writer; agent runs execute in `utilityProcess` workers driving
   the Agent SDK. The renderer never touches the database — a typed IPC bridge is its
   only surface.
3. **The code lives in this repository** as a pnpm workspace (`apps/desktop`,
   `packages/*`), beside the docs and registry it implements — giving the
   `pnpm registry:verify` commands the registry README already promises a home.
4. **This record governs the operator surface of iteration 1 only.** Member/role
   workspaces (horizon 2) are expected to be web surfaces; nothing here precludes them,
   and the renderer-through-IPC-only cut is precisely what keeps a later move of the
   control plane off the desktop (ADR-0016 hosting) a port rather than a rewrite.

## Alternatives considered

- **Local web dashboard** — was this run's own initial recommendation; reversed by the
  operator, and the terminal-first requirement makes a PTY host mandatory anyway, which
  a browser cannot be.
- **Tauri + React** — rejected for v1 on the sidecar asymmetry above; its footprint
  advantages do not offset recompiling the primary runner channel into a binary on every
  SDK release.
- **CLI/TUI first** — rejected: "one window covers the estate, the graph and the agents"
  (ADR-0008) is the point of the surface, and a TUI defers exactly that.

## What would reverse this

The control plane leaving the operator's desktop (hosted estates, ADR-0016 horizon 4)
forces the surface question again for owners; a new record decides web-vs-desktop then,
inheriting clause 2's seam. A measured Electron footprint problem on the operator's
machine would justify re-testing the Tauri path once the SDK no longer anchors Node in
the main process.
