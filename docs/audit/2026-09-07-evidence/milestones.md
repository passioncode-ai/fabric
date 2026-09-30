<sub>ssheleg skills — project-audit · ux-audit · agent-orchestrator · agent-harness · sheleg-design · brand-voice · copywriting</sub>

# Все M-строки исходного backlog

196 уникальных идентификаторов. Это полный инвентарь заявленных статусов на HEAD, а не оценка выполненности. Источник: `docs/evidence/backlog.md`; будущие предложения и поглощённые milestones сохраняются. Новый порядок работы находится в W01–W31.

| ID | Название | Заявленный статус | Строка backlog |
|---|---|---|---|
| M0 | Vision, ontology, decisions, the measured registry | **in review** | 15 |
| M1 | Schema and the declared-layer mirror | open | 16 |
| M2 | The graph: depth, payload edges, versioned rebuilds | open | 17 |
| M3 | The floor and grants | open | 18 |
| M4 | Collectors: Cloudflare, HTTP probe, GitHub | open | 19 |
| M5 | The dashboard: asset map and approval queue | open — the CO-002 gate note was stale; CO-002 is resolved | 20 |
| M6 | Departments, hiring, the terminal runner | open | 21 |
| M7 | The CEO: decompose, assign, escalate | open | 22 |
| M8 | Notifications across four transports | **partly shipped** — the first transport, and the one that needs no provider, key or configuration: the operating system’s own notification, fired only when the window is not in front, once per waiting thing, and collapsed to one message for a burst. **The other three are named rather than built**: mail, a chat channel and a phone each need a credential, a budget and somewhere to put a failure, and none of that is scheduled | 23 |
| M9 | Google: OAuth, Search Console, Analytics | open (gated on CO-004) | 24 |
| M10 | Service terminals on the board | open | 25 |
| M11 | **Connectors as plugins** | proposed | 175 |
| M12 | **Source cadence and processing** | proposed | 176 |
| M13 | **Checkups on a timer** | **partly shipped** — routines exist per project with the three rules a scheduler gets quietly wrong: a missed window is not made up, nothing starts over its own last run, and a routine that was due and did not start records why. The quota gate stands in front of every unattended start. **Not built:** per-kind checkups writing observations, which is what the row is finally about | 177 |
| M14 | **The fabric as the agent's counterpart** | proposed | 178 |
| M15 | **Bidirectional MCP control surface** — *southbound half shipped 2026-08-31*: the agent surface serves sessions Fabric starts, over the same Streamable HTTP server, credential-scoped, journal-backed. What remains is the northbound half: external clients, Estate-owned access bindings, the policy port and idempotent control commands (ADR-0026 §3–5) | **decided, unscheduled** | 179 |
| M16 | **The terminal layer** | **scheduled — slice 1** (ADR-0031) | 180 |
| M17 | **Agent picker and launch** | **shipped** — `b50ac83`: a third agent is one descriptor row, and the surface adapter it declares is dispatched rather than assumed — an unimplemented adapter now refuses instead of borrowing Claude Code’s flags | 181 |
| M18 | **Pipeline editor** | **decided, unscheduled** | 182 |
| M19 | **The growth loop as a pipeline** | proposed | 212 |
| M20 | **Producers other than the CEO** | proposed | 213 |
| M21 | **The content chain** | proposed | 214 |
| M22 | **`copywriter` as a service department** | proposed | 215 |
| M23 | **Attribution** | proposed | 216 |
| M24 | **`performance-marketing`** | proposed | 217 |
| M25 | **`ops-watch`** | proposed | 218 |
| M26 | **`domain-scout`** | proposed | 219 |
| M27 | **`support-manager`** | proposed | 220 |
| M28 | **PBN operation** | proposed | 221 |
| M29 | **The account registry** | proposed | 222 |
| M30 | **Outbound engagement** | proposed | 223 |
| M31 | **`emailer`** | proposed | 224 |
| M32 | **Capability registry and bindings** | proposed | 234 |
| M33 | **The bundle compiler** | proposed | 235 |
| M34 | **Transport adapters and the provider probe** | proposed | 236 |
| M35 | **Project-scoped organisation** | **decided, unscheduled** | 237 |
| M36 | **Agent marketplace** | proposed | 238 |
| M37 | **Agent production pipeline** | **decided, unscheduled** | 239 |
| M42 | **Wave 2 — the interface stops asserting what it cannot see** | **shipped 2026-08-31** | 250 |
| M43 | **Wave 2 — startup reconciliation** | **shipped 2026-09-01** | 251 |
| M44 | **Wave 2 — provenance in `memory_facts`** | **shipped 2026-09-01** | 252 |
| M45 | **Transcript capture — `transcript.captured@1`** | **shipped 2026-08-31** | 253 |
| M46 | **Retrieval decisions are logged, including the negative ones** | **shipped 2026-09-01** | 254 |
| M47 | **The memory eval fixture** | **shipped 2026-08-31** | 255 |
| M48 | **Bi-temporal validity, and the tiered read for FACTS** | **shipped 2026-09-01** | 256 |
| M49 | **The context pack with a lockfile** | **shipped 2026-09-01** | 257 |
| M50 | **The manager pre-fills a project from its repository** | proposed | 273 |
| M51 | **Agents mark the task they are working on** | proposed | 274 |
| M52 | **An instruction typed at an agent becomes a task** | proposed | 275 |
| M61 | **An agent proves it has the access it needs** | proposed | 276 |
| M56 | **Repository state** | **shipped 2026-09-01; the last commit reached a screen only 2026-09-05 (M113)** — measured, cached and unit-tested from the first day, rendered by nobody until now | 282 |
| M57 | **Statistics that measure the project, not Fabric** | **partly shipped; corrected 2026-09-05 (M113)** — commits and lines moved over a window now ship and are on the strip. **“Lines of code” is NOT shipped under that name**: the honest measure is tracked lines, and on this repository its two largest entries are an icon JSON and a font licence. **Tokens and cost are not shippable** — CO-096 measured the endpoint returning utilisation with every dollar field null and nothing per-project. The row claimed five numbers and shipped none; it now claims what exists | 283 |
| M58 | **Project analytics as its own screen** | proposed | 284 |
| M59 | **An agent tile that reports time honestly** | proposed | 285 |
| M54 | **A task opens into a detail** | proposed | 286 |
| M62 | **The project page is re-composed** | proposed | 292 |
| M53 | **Tasks as a list, running first** | proposed | 293 |
| M55 | **Add a task by hand** | proposed | 294 |
| M63 | **Window chrome** | **shipped 2026-09-01** | 295 |
| M64 | **The design pass** | proposed | 301 |
| M60 | **Adding an agent, and where an agent's logic lives** | proposed | 302 |
| M65 | **Automations as one surface** | **shipped** — one surface: what is running now (and whether a person or a schedule started it), what is scheduled, and what happened before INCLUDING the runs that did not happen. A run of pauses is stated as a sentence rather than left as rows to count. The `Workflows` panel’s claim that routines "arrive with the agent runtime" was retired, not left collapsed: a false claim is worse than an empty panel | 319 |
| M66 | **An automation is an agent, a task and a trigger** | proposed | 320 |
| M67 | **An automation's result becomes a task for another agent** | proposed | 321 |
| M68 | **A declared bound on agent-to-agent loops** | **shipped** — the bound is on the CHAIN from one originating task, counted along `spawned` links only (`blocks` and `follows` order work rather than produce it). At the bound the next result becomes a proposal in the attention queue with two acts, and accepting creates the task WITHOUT reattaching it to the chain, because a person deciding is what makes it a new beginning rather than round five | 322 |
| M69 | **An agent can be hired more than once, and the panel says so** | proposed | 328 |
| M70 | **The sessions view** | proposed | 329 |
| M71 | **The sessions surface across all projects** | proposed | 330 |
| M72 | **A settings screen** | proposed | 336 |
| M73 | **Keep the computer awake** | **shipped 2026-09-01** | 337 |
| M74 | **One law for a citation** | proposed | 349 |
| M75 | **The embedded browser, and its isolation contract** | proposed | 350 |
| M76 | **Preview for what the editor cannot open** | proposed | 351 |
| M78 | **The estate home is re-composed** | proposed | 362 |
| M77 | **Delete a project, with confirmation** | proposed | 363 |
| M79 | **A backlog state, before `running`** | proposed | 369 |
| M81 | **A diagnostic log across the whole product** | proposed | 375 |
| M82 | **`docs/brand/ui.md`** | **done 2026-09-02** — visual identity, product/brand colour boundary, component/state rules and the generated favicon contract are recorded; `gates:design` checks the icon matrix | 381 |
| M83 | **Quota on the home, with its reset** | **shipped 2026-09-01 on the PROJECT page; on the home, with its per-model breakdown, 2026-09-05 (M113)** — the milestone says “on the home”, and the home showed none | 405 |
| M84 | **The manager, on the home** | proposed | 406 |
| M85 | **Sessions without a project** | proposed | 407 |
| M86 | **One session list, not three** | proposed | 408 |
| M87 | **The canvas opens as a tab, and switches if already open** | proposed | 431 |
| M88 | **A canvas card is ONE object with three faces** | proposed | 432 |
| M89 | **Runs are events; the standing result is their projection** | proposed | 433 |
| M90 | **An edge declares its payload AND its staleness policy** | proposed | 434 |
| M91 | **The canvas graph is a DAG, enforced when the edge is drawn** | proposed | 435 |
| M92 | **An agent declares what it needs and what it produces** | proposed | 436 |
| M93 | **The catalogue of ready-made agents** | proposed | 437 |
| M94 | **Automations are gated by quota** | **shipped** — and built BEFORE the thing it guards, because M132’s own row says a daily unattended agent without it is the shape that burns an account overnight. It gates work nobody is watching and never the operator’s own hands; an unknown quota blocks; and a refusal names the window and its reset, so waiting an hour and waiting for the weekly turnover are different answers | 438 |
| M95 | **Transcripts redact secrets** | **shipped** — `d2a215f`: an ordered rule set redacts before the record is written, and `describeRedactions` says what was removed rather than removing it silently | 457 |
| M96 | **A gate that catches citation rot** | **shipped** — and the check that existed **could not catch the example this row reproduces**: it failed a citation only when the file was too short or the line blank, and a line holding a statistics loader is neither. It also read 4 of 97 documents. Now: every LIVING document is read, a bare `file:line` in one is refused because no gate can check what a line SAYS, symbol citations are verified against the file, and the 307 citations in 24 dated snapshots are excluded **out loud** — an audit report records a moment, and rewriting its receipts falsifies it. All six living line citations were converted first, so the rule starts from zero | 458 |
| M97 | **One projector, not ten copies** | **shipped** — dissolved into `apply_estate_and_projects` (7 arms), `apply_task_lifecycle_base` (7), `apply_memory_facts` (2), and the legacy function DROPPED rather than emptied. **Two extraction errors, both caught by probes within a minute**: the last legacy body is in `…0014`, not 0012 — taking 0012 dropped the rule that an agent may not supersede a PERSON’s fact (P18 red) — and it carries SIXTEEN arms, not fifteen, because 0013 added `context.compiled@1`. Fifteen migrations redefine the projector; “the latest” is measured, never assumed. **P24 proves behaviour did not move**: every projection snapshotted, both estates rebuilt through the new dispatcher, hashes equal | 459 |
| M98 | **Split the two files that hold everything** | proposed | 460 |
| M99 | **Finish or remove the inert surface** | **shipped — and half of it was already done.** The **Workflows panel was deleted by `a97a1e4` (M65)** at 18:37 on 2026-09-05, two and a half hours before this row was worked; line 132 of `ProjectHome.tsx`, the line it cites, now holds a statistics loader. The memory half is real but was described too harshly: not a dead button but a DISABLED radio carrying its own reason. The defect is that a radiogroup with one selectable option **asks** a question with one answer, in the form where the operator is deciding what their project is. Unavailable backends were removed from that form — and **the operator overturned that on 2026-09-05**: the roadmap a disabled option states out loud is worth more to them than the cost of a radio nobody can press, so it is shown again with its reason. **The half that survives is the more useful one**: a single DECLARED backend is a statement rather than a radiogroup of one, and a shown option is not a selectable one. A latent lie the row did not name is fixed with it: the label and hint were chosen by ternary, so a second available backend would have been labelled “Cloud” and described as living on this machine | 461 |
| M100 | **A failed start must be visible** | **shipped** — the catch now classifies, writes a log the operator can find, and shows a dialog naming the precondition with what to do about it. **The row said three causes; measuring found seven**, and two pairs that a careless matcher conflates: a missing binary and a start that timed out are both `spawnSync supabase <CODE>`, and a missing WORKING DIRECTORY is `ENOENT` exactly like a missing binary — so a wrong `FABRIC_REPO` would have told the operator to install software they already have. That ambiguity is removed in `main/repoRoot.ts`, where the knowledge to resolve it exists. Retry is offered only before `surface.start()`, a boundary OBSERVED rather than inferred. Driven for real three times against a rebuilt bundle | 481 |
| M101 | **Starting the stack blocks the main thread** | **shipped** — and the UNVERIFIED half is settled first, which changes the answer: **the splash did not paint**. Measured from inside the renderer, whose own clock puts its script at +6387 ms against a block ending at +6328 ms; a main-process timestamp could not have shown it, because an event fired during a block is merely delivered late. The abandoned probe was abandoned for the right reason and the bounded version took one run. `startStack`, `stackStatusEnv` and `resolveSupabaseEnv` are now asynchronous, the same probe shows the page running 44 ms into the wait, and the splash carries elapsed time and the stack’s own last line. Moving the call also changed what a timeout LOOKS like, which would have silently downgraded M100’s diagnosis — caught and covered | 482 |
| M102 | **Six loaders fire on every feed tick** | proposed | 483 |
| M113 | **Three milestones say shipped and mean half-shipped** | **shipped** — all three claims MEASURED TRUE first, unlike M106’s: `EstateHome` had no quota and `byModel` rendered in zero files; `lastCommit` appeared only in `types.ts` and `main/`; `ProjectStats` held only storage facts. Two are now on screen. M57 ships what is measurable — commits and the lines they moved, over a window carried WITH them — and its row is corrected for what is not: “lines of code” is not shipped under that name because the honest count is a third data files, and tokens and cost are not shippable at all per CO-096 | 484 |
| M114 | **Two register id spaces leak** | **shipped** — the M-space half closed when the commit-scope gate found `M146`, an id ten commits used and no row held. The CO half is closed here: eight four-digit references corrected to the form the register uses, and a gate that fails on the form. The M80 hole stays a hole — an id nobody used is not a defect, and renumbering to close it would move every reference to every row after it | 485 |
| M115 | **"suite now N probes" is a number with no referent** | **shipped** — the counter’s blind spot was widened to a six-letter prefix when writing `FEED-REQ` made the total refuse to move, and the suite’s size is now a number `check-registers.mjs` produces. The seven historical tallies stay and are LABELLED as historical: each was true at its own merge. No assertion count is published, because the source has 95 call sites and a green run prints 65 lines and a number nobody can define is the thing this row is about | 486 |
| M103 | **Instruction delivery is guesswork twice over** | **shipped** — `cf0e704`: the instruction reaches a listening agent, whole and once | 515 |
| M104 | **A throw inside the MCP handler hangs the agent** | **shipped** — the handler catches and ANSWERS (an agent that hangs is worse than one that fails: it looks like work in progress), the body has a cap that refuses rather than truncates, the handshake clears its transport and says so on failure, and the session id is minted by us so the state is set before the client can know it. **The last of those is by construction: the race was not reproduced**, and the verification row says so rather than claiming a watched failure | 521 |
| M105 | **Every byte an agent prints costs a full-buffer regex and a blocking write** | proposed | 527 |
| M106 | **Three failures the operator cannot see** | **shipped, and one third of the row was WRONG.** (a) real and fixed: a window that cannot read what it is for now says so, where before the diagnosis sat in state one branch above the banner. (b) **measured FALSE** — driving a real `task.abandoned@1` against the live database showed both `abandoned_reason` and `closed_reason` receiving the reason, and `ProjectHome.tsx#BoardSection` rendering it; migration `…0016` had fixed the projector the same day. What was actually wrong was the TEXT, which is (c). (c) real, and **48 sites, not “roughly fourteen”** — all of them the same `setError`, so it is fixed at the ONE display they funnel into rather than at 48 call sites, and the forty-ninth is right the day it is written | 533 |
| M107 | **The git watcher broadcasts to nobody** | **shipped** — the channel has a listener, and a separate name: it used to broadcast on `projects:repo-states`, the channel `ipcMain.handle` answers on. Two things measuring corrected in the row itself: the watch was NOT wholly inert (it dropped the cache, so the next read was fresh — only the notification was dead), and `.git` is watched non-recursively, so **a file edited in the working tree fires nothing at all**. A listener alone therefore could not deliver this row’s own sentence about twelve rewritten files; the panel also reads on its own 10 s clock, and stops while hidden. Repository state comes OFF `feedMark` in the same change — one of M102’s six loaders, and the only one this row owns | 534 |
| M108 | **Four surfaces render "nothing here yet" before reading** | **shipped** — and the durable half is a TYPE, not a gate: `read` is required, so a caller who forgets it no longer claims to have looked. The compiler named all fifteen sites that were taking the old default; nine were genuinely read and six now carry the `null` sentinel repos and transcripts already used. A filtered list keeps its unread-ness: null in, null out | 540 |
| M112 | **A scenario the code made false, and five dead keys** | **shipped** — the reverse check exists: every registry key must be reachable from a component, with the dynamic prefixes DERIVED from the code rather than listed by hand. It found twenty-eight dead rows, five of them the ones this row names and one shipped an hour before the check was written. SCN-037’s two promised strip cells are amended: they were removed by M57 and the scenario had described a screen nobody could see | 541 |
| M109 | **The IPC contract is type-checked on one side only, and has drifted** | **partly shipped** — all three named drifts are fixed: a failed `openExternally` is reported and shown, a failed git read is no longer rendered as a branch, and the feed channel narrows to the shape it declares. The MECHANISM exists too — `Returns<FabricApi[…]>` derives a handler’s return type from the one declaration, so `tsc` compares them. **It is applied to three handlers and about forty are unannotated**, which is a mechanical sweep this change does not make | 547 |
| M110 | **No renderer tests, no CI, and six suites go green having run nothing** | **partly shipped** — the renderer has tests and CI runs as a script (`scripts/ci.sh`), and the ROUTINE TICK — the one path that launches an agent with nobody watching — was extracted from `index.ts` so a probe can drive it. The rest of `index.ts` is still reachable only by launching Electron, and "the file is unimportable" is recorded as a fact about the file rather than a reason | 548 |
| M111 | **Cmd+W destroys every tab, and tabs are never persisted** | **shipped** — Cmd+W closes the tab and Cmd+Shift+W the window, through a menu built from Electron’s ROLES so copy, paste and quit survive being replaced. The working set is written on every change and restored once the projects are known; a tab whose project is gone is dropped and said, and a draft is never restored because the tab without its content claims work that is not there | 549 |
| M116 | **The mark reaches the application** | **shipped 2026-09-03** | 571 |
| M117 | **The interface is designed IN the pack, not merely near it** | **shipped 2026-09-05** | 572 |
| M118 | **The workspace is a repository, offered at initialisation** | **shipped** — ADR-0002’s mirror, and now the question that offers it: choose a folder, adopt an existing workspace, or decline. No dismiss, because declining IS later and is reversible. An import preserves IDS — that is what makes it the same estate carried to another machine rather than a copy — refuses an estate that already holds projects, and refuses a file it cannot read whole. Fabric writes and initialises the repository; committing stays the operator’s | 573 |
| M119 | **The CEO proposes the projects from the evidence** | proposed | 574 |
| M120 | **Favourites — at most five** | **shipped** — `242ebce`: favourites are a partition of the project list, and the five-cap is enforced where the write happens. **Returns at M38**, where a favourite becomes a `(person_id, project_id)` row rather than operator-local state | 575 |
| M121 | **Shortcuts instead of a blank prompt** | **shipped** — two constant presets and two that READ the project, offered only when their source has something in it and carrying the items so the session does not open by rediscovering them. A truncated list keeps the true count and says what it left out. **"Errors in production" is deliberately absent**: nothing observes production yet (M129), and a shortcut for a signal we do not collect is a promise the product cannot keep | 576 |
| M122 | **A kanban board per project, written by agents** | **shipped** with M146 — the board is per project, agents write to it through the task tools, and M53’s list, M79’s backlog state and M54’s detail are its views rather than three screens | 577 |
| M123 | **Task management is a system skill in every agent's routing** | **shipped** — the contract (seven `fabric_task_*` tools) and now the DELIVERY: a preamble that names `fabric_whoami` and no rule, carried by the adapter that can carry it, and `session.oriented@1` journalled so a session that never read its rules is visible rather than assumed | 578 |
| M124 | **The board is bound to the project's documentation** | **shipped** — the edge is navigable both ways (a ref’s location is separated from its document, and a task shows what else that document produced), and a status now carries the hand that set it: `moved_by_kind` is projected, and the board says what the mover makes the column MEAN. It speaks in two situations only — `review`, where an agent’s claim and a person’s decision look identical, and a terminal state an agent reached, which the ladder forbids and the surface therefore shows rather than normalises | 579 |
| M125 | **An agent is created from a prompt** | **shipped** — a RUNNER is a program on this machine and stays code; an AGENT is a named configuration of one and is a row, which is exactly the return trigger `agents.ts` wrote for itself. Created from a name, a brief and the servers it asks for, offered in the picker apart from the runners, and launched with its own brief plus Fabric’s preamble last. The project’s grant is a ceiling checked at creation AND at launch | 580 |
| M126 | **The CEO is always reachable, and knows where you are** | proposed | 581 |
| M127 | **A created agent gets the MCP servers it needs** | **shipped** — [ADR-0034](../../adr/0034-an-agent-reaches-another-mcp-server-through-the-machine-gateway.md). Through the machine gateway, with direct access refused BY DESIGN (an upstream key in a session directory is the superset the credential rule forbids) and a Fabric proxy declared-and-unbuilt. One refusal blocks the launch, the route is read from the gateway rather than composed, and the role key comes from the environment and is stored nowhere | 582 |
| M128 | **The trend agent, end to end** | proposed | 583 |
| M129 | **The production-signal agent** | proposed | 584 |
| M130 | **Every task says who assigned it and to whom** | **shipped** with M146 — `assigned_by`/`assigned_to` are projected from the journal, the card shows `{by} → {to}` and **the task page names both sides in a sentence, guarded so a half-known handoff says nothing rather than naming an absence** | 585 |
| M131 | **The mascot on the home, and the profile behind it** | **shipped** — `33c0815`: three of the four things asked for were already in the record; the fourth (event-driven variants) is the part that was built | 586 |
| M132 | **The dev agent works the backlog daily** | **shipped** — not a new mechanism but a KIND of routine: its instruction is composed at fire time from the backlog in the operator’s priority order, unplaced tasks last. An empty backlog does not start a session and is journalled as a pause, so the automations surface says why. Its three named dependencies (M65, M94, M68) were built first, in that order | 587 |
| M133 | **Entering a project answers "where were we"** | **shipped** — `105044a`: composed from the decision store, never generated — the digest quotes rows and refuses to summarise what it has not read | 588 |
| M134 | **Ideas enter the backlog, and can be researched** | **shipped** — `task.created@1` had exactly one writer (the agent surface) and the operator’s only door started a session, so the backlog was a place a person could not write to. An idea is filed with the person as its origin, its first line the title and the rest a note, and looking into it SPAWNS a linked task rather than running the idea itself | 589 |
| M135 | **Where memory lives is visible to the operator** | **shipped** — `3941714`: the four memory stores get one surface, and a retrieval miss is shown as absent rather than as zero | 590 |
| M136 | **org #1 stops being empty** | **shipped 2026-09-03** | 610 |
| M137 | **The decision port, and the first thing that can refuse** | **shipped 2026-09-03** | 611 |
| M138 | **The four authority event types are registered** | **shipped 2026-09-03** | 612 |
| M139 | **A floored action in the product** | **shipped 2026-09-03** | 613 |
| M140 | **The agent asks, the operator grants** | **partly shipped** — `c5bf512`: `fabric_effect_request` presents nothing and the surface finds the grant, so the agent never holds the permission it is asking for. **The row named `canUseTool` and this is not that, which matters:** the hook would intercept EVERY tool call, and the tool intercepts only what the agent chooses to ask about. An agent that does not ask is not stopped. Closing that needs the runner’s own permission hook, which is per-runner and not scheduled | 614 |
| M141 | **Search, and a screen for its results** | **shipped** — `585f65b`: one field over projects, tasks, facts, transcripts and decisions, grouped rather than merged | 627 |
| M142 | **Every figure opens the register it was counted from** | **partly shipped** — six of thirteen figures now open their register, through one implementation that REPORTS a missing section instead of swallowing it, with the anchor list held equal to the rendered ids by the design gate. **Seven do not, and deliberately promise nothing**: `retrievals` and `packs` have no surface, and five estate-wide sums (sessions, closed tasks, facts, decisions, grants) have rows that live per project with no cross-project view. The return trigger is that view existing — a figure naming a screen that does not exist is this milestone’s own defect relocated | 628 |
| M143 | **The task page** | **shipped** with M146 — brief with authorship, working notes, promote-to-memory, links and receipts. The receipts are rendered by `Feed`, not by a second renderer free to disagree about what an event means | 629 |
| M144 | **The plan and the decision graph** | **shipped 2026-09-05** | 630 |
| M145 | **The harness screen and its tool pages** | **shipped 2026-09-05** | 631 |
| M146 | **The operating-surfaces layer** | **shipped** — `37727c2`…`adb505d`. Advances M122 (board), M130 (assignment provenance) and M143 (task page) to shipped; delivers M123’s tool CONTRACT and not its skill installation; leaves M124 (task bound to its document) untouched | 632 |
| M147 | **The estate card counts what is waiting** | **shipped 2026-09-05** | 633 |
| M148 | **A question is a record, and blocking is not a status** | **shipped** — `questions` + `question_blocks`, `apply_questions` as a per-concern projector called from the dispatcher (M97 pattern), and `blocked_by`/`blocked_since` as COLUMNS on the task. P22 drives the whole path against the live database — a question blocks two tasks, carries its `about` key, is prioritised, answered once (a second answer cannot overwrite: the guard is `status=open`), unblocks both, and is invisible across the tenant boundary with a positive control. Three projector defects planted and each caught. Grants + RLS in migration 4’s shape, the P21 lesson | 634 |
| M149 | **An agent can ask the owner a question rather than guessing** | proposed | 635 |
| M150 | **The rank is arithmetic, and every item says why it is where it is** | **shipped** — `questionPriority` = `blocking + breadth + age + kind_weight + goal + project_weight`, a tested pure module reading the M156 weight. **Every component travels on the item** so the order is explained, not trusted. Derived obligations enter the SAME scale (`refused` 40+access, `proposal` 35, `review` 25, `abandoned` 20, each plus project weight), so the Board is one list. `rankBoard` breaks ties deterministically — age then id — and the tiebreak test feeds the same pair in BOTH orders, because a `return 0` slipped through the one-directional version (V8’s sort is stable): the same class that bit M107. Four defects planted, each caught | 636 |
| M151 | **The Board — top 5 on the home, top 10 in a project, all of it on its own screen** | proposed | 637 |
| M152 | **Answering closes the loop, and the answer is a decision** | proposed | 638 |
| M153 | **The CEO routine — withdraw the stale, de-duplicate, escalate** | proposed | 639 |
| M154 | **Findings and traps get a reader, so writing one stops being shouting into a drawer** | proposed | 640 |
| M155 | **The protocol is observed where it cannot be refused** | proposed | 641 |
| M156 | **A project's priority is declared, and pressure is measured beside it** | **shipped** — `projectWeight` as a tested pure module: **tier + capped pressure**, where the cap is forced to (15,30) so a maxed `steady` project outranks an idle `active` one and never a bare `critical` one — a flat cap outside that window cannot satisfy both, which a test found before the code did. `ceoTrustFor` inherits the estate and clamps an override DOWN (ADR-0004 shape); an unknown level fails closed to `ask`. Storage: `priority_tier`/`priority_because`/`ceo_trust` on the project (tier NEVER mutated by the system — ADR-0002), one `estate_settings` row, `apply_priority` projector. P23 round-trips a declaration touching nothing else, a bad tier refused by the check, an override cleared, and the settings upsert. Four defects planted and caught | 642 |
| M157 | **The CEO settles what it can CITE, and every settlement is visible and reversible** | proposed | 643 |
| M158 | **A decision that changes is scored, and the operator's own word is held** | proposed | 644 |
| M159 | **The Telegram connection: one token, one consumer, and every update claimed** | proposed | 645 |
| M160 | **Authority requires a binding, and binding starts in the app** | proposed | 646 |
| M161 | **The outbox: a row before a send, `retry_after` honoured exactly** | proposed | 647 |
| M162 | **Reply-to-answer — the operator's day moves to Telegram** | proposed | 648 |
| M163 | **The evening letter, labelled with the window it covers** | proposed | 649 |
| M164 | **Notifiers are composed, not built** | proposed | 650 |
| M165 | **Capture, retention, and the consent that a work chat requires** | proposed | 651 |
| M166 | **The CEO's core, and it is the whole CEO without a provider** | proposed | 652 |
| M167 | **A model port that may be ABSENT, and absence is a state rather than a crash** | proposed | 653 |
| M168 | **The core is the checker, and a checker that never refuses is a finding** | proposed | 654 |
| M169 | **The provider router — and the three traps that are each a real bill** | proposed | 655 |
| M170 | **The four typed calls, one at a time, each behind its validator** | proposed | 656 |
| M171 | **`model.called@1`, and the cost surface** | proposed | 657 |
| M172 | `pi` as a third runner descriptor | proposed | 658 |
| M173 | **The decision graph shows movement, and who decided** | proposed | 659 |
| M174 | **The script-vs-agent line, drawn across the product** | proposed | 660 |
| M175 | **The CEO is an agent — a small tool-calling loop, ours** | proposed | 661 |
| M176 | **A CEO trajectory eval, before its prompt is tuned** | proposed | 662 |
| M177 | **Close the cheap harness gaps found by the map** | proposed | 663 |
| M178 | **A heartbeat, because silence is ambiguous** | proposed | 664 |
| M179 | **The agent is watched from outside, because the reporter is what breaks** | proposed | 665 |
| M180 | **A failure is journalled with its KIND — “failed” is not one thing** | proposed | 666 |
| M181 | **Degradation is stated, never silent** | proposed | 667 |
| M182 | **An insight says what it is ABOUT — a closed category** | proposed | 668 |
| M183 | **The anonymised product loop — service insights feed Fabric's backlog** | proposed | 669 |
| M184 | **The retrospective is a cycle the CEO runs** | proposed | 670 |
| M185 | **One inbox on the dashboard — a view, not a store** | proposed | 671 |
| M186 | **The cycles view — everything that ticks, estate-wide** | proposed | 672 |
| M187 | **The density review — primary visible, the rest behind ONE disclosure primitive** | proposed | 673 |
| M188 | **Runs and plan steps — the unit of progress** | proposed | 674 |
| M189 | **The current-task widget — realtime progress, claims labelled as claims** | proposed | 675 |
| M190 | **SCR-40 — the graphs screen: agent DID, project DID, plan SHOULD** | proposed | 676 |
| M191 | **The memory module made visible: pack preview, lineage, mirror drift** | proposed | 677 |
| M194 | **The manager seat is a binding — built-in or an external agent** | proposed | 678 |
| M195 | **Redaction at the agent surface — S1, HIGH** | **shipped** — and step 0 corrected the brief FOURFOLD: it named three fields in three tools; measuring found **thirteen across eight**, the most dangerous being `task.handoff@1`’s 8 000-char `value` — precisely the channel one agent uses to pass the next what it obtained. So the fix is ONE DOOR, not thirteen call sites (M106’s lesson one layer along): `appendRedacted` wraps every agent-written event, and all 15 raw appends in the surface now route through it. `redactPayload` walks the whole payload recursively — **no skip-list**, measured safe: nine ordinary values (ids, enums, `about` keys, formatted strings) came back byte-identical while the secret was caught. The count rides on the event, the transcript idiom. Token entropy verified at 192 bits (S5). Three defects planted, three caught | 679 |
| M196 | **Sandbox on the windows — S2** | **shipped** — and the brief’s guess (“sandbox: true is likely compatible”) was wrong TWICE, both found by driving a real window. First: an ESM preload dies in a sandbox with `SyntaxError: Cannot use import statement outside a module` and `window.fabric` is **ABSENT** — the renderer loses all 27 namespaces silently, so the sandbox was off for a REASON nobody had recorded. Rebuilt as CJS, it failed a second way: in CJS format the resolver picks the **electron npm wrapper** — the one that `spawnSync`s the binary — dragging `child_process` into a context that has none. `external: ['electron']` is what makes the sandbox possible at all. Both halves are now held by a probe reading the SHIPPED bundle (CJS, no forbidden builtin, bridge still exposed, all 3 windows sandboxed); three regressions planted, three caught | 680 |
| M197 | **Двуязычие как храповик — RU/EN заложены, переводы докидываются** | **shipped** | 681 |
| M198 | **A rebuild is not idempotent for `config_revision`** | proposed | 682 |
| M38 | **Identity plane and memberships** | **decided, unscheduled** | 703 |
| M39 | **The member surface** | **decided, unscheduled** | 704 |
| M40 | **Personal estates and delegation** | **decided, unscheduled** | 705 |
| M41 | **Federation catalog and invitations** | **decided, unscheduled** | 706 |

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`project-audit`](https://github.com/ssheleg/task-pipeline) — проверка проекта и доказательств
- [`ux-audit`](https://github.com/ssheleg/super-ux) — сценарии и дефекты интерфейса
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — архитектура исполнения и полномочий
- [`agent-harness`](https://github.com/ssheleg/agent-stack) — переносимый агентный контур
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — визуальная система
- [`brand-voice`](https://github.com/ssheleg/super-ux) — иерархия бренда
- [`copywriting`](https://github.com/ssheleg/super-ux) — формулировки позиционирования

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
