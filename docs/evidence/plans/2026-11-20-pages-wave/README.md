# The pages wave: agent, project, home, and the chain of decisions (2026-11-20)

Date: 2026-11-20. Fabric session `8343a070`, branch `feat/pages-wave`. Board row `6f1c7f99`. Source: the owner's words said
in the CEO window about 21:30 Europe/Warsaw, kept on the owner's computer as
`ceo/inbox/2026-11-20-fabric-pages-agent-project-home-brief.md`, relayed to this session the same day.

## Коротко для владельца

- Макеты четырёх экранов: [страница агента](mockups/01-agent.html), [страница проекта](mockups/02-project.html),
  [главная](mockups/03-home.html), [цепочка решений](mockups/04-decision-chain.html); [оглавление](mockups/index.html)
  с вашими словами и выбором по каждому экрану (у каждого выбора отмечен рекомендуемый: без вашего ответа строим его).
- Граф «откуда пришли, куда идём» и цепочка «человек сказал, агенты пошли» рисуются одним общим модулем графа
  (`@fabric/graph`, его ведёт сессия базы знаний Memory), не тремя копиями.
- Как устроены задачи и почему не брать open source под капот: [исследование](../2026-11-20-task-manager/README.md).

## What the mockups change

| Screen | Today | In the mockup |
|---|---|---|
| Agent | an agent whose session runs outside Fabric shows «нет сессии» and «нет задач» | its sessions at the side (in Fabric and outside, live first); in the centre what the agent is, its current task with where it came from (the owner's words, the CEO, the agent), the account and quota, the chain of decisions; empty blocks gone |
| Project | a narrow side column, mixed type sizes, «где мы» as three lists | the «Что за проект» column 1.5 times wider and first; questions to the owner on top; the path and decisions as an interactive graph with cards (timeline and table as alternatives); directions of work; a product board (objective with key results tied to metrics, metrics, backlog now/next/later, product notes); «Приоритет» order by drag in the rail |
| Home | counters of dashes, the work list | the light greeting kept; questions first with ready answers; pinned main projects; «В работе» with modes «Вехи», «Приоритет», «30 дней»; recent projects |
| Chain of decisions | the task's history folded at its bottom | right after the brief: the person's words quoted with where and when, the agents' steps folded into «агенты: N шагов» |

## Next

The owner's picks (or the recommended ones) go into `docs/ux/scenarios.md`, flows and `docs/ux/product-model.json`; then
the build, screen by screen, on the shared graph module once it lands on `main`, each screen walked on the stand and
reviewed by the design tester, captures to the owner per wave.
