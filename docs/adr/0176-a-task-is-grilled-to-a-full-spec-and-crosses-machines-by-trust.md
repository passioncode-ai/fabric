# ADR-0176: A task is grilled to a full spec first, and work crosses to another project by the machine's trust

**Status:** accepted · 2026-10-23 · the operator's decision; built in 0.3.12 (P-25, CO-403, CO-404) · relates to
[ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md) (enrollment),
[ADR-0115](0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) (the operator's own machine) and
the project board (`com.submit`).

## Context

The operator, 2026-10-23, during 0.3.11's release review:

- «надо поддерживать два режима передачи задач агентом: если агент на проекте, кому задача, недоступен, то если это
  личная машина или доверенная, то можно самому внести правки, а если это машина организации, которая не под моим
  управлением, то она должна передать на доску организации задачу тому агенту ... один делает фичу А, второй её
  доделывает, от первого нужны правки, и агент кидает на доску; если проект личный или машина моя или ремоут, но моя,
  то если агент есть, он подхватит, если нет, второй агент может сам; а если машина не моя, то первый агент заберёт с
  доски, когда будет онлайн»;
- «при начале и постановке задачи всегда нужно убедиться, что вся спецификация собрана, и не отпускать, пока не собрана
  грилингом, а потом уже оформлять всё и продолжать».

Today an agent that needs a change in another project either edits that project's files itself or asks on the board,
with no rule for which; and a task can start with a one-line instruction and no brief.

## Decision

1. **A task starts with a full spec, gathered by questions.** Before an agent starts a task it asks the person (or the
   task's author) until the brief is whole: what should happen, why, what will be true when it is done, what is out of
   scope, and the constraints it must keep. It does not start building, file sub-tasks or hand the task on while a
   question is open; then it writes the brief (`fabric_task_brief`: what, why, expected) and continues. A task whose
   brief is incomplete says so on its page («Спецификация не собрана»), and the hub's rules tell every agent this at
   `fabric_whoami`.
2. **Work in another project crosses by the machine's trust.** When an agent needs a change in a project whose own agent
   should make it (feature A by one agent, finished by another that needs changes from the first):
   - it **files a task on that project's board** first (`com.submit` with kind request to the owning project), naming
     what is needed and why;
   - **on a trusted machine** (the operator's own computer, or a remote machine that is the operator's): if the owning
     project has an agent online, that agent takes the task; if none is online, the asking agent may make the change
     itself in that project's repository, under the project's rules, and records it on the task;
   - **on a machine that is not the operator's** (an organization's machine under someone else's control): the asking
     agent never edits the other project; the task waits on the board until that project's agent is online and takes it.
3. **Trust is a fact Fabric records, not an agent's guess.** A machine is trusted when Fabric runs on it as the
   operator's own (the hub's operator identity, ADR-0115's "the operator's own machine") or the operator marks a remote
   machine as theirs in Settings; anything else is not trusted. `fabric_whoami` names the machine's trust so the agent
   reads the rule that applies.

## Consequences

- 0.3.12 builds: the intake rule and the «Спецификация не собрана» state (CO-403); the machine's trust in Settings and in
  `fabric_whoami`, and the cross-project rule in the hub's protocol (CO-404). 0.3.11 ships neither; its protocol text is
  unchanged.
- The board becomes the way work moves between people's agents in a team; an organization's machine never writes into a
  project it does not own.
- Scenarios: SCN-176 (a task is grilled to a full spec), SCN-177 (work crosses to another project by trust).

## Amendments

**2026-10-23, how 0.3.12 builds it (the triage's wave 1; decided by the agent on the operator's instruction to choose,
open to the operator's review).**

1. *The whole spec* is the brief's three parts, what, why and expected, each written; out of scope and the
   constraints are written into expected, which the rule says. No new column in 0.3.12 (`shared/taskSpec.ts#specGaps`).
   The person's questions go through `fabric_question_ask` (they reach «Нужны вы»); when another project's agent filed
   the task on the board, the questions go to it with `com.reply` on its request.
2. *Trust* is one setting, «Этот компьютер» in Settings → Компьютер: mine (my own, or a remote one of mine), an
   organization's, or not said. It is never assumed: not said, and settings that cannot be read, are not trusted.
   `fabric_whoami` names it as `protocol.machine` (protocol version 3).
3. *The owner's agent is online* when `com.directory` shows the owning project's responder live; that is what an agent
   can read, and the rule names it.
4. The rule is advice, by its label: Fabric cannot see an agent write into another checkout. What Fabric records is the
   request on the board and the reply that says what was done.


**2026-10-24, a request between agents is a task too (the operator, on the spec of tasks agents give agents on the
board; decided by the agent on the operator's instruction to choose, open to the operator's review).**

5. Decision 1 holds for a request another project's agent files on the board, not only for a task the person files:
   the request carries the whole spec (what, why, expected with out of scope and the constraints) and its sources (a
   commit, a file, the source task). The receiving agent asks on the request's thread until it is whole, then works.
   Built in 0.3.13 with the contract's repin (CO-415).
6. The receiving agent rebuilds the context itself: the request links its source task, and the receiver may read that
   task's brief, notes and the memory facts it cites, read-only and only within the request's thread (CO-416, 0.3.13).
   One memory search across the operator's stores is 0.4.0's (CO-417).
7. Amendment 2's "never assumed" is about a machine Fabric cannot tell apart: an install where the person has not said
   reads `unknown`. It does not overrule Decision 3 for the operator's own Mac: 0.3.12's rollout there sets «Этот
   компьютер: мой», recorded in its ledger, so `protocol.machine.trust` reads `mine` on the machine Decision 3 names.
