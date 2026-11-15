---
report:
  id: fabric/2026-11-15-quality-audit
  title: "Quality audit after 0.3.21: open work, interface, performance and a bug tracker"
  kind: audit
  project: fabric
  domains: [ux, performance, reliability, observability, backlog]
  as_of: 2026-11-15
  status: active
  valid_until: 2026-12-15
  summary: >-
    Four read-only passes ordered by the operator on 2026-11-15: every open item in one inventory (364, from
    GitHub, the board and the carry-over register), an interface audit (23 findings, 2 blocking, in Переписка),
    a performance and errors analysis of the installed 0.3.20 over 7 days (the database lost 9 times on a near full
    disk), and a design for a bug tracker on our own analytics. The waves that fix them are the plan
    docs/evidence/plans/2026-11-15-quality-waves.md.
  sources:
    - name: "Reviewed source, 0.3.21's verified commit"
      url: "https://github.com/passioncode-ai/fabric/tree/819b4bc7718fa5019665223a16b09f86f57dde99"
      read_at: 2026-11-15
---

# Quality audit after 0.3.21

The operator's words, 2026-11-15: «Давай запускай анализ интерфейсов, и глюков, задержек, производительности и
корректности работы багов. Добавь также баг-трекер, чтобы корректно собирать всю аналитику ... посмотрим на гитхабе
все issues и вопросы, какие есть на доске задач, соберем ... в один план и волнами ... до самого конца».

| Part | What it holds |
|---|---|
| [Inventory](2026-11-15-inventory.md) | Every open item: GitHub (0 in this repository, 9 elsewhere naming Fabric), the board (29 tasks, 14 messages asking for a fix), 315 open carry-over rows; by class and severity, with duplicates named. Classes are a triage hint. |
| [Interface](2026-11-15-ui.md) | The interface audit at `819b4bc7`: layout stress at four widths, contrast in both themes, the string registries. 23 findings. Coverage gap: the line-by-line reading of `ru.ts` and the screens-against-scenarios walk did not finish. |
| [Performance](2026-11-15-performance.md) | The installed 0.3.20's operations log and digests over 7 days: PF-1 to PF-13, ranked fixes. |
| [Bug tracker](2026-11-15-bug-tracker-design.md) | What is captured and lost today, the events, consent, fingerprints, the board and GitHub path, the third-party choice, six waves. |

The plan: [the quality waves](../../evidence/plans/2026-11-15-quality-waves.md).
