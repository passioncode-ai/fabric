# Telegram board transport research handoff

Objective: elaborate COM-08/COM-09 without live bot/chat writes or credential values. Entry:
[RPT fabric/2026-10-04-telegram-board-transport](../reports/2026-10-04-telegram-board-transport/README.md).
This is a source packet for coordinator convergence, not a second task-status source.

Completed: current Telegram features/API/changelog and maintainer threads, adapter origin/main
0.7.0 and contract lock checked; durability, unknown sends, mapping/privacy, replacement,
extensions/versions, proposed write sets, failure inventory and all-NOT_RUN live matrix written.
No I3 findings read or independent I3 review claimed.

Proposals: Fabric owns board/admission/outbox/fences; optional Adapter worker uses existing
service/interop helpers; Telegram settings are capability-probed; unknown sends are not
automatically resent. No settled ADR was created. Root owns canonical task status/decisions.

Prerequisites: converged COM-01 schemas/admission, COM-02 persistence/outbox, COM-03 consumer
fences, COM-04 real-provider continuation and COM-06 disclosure/scenarios. Existing hub
binding is not communication authority. Live enrollment needs named vault slots, rights and
separate live authorization; webhook additionally needs an HTTPS deployment owner.

Checks: [raw/checks.json](../reports/2026-10-04-telegram-board-transport/raw/checks.json).
Baselines: [raw/baselines.json](../reports/2026-10-04-telegram-board-transport/raw/baselines.json).
No implementation, live provider/bot, release, install, paid operation or deploy checks.

Coordinator next: converge this packet with project-communications spine; update map iteration
and canonical source references under current lease; run map refresh/check and fast; index
report after pushed convergence. Workspace publication remains scheduled/explicit follow-up.

Exact first implementation task: TG-A lost-send-response fixture must fail when unknown is
changed to retry and pass with zero automatic resends; then durable inbox and generation
fixtures, before enrollment or real send.

Branch: codex/telegram-board-transport-research from Fabric origin/main
41f994a709990ad72621fa834768a8833e7d93e1. The delivery message supplies the committed SHA and
remote verification; a pushed source packet is neither merge nor publication.
