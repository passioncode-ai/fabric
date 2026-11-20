---
report: fabric-ceo-access-audit
date: 2026-11-20
project: fabric
kind: audit
status: open, gaps closed on branch feat/ceo-access as listed
---

# What the CEO and its voice can reach, and what they lack, 2026-11-20

The owner's order (CEO window, 2026-11-20, paraphrased per ADR-0096): check that Fabric's CEO has all the access it
needs, and let the owner start a session with a chosen agent or subscription by voice or through the CEO
(`userData/ceo/inbox/2026-11-20-launch-picker-ceo-access-memory-brief.md`, points 1 and 2; point 3, «Memory», is another
session's). Sources: the code at `cbc57ae3` (the 0.3.27 candidate), Observatory's MCP inventory of this computer
(`machine.mcp.inventory`, taken 2026-11-20 19:57 UTC), and what the CEO did by hand that day (its report in the inbox).

## Where the CEO's access comes from

- **The CEO's console** is a Fabric console running Claude Code in `<userData>/ceo` (ADR-0197). It gets Fabric's
  session MCP server (the agent surface: the board `com.*`, tasks `fabric_task_*`, work and memory, and the CEO's own
  `fabric_ceo_*` tools, `main/ceoTools.ts#registerCeoTools`), plus every MCP server of Claude Code's user scope on this
  computer: 25 in the inventory, among them Project Observatory, Switchboard (plugin), the owner's communicator, the
  knowledge graph, Fabric Dashboards, the local lifecycle broker, and the owner's agent services (research, media,
  texts, store work, search, analytics and growth). Under the Hermes fallback the console reads Hermes's
  own MCP configuration instead, which this audit did not read.
- **The voice** has the CEO's session tools as `session_*`, `ask_ceo`, and its own `ceo_reply`, `machine_status`,
  `board_search` and `recap` (`main/ceoVoiceTools.ts`). Everything else goes through `ask_ceo` to the console.

## Needed, held, gap, and how it closes

| What the CEO needs | Console | Voice | Gap | How it closes |
|---|---|---|---|---|
| See every session, read one, type into one | `fabric_ceo_sessions`, `_session_read`, `_session_input` | the same | none | |
| Start a session in a project with a chosen agent | `fabric_ceo_session_start` `runner` | `session_start` `runner` | none for the agent | |
| Start it on a chosen account or subscription (Switchboard) | no | no | **G1**: no account beside the runner; the owner's «запусти на аккаунте Y» cannot be done | this branch: `account` on the start, run through `switchboard launch <id> --in-place`; the accounts and their quota left in `fabric_ceo_accounts` (voice `session_accounts`); the voice hears «на Codex», «на аккаунте Y» |
| Know that a started session took its task | `first_task`, `fabric_ceo_session_task` (0.3.27) | `session_task` | closed in 0.3.27: before, the CEO grepped Claude Code's transcripts in `~/.claude/projects` | |
| Wait for a session's answer, then read it | no: the CEO polled the screen | no | **G2**: no wait | this branch: `fabric_ceo_session_wait` (voice `session_wait`): waits until the console has been quiet after it printed, bounded, and answers its last turns |
| The board: requests, replies, tasks | `com.*`, `fabric_task_*` | `board_search` (messages) | tasks not by voice (CO-605 (3)) | |
| Tell the owner | the owner's communicator | through `ask_ceo` | none | |
| Write to someone else in Telegram | no: `telegram-gateway` is not in Claude Code's user scope, and the CEO holds no gateway grant | no | **G3** | a board request to the Telegram gateway's project for a CEO grant and its MCP entry; until then, the CEO says it cannot |
| Ask another agent as the CEO (Morpheus `morpheus.ask`) | `morpheus` answers, but the CEO has no identity at its door | no | **G4** | owned by session c870c4ab (Morpheus); Fabric names the dependency, nothing to build here |
| Accounts and quota | `switchboard` MCP (reads usage) | no | part of G1 | G1's `fabric_ceo_accounts` |
| Knowledge of the projects | `knowledge-graph`, `observatory`, `fabric_memory_*` | no | «Memory» is another session's order | |
| Run under the fallback runner with the same doors | Hermes's own MCP list, not read | | **G5**: unknown | measure on the next fallback; carry |

G1 and G2 are built and tested on `feat/ceo-access` (see the CHANGELOG's unreleased section there). G3, G4 and G5 are
recorded where they belong, with their owners.
