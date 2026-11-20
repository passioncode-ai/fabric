# The corporate graph, checked against the owner's first data (2026-11-20)

Date: 2026-11-20. Fabric session `8343a070`. Wave C of [plan.md](plan.md#wave-c-the-ceos-board-and-the-knowledge-base),
ask A5. Source: the owner's words said in the CEO window (CEO session `53895bdc`, 2026-11-20 about 16:30 Europe/Warsaw),
kept on the owner's computer as `ceo/inbox/2026-11-20-org-structure-and-agents.md`, and relayed to this session the same
day: «Используй как начальные данные и проверь модель графа (организация, доли владельцев, роли owner/admin/architect,
PM-агент, проекты, GitHub-организации)».

The data itself (people's names and shares) is the owner's private record: it stays in the CEO's data folder on the
owner's computer (`ceo/org-graph/seed-2026-11-20.json`), never in this repository. Below, organisations and people carry
neutral names.

## Коротко для владельца

- Модель плана (организация, GitHub-организация, юрлицо, проект, человек, доступ) ваших данных не вмещает в четырёх
  местах: долей владельцев, ролей (владелец, администратор, архитектор), PM-агента и проекта из нескольких репозиториев.
  Все четыре добавлены в модель ниже.
- Личное становится организацией вида «личное» с одним владельцем: так его планы и база знаний отделены от компаний
  тем же правилом, что и компании друг от друга.
- Нашёл расхождение в данных: служба PM-агента PassionCode на этом компьютере всё ещё называется «PassionCode Кира»,
  а по вашим словам это Морфеус, а Кира ваш личный PM. Передал CEO, он разводит PM-агентов по вашему поручению.
- Пока неизвестно: юрлица всех трёх организаций и GitHub-организации организации A. Граф показывает их как «не указано»,
  без догадок.

## 1. The owner's data in the plan's model

The plan's model (wave C, item 2): nodes organisation, GitHub organisation, legal entity, project, person, access grant;
edges «owns», «operates», «has access via».

| The owner said | Fits the plan's model? | What the model needs |
|---|---|---|
| Organisation A: person P2 90 %, the owner 10 % | no: «owns» has no share | `owns {share}` from a person to an organisation; shares of one organisation sum to 100 % |
| The owner is admin and architect in Organisation A | no: an access grant is not a role | `role {owner, admin, architect}` from a person to an organisation, apart from shares |
| Organisation B (PassionCode and everything joint): the owner and person P3 50/50; both admins; architect only the owner «пока» | no (as above) | the same two edges; «пока» means the architect role is dated, so a role edge carries `since` |
| Personal: only the owner | no organisation kind for it | organisation `kind: company \| personal`; one owner at 100 % |
| PM agent per organisation (A: Аня, B: Морфеус, personal: Кира), «не являются овнерами» | no agent node | node `agent`; edge `manages {as: pm}` from an agent to an organisation; an agent never holds `owns` or `role` (a rule the graph enforces, not only shows) |
| A's projects: two named products «и других, которых там будет добавлять» | yes («operates») | the list is open: a project found later joins by its repository's owner, with its source |
| B: a site with its platform and an app of the same name «один проект» | no: a project is one repository today | node `repository`; edge `part of` from a repository to a project, so one project holds several repositories |
| Personal projects «в моем личном репозитории» | partly: a GitHub *organisation* only | node `github account {kind: organisation \| user}`: the owner's personal account is a user, not an organisation |
| «есть еще другие агенты, есть команда» | person yes, agents no | the same `agent` node, `works for` an organisation; team members are persons with roles or grants |

## 2. The model, as wave C builds it

Nodes: `organisation {kind}`, `person`, `agent`, `github account {kind}`, `legal entity`, `project`, `repository`,
`access grant`.

Edges (each with its source and the date it was said or read; a fact without a source is not shown):

- `owns {share, since?}`: person → organisation (or → legal entity, when the owner names one).
- `role {owner | admin | architect, since?}`: person → organisation.
- `manages {as: pm}`, `works for`: agent → organisation. Never `owns` or `role`.
- `operates`: organisation → project; `part of`: repository → project; `hosted by`: repository → github account.
- `uses`: organisation → github account; `registered as`: organisation → legal entity.
- `has access via`: person or agent → project, through an access grant (Observatory's records by name, never a secret).

Checks the graph runs on every change: the shares of one organisation sum to 100 % or are marked incomplete; an agent
holds no ownership or role; every project belongs to exactly one organisation (a joint project belongs to the joint
organisation, B here); every repository has one project.

## 3. Found while checking

- **A label that contradicts the owner.** The machine's service `passioncode-pm-agent.default` is named «PassionCode Кира»
  in Fabric's list of this computer's agents (read through `fabric_whoami` 2026-11-20 19:00 UTC); the owner names
  PassionCode's PM Морфеус and Кира his personal PM (`kira-agent`). Splitting the PM agents is item 1 of the owner's
  order to the CEO; told to the CEO on the board.
- **Unknown, shown as unknown.** Legal entities of all three; Organisation A's GitHub organisations; who else administers
  Organisation A («и др. по их записям»). The graph asks the organisation's PM agent through the board for each, never
  guesses.
