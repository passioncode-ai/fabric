# Audits — PassionCode.ai / Fabric

Audits are dated evidence snapshots. Their source revision says what was inspected;
proposals and passing checks do not imply that every proposed feature is implemented.

- **2026-09-15:** [Fabric: архитектура, R0/R1 и сохранённая очередь](2026-09-15-launch/index.html), [пакеты](2026-09-15-launch/packets.md), [инвентарь](2026-09-15-launch/inventory.json). Предложение по запуску, source `d0260d4`; текущий следующий пакет D01.
- **2026-09-14:** [Аудит контекста и хронология](2026-09-14-context/index.html), [история Git](2026-09-14-context/history.json).

- **2026-09-09:** [Final audit and agent packets](2026-09-09-final/index.html), [Markdown](2026-09-09-final/index.md), [JSON](2026-09-09-final/index.json). Source `d28c321`; reconciles all 80 baseline scenarios plus 9 later provider scenarios, 43 prior findings and the current queue.
- **2026-09-09:** [Provider accounts — Orca, cswap и Fabric](2026-09-09-provider-accounts.md) — подключение, swap, сохранность сессий и воспроизводимая проверка quota identity; CO-112.

- [Living product and design map](../reports/map.html#changelog) — latest iteration and exact review sections.
- [2026-09-07 priority review](../evidence/plans/2026-09-07-foundation-priorities.md) — updated dependencies and S→M/CO ownership; the original report remains the audit snapshot.
- [Visual product review](../reports/product.html#journeys) — walkthroughs, all screen addresses, source findings and developer packets; [retained delivery](../evidence/plans/2026-09-07-product-walkthrough.md).
- [Current delivery queue](../evidence/backlog.md#build-order-by-layer) — current order and dependencies.
- **2026-09-07:** [merged audit and execution plan — interactive report](2026-09-07-merged-execution-plan.html),
  [Markdown](2026-09-07-merged-execution-plan.md), [JSON](2026-09-07-merged-execution-plan.json).
  Source: `153b4f029e626230d465d5d21d02fb8c9de5fadf`. Includes the supplied layered plan,
  requirement mapping, graph semantics, manager lifecycle, memory, sync and retro.
- [Baseline deep audit](2026-09-07-deep-audit.html) and [evidence inventory](2026-09-07-evidence/index.md).
  The earlier [work plan](2026-09-07-work-plan.md) is historical; the merged plan supersedes it.
- [2026-09-05 audit](2026-09-05-audit.html) remains the earlier snapshot tracked by CO-107.

Open HTML files locally or serve only the `docs` directory: `python3 -m http.server 8770 --bind 127.0.0.1 --directory docs`. These files
are self-contained reports, not a public site. Product state remains in the backlog;
the audit retains the state at inspection. New corrections are appended with their
source revision instead of rewriting old receipts.
