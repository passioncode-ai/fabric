# The Fabric agent answers and directs the sessions (CO-522 wave D, the North Star's G10)

**Status:** draft, 2026-11-06. Built through `agent-stack` (agent-orchestrator, agent-harness, agent-evals), as the
operator's routing asks for an agent system. Code in 0.4.0; this spec by 2026-11-13.

**Source:** the operator in session `5d9bed98`, 2026-11-06. The person should direct all sessions through the Fabric
agent. The North Star's G10: «The CEO is a coordinator session today; Fabric's manager agent is undated».

**Parent:** [the session coordination spec](2026-11-06-session-coordination.md), wave D.
**Row:** CO-522 in the [carry-over ledger](2026-08-16-software-fabric-carryover.md).

## 1. What exists

The CEO conversation stores the person's messages behind private history (`apps/desktop/src/main/ceoConversationService.ts`,
`apps/desktop/src/renderer/src/CeoChat.tsx`). Nothing reads them, and the chat promises «saved, no reply yet».

Waves A to C gave the parts the agent needs:
- what a start runs into (`work:launchCheck`);
- overlaps told to both sessions, and decided by the person (`claim-overlap`, `overlap-unsettled`);
- words to a running session (`work:say`).

## 1a. The design this builds on (found 2026-11-06, after the first draft)

The manager was designed before, and this spec is its first usable slice, not a second design:

- **M176, shipped 2026-09-09.** The evaluator and its corpus: `apps/desktop/src/shared/managerEval.ts`
  (`evaluateTrajectory`, eight `HARD_VIOLATIONS`, a hard violation never offset by an average, a partial trace
  inconclusive, expected unknowns matched exactly, a verdict never a permission) and `managerCorpus.ts` (each fixture
  seeds a defect this repository really had). The eval spec extends both instead of writing a third.
- **M194, proposed.** The manager's binding and lifecycle (`docs/audit/2026-09-09-final/packets/M194.md`): a role slot
  per `(estate, role, scope)`, an immutable binding revision naming provider, runner, tools, checker and budget, and a
  runner over one `ManagerToolPort`. The person's agent here is the estate's `ceo` slot; the closed tool set of §3 is
  that port.
- **ADR-0046, proposed** (`docs/adr/0046-manager-role-slots-epochs-and-provider-compatibility.md`): `ceo` for the
  estate, `product-manager` for a project, no third role. Taken as the baseline; it has no operator acceptance yet.
- **M166, proposed.** The deterministic CEO core. M194's packet lists it, with M176 and nine shipped rows, as required
  before the manager acts on anything.

So the code goes in this order, each step with its own tests: (1) the eval's new hard violations and corpus entries
over M176 (no model, no door; built 2026-11-06); (2) M166's core (first slice built 2026-11-06: `apps/desktop/src/shared/ceoCore.ts#planCeoCore`, the
Board ranked on one scale, the digest, the trust in effect and what it cannot do yet; hygiene waits for M153 and
settlement for M158, both proposed); (3) M194's slot and binding with the `ceo` slot only; (4) the runner on
the model of §4, behind the eval gate. Steps 1 to 3 change nothing a person sees.

## 2. Shape: one tool loop, not a planned pipeline

The person's message is a question or an order about work in flight: who works on what, stop this, give that to the
other session, what is waiting for me. Each answer needs a handful of reads and at most a few acts, decided from what the
reads return. That is the simple path (agent-orchestrator §2): one loop with tools, no plan graph.

A request that needs a plan («move every project to the new model map») is answered by filing tasks for the projects'
own agents, never by the Fabric agent doing the work itself.

## 3. Tools (a closed set, each one of Fabric's existing doors)

The agent acts only through doors a person already has in Fabric, with the person's authority, and every act lands in
the journal like the person's own. A capability the estate lacks contributes no tool.

| Tool | Door it uses | Kind |
|---|---|---|
| `sessions_list` | `work.home` (live agents, folder, branch, held task, stage) | read |
| `work_list` | `readWork` (claims, overlaps, open tasks) per project | read |
| `task_get` | `tasks.detail` | read |
| `waiting_for_person` | `board.query` with `personOnly` | read |
| `say_to_session` | `work:say` (wave C) | act |
| `file_task` | the person's task form, into a project's queue | act |
| `assign_across` | «Поручить агенту B» (`tasks:assignAcross`) | act |
| `decide_review` | `tasks:decide` (accept, return with a comment, cancel) | act, person-gated |
| `decide_overlap` | `work:overlapDecide` | act, person-gated |
| `ask_person` | a question with options in «Нужны вы» | act |

**Person-gated** means the agent proposes the decision and the person confirms it with one click in the chat. The agent
never closes, cancels or settles an overlap on its own, until CO-523's levels make an administrator's order its own
approval.

Every enum is closed in the schema: `decide_review.decision` is `accept | return | cancel`, `decide_overlap.choice` is
`wait | handover | split`. How each tool is described to the model follows `agent-harness/references/tools.md`: when to
use it, and the neighbour it is confused with (`say_to_session` against `file_task`).

## 4. Model and spend

The model follows the operator's map (wiki `synthesis/llm-models.md`, «The model map», board thread `21c2023c`):
- decisions: `moonshotai/kimi-k3.1-pro`, reasoning on and a large output budget (it ignores `reasoning: {enabled: false}`,
  board message `533f7354`);
- verification of an act before it lands: `anthropic/claude-sonnet-5.5`, reasoning mandatory, so the flag is never sent
  off;
- fallback of another vendor for each.

The key comes from Observatory by name, never by value (`use_secret.py run --vault-only`). Each call is metered into
Fabric's usage report (DEC-0021), within the key's own ceiling and a per-conversation budget. An empty answer counts as
a failed turn, not a success.

Loop guards (agent-orchestrator §2):
- at most 12 tool calls per message;
- wrap-up at 70 % of the context window;
- a best-effort answer on exhaustion.

## 5. Evals before it ships (agent-evals)

The observables, the seed corpus of twenty cases, the judge and the release gate are in
[the eval spec](2026-11-06-fabric-manager-agent-evals.md), written before the code. In short: trajectory and state checks
by code first; a judge of another family than the actor and the verifier, calibrated on the operator's labels; every
person-gated act held to `pass^3` on every case.

## 6. Privacy

The CEO conversation is private history (ADR-0079): it stays gated as today. The agent reads it only when private
history is set up, and its own calls send the provider only the message and the reads it needs, never the history whole.

## 7. Open questions

1. **May the agent take person-gated acts without the click?** Only for an administrator's order, under CO-523's levels;
   until then, never.
2. **The suite's pass threshold.** Set in the [eval spec](2026-11-06-fabric-manager-agent-evals.md) §6: safety `pass^3` on all
   twenty cases, task success on at least seventeen.
