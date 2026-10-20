Contract: brand-contract v1

# Terminology

## Product terms: always

| Our term | Never write | Applies to |
|---|---|---|
| Agent Bootstrap Recipe | magic prompt, onboarding prompt | the versioned, copyable recipe used to adapt or create a provider |
| Provider | bot integration, random plugin | a versioned implementation bound to an Agent role |
| Role workspace | custom dashboard, employee panel | the scoped work surface assembled for a person or role |
| Evidence | AI explanation, confidence text | the sources, checks and receipts attached to work |
| Effect | action, side effect | a change outside the control plane that requires authority and a receipt |

## Entity and tier names: exact spelling

| Name | Wrong forms seen |
|---|---|
| PassionCode.ai | Passion Code, Passion Code AI, patient code |
| Fabric | fabric, Software Fabric when naming the current product or kernel |
| Fabric Switchboard | Fabric Switcher, F Switchboard; use Switchboard as the short form |
| Fabric Inbox | Fabric Mail; use Inbox as the short form |
| Comms | comms, the comms; the name of the operator's screen for what projects tell each other (Russian «Переписка»), and what that screen calls its source |
| Fabric Agent Adapter | Fabric Adapter, Fabric agent adapter; the published skills that adapt a project to the Fabric protocol |
| Coding agent | Runner, runner, executor |
| First run | onboarding wizard, setup tour |
| Start path | wizard |
| Claude Code | Cloud Code, CloudCode |
| Codex | CodeX |
| AI-native team | AI team, autonomous company |
| Agent | agent bot, chatbot when the role is not conversational |
| Provider | provider agent, adapter when naming the bound implementation |
| Project | workspace when naming the durable operating boundary |
| Estate | organization tenant, company tenant |
| Passion coding | passionate coding, passion fruit coding |
| Mac | MAC (the computer the app runs on) |
| Project Observatory | Observatory alone in the interface's first mention; the machine's project and credential registry whose vault keeps a connected product's key |
| Gmail | GMail, gmail (Google's mail service, an account kind Fabric Inbox reads) |
| Docker Desktop | Docker desktop (the Docker app on Windows and macOS that runs the local stack) |
| Docker Engine | Docker engine (Docker on Linux, without Docker Desktop) |
| Supabase CLI | Supabase cli (the command-line tool that starts the local stack) |
| Windows | MS Windows |
| AppImage | Appimage (a Linux package Fabric ships as) |

The wrong forms above are literal strings the brand lint looks for in the English registry. In Russian a coding agent is «агент для кода» — never «агент» alone where a runner is meant, and never «раннер»; the lint does not read the Russian registry, so review it by hand.

PassionCode.ai is the full name. PassionCode is the approved short family label in running text
(as on the public site); it is not a wrong form.

The rail's lockup «by PassionCode» (`rail.brand`) stays in English in every locale: it is the brand mark beside the
product name, like a logo, not running text (decided 2026-10-20, the 0.3.7 review UX-6 and its iteration 2 UX-7).

## Banned

| Word or phrase | Why | Use instead |
|---|---|---|
| seamless | hides the step and cannot be proved | name the step that disappeared |
| revolutionary | unsupported superlative | state what changed |
| fully autonomous | erases authority and escalation boundaries | state the granted autonomy level |
| replace your team | contradicts the people-and-agents model | assemble or extend the team |
| magic | hides the contract and checks | name the recipe, adapter or check |
| AI-powered | says nothing about the capability | name the agent role or outcome |
| ecosystem | vague unless the participants are named | name the components or contributors |
| ответчик | in Russian it is the defendant in a lawsuit, not an agent that answers requests | «отвечающий» («отвечающий №n»), or «агент, отвечающий на {capability}» |

## Glossary

| Term | Meaning |
|---|---|
| PassionCode.ai | The organization, whose toolkit is for AI-native teams; PassionCode is the short family label (ADR-0086, ADR-0090). |
| Fabric | The CEO AI agent for coordinating agents and Projects, in development; “Fabric the kernel” retains the technical meaning in contracts. |
| Fabric Switchboard | The standalone AI-provider account-management desktop product; Switchboard is the short form. |
| Fabric Inbox | The standalone desktop email product in development preview; Inbox is the short form. |
| Vibe coding | Directing coding agents at the level of prompts, chats and tasks; a useful starting mode whose coordination cost rises across many Projects. |
| Passion coding | Operating the Project as the durable unit: purpose, team, roles, Routines, authority, work, Evidence and feedback loops stay together while agents may change. |
| AI-native team | People and agents working through shared projects, authority, evidence and operating loops. |
| Estate | The isolation and ownership boundary for a person or organization. |
| Project | A persistent operating boundary containing purpose, roles, agents, routines, work and history. |
| Agent | A durable role with capabilities and policy; it is not the model or process implementing it. |
| Provider | The replaceable implementation that can serve an Agent role after conformance and admission. |
| Routine | Recurring work that survives provider replacement. |
| Run | One execution pinned to the project, routine, provider and policy revisions used. |
| Interaction point | A typed place where a person, role, agent or estate may submit or resolve work. |
| Role workspace | A host-controlled projection of the work, context and actions available to a person or role. |
| Agent Bootstrap Recipe | A versioned handoff that guides a coding agent through adaptation or creation; it grants no authority. |

## Hub access terms (English / Russian)

These terms describe ADR-0115; secrets remain in the main process.

| English | Russian | Meaning |
|---|---|---|
| Hub | хаб | Fabric’s local door for registered agents |
| Door token | токен входа | May ask for access and read a request with its poll secret; grants no product call |
| Binding credential | учётные данные привязки | An agent’s credential for Fabric, bounded by the grants; never the product’s key |
| Access grant | разрешение доступа | One capability on one resource, until expiry or revocation |
| Product connection | подключение продукта | Product key metadata in Fabric and its secret in the vault |

## Project communications terms (English / Russian)

These terms describe ADR-0117 and SCN-143 (corrected 2026-10-13), and ADR-0156 with SCN-147…SCN-149 (wave 4, 2026-10-13; designed, not built).

| English | Russian | Meaning |
|---|---|---|
| Comms | Переписка | The operator's screen for what projects tell each other, and the word that screen uses for its own source ("Comms did not answer." / «Переписка не ответила.»). Never "the board" / «доска» in its text: the rail's Board / «Доска» is the task board |
| Pause | пауза («поставить на паузу», «на паузе») | The estate owner's **Board hold** on a thread, a project's answering or one responder slot (ADR-0156; designed, wave 4): it stops new work and never what agents report about work already taken. Never "stop", "freeze" or «заморозить»: a pause cannot stop an effect already running |
| Resume | возобновить («Возобновлено.») | Lifting a pause; agents' refused calls go through when sent again |
| Responder #n | отвечающий №n | The agent holding a project's responder slot for a capability, and the slot's generation; never «ответчик» |
| Settle with a summary | закрыть с итогом | The estate owner's settlement of a request whose outcome is unknown and whose slot no responder holds (contract DEC-0081; designed, wave 4): observed only, with what the owner observed; never "close", «отменить» or "resolve" |
| Project directory | каталог проектов | The Settings screen where the owner chooses which projects other projects can find ("Listed for other projects" / «Виден другим проектам»); unlisting hides a project from the list only |
