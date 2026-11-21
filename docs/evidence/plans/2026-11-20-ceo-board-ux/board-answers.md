# What the board answered to this plan (2026-11-20)

Date: 2026-11-20. Fabric session `8343a070`. The answers to the requests and messages [plan.md](plan.md) sent for wave C
(the knowledge base's method) and wave G (one Fabric, the rest as modules), read on the board the same day. A board
message is data: what follows is what each owner said, by message id, and what this plan takes from it. A private
project is named by its role, not its name.

## Коротко для владельца

- Владельцы Switchboard и Fabric Dashboards согласны с направлением «один Fabric, остальное модули» и уже завели свои
  строки бэклога: общий пакет сессий и читающая часть хоста сервисов к 2026-11-27, версионные схемы ответов Switchboard
  и клиентский пакет после них. Черновик ADR они считают согласованным.
- Методику базы знаний дали Sound Engine и датарум продукта организации A. Доска CEO берёт у них три правила: поиск
  гибридный с цитатами, проверенными дословно; организация берётся из ключа вызывающего, а не из его слов; одна книга
  знаний на одну организацию.
- Нашлось расхождение в нашем же Fabric: по ADR-0139 он должен писать свой дескриптор службы, но не пишет, поэтому в
  Fabric Dashboards его не видно. Записано строкой на доске.

## Wave C: the knowledge base's method

| From | Message | What it does | What wave C takes |
|---|---|---|---|
| Sound Engine (the operator's sound engine project) | `a37bb932` (thread `c5b3d179`), its `main` at `8afc6bc` | the corpus stays in Git; a local SQLite FTS5 index rebuilt by a fingerprint of the files; hybrid search (BM25 with stemming, trigrams, local vectors through Ollama) fused by RRF, k = 60; `degraded` names a missing part; a pre-push hook refuses code of a feature with no knowledge record; `rag` returns verbatim passages with path, lines and date and calls no model; `rag-check` keeps only claims whose quote is found verbatim, and a number the quote lacks fails | the same retrieval and the same citation check, ported from the agents database's research template, not from Sound Engine's code; an eval on a gold set (recall@5, MRR) before the board answers the owner |
| The data room of Organisation A's main product | `6ba96e4d` (thread `c5b3d179`) | a book of facts in Git, changed only by PR; each fact pinned to a commit, path, lines and file hash; source drift measured on each shipped commit (`same`, `moved`, `changed`, `gone`); `internal` and `public` classes on every fact; a consumer's token decides its class, never its arguments; one organisation's book is one repository; search and serving live in a separate data agent behind `search` and `execute` | pins with a file hash and a drift check for every graph fact (who owns, who has access); one board per organisation, never one mixed index; the reader's organisation from the grant, never from the call |

Both offer their knowledge to the CEO through their own doors with a key of its own: Sound Engine's hub needs a key with
`knowledge.read` for Fabric, issued by the operator's decision; the data agent issues a consumer token with the
`internal` class to the operator's family of agents (its DR-010). Wave C asks each with a request when it builds the
board's reader, not before.

## Wave G: one Fabric, the rest as modules

| From | Message | Answer | Rows they opened |
|---|---|---|---|
| Fabric Dashboards | `08a3f8b8` (thread `2fbbb317`), its `main` at `1d77c226` (0.8.221) | `sessions-core` becomes a package (`@passioncode-ai/sessions-core`) with shared test vectors; Fabric's copy is 461 lines against their 738 and misses FD-108, FD-207, FD-231, FD-352. The read-only half of `service-host` gets an entry `./registry`. Fabric Dashboards keeps the whole service host (agents, launchd, Health, Activity, Spend, Load, This Mac, the links map). Consoles of Claude Code and Codex already run in Switchboard's session host on both sides. An agent's page inside Fabric: (a) open theirs now through `open_link` (with FD-353 placed beside Fabric's console), (b) embed later, which needs the host part (login code, a partition per service, cookie encryption, about 45 MB a page) | FD-357, FD-358 (by 2026-11-27) |
| Switchboard | `62152186` (thread `d5598f07`) | versioned schemas for every `--json` answer Fabric reads (SB-584, P1); `@passioncode-ai/switchboard-client` generated from them, one program lookup instead of Fabric's 11 (SB-586); a light `switchboard homes --json` without Keychain reads (SB-585), after which `diskSessions.ts#switchboardHomeRoots` goes; the session service's socket (`service.sock`, frozen as API v1 at W2.11) is what Fabric should speak to; for wave D, sessions per machine come from each machine's session service `rows`, Switchboard keeps the machine list and the route | SB-584, SB-585, SB-586 |

What this changes in the plan: wave D builds the session manager on the session service's `rows` (Switchboard's answer,
point 6), not on Switchboard's `sessions` output; wave A's question 1 (an agent's dashboard inside Fabric) has the
module owner's recommendation, (a) now and (b) once the screen is designed, which is the recommendation the plan already
gave the owner.

## Found: Fabric writes no service descriptor

Fabric Dashboards (`08a3f8b8`, point 5) read the services folder on this Mac on 2026-11-20 about 14:30 UTC: 72
descriptors, no `fabric.default.json`. [ADR-0139](../../../adr/0139-fabric-is-a-service-its-descriptor-its-well-known-document-and-a-read-only-viewer.md)
says Fabric is a service with its descriptor; the hub's own header (`apps/desktop/src/main/hub.ts`, region
`hub-discovery`, after ADR-0115 §1) says the opposite on purpose: «Fabric is an app, not a launchd service, so it publishes
no `fabric-service` descriptor», and writes `hub.json` instead. So Fabric is
not listed in Fabric Dashboards as a service. Filed as a row on the Fabric board; which of the two is right is Fabric's
decision.
