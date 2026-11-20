# ADR-0203: The owner's approval mode says which acts wait for him; the human gates always do

**Status:** accepted · 2026-11-20 · records the owner's order of 2026-11-20 (package D of the brief
`userData/ceo/inbox/2026-11-20-sound-engine-3d-agents-org-load-brief.md`, paraphrased per ADR-0096: what the owner
said is carried to the end and no session sits waiting; decisions go to the board; five approval modes, «одобрять
важные», «только критичные», «только траты», «только нестандартные», «ничего, полная автоматика», shown and switched
on Fabric's home in one action and handed to every session and agent; a sign-in, a code, a payment and a secret always
stay with the person; a journal of what agents did on whose word) · amends
[ADR-0028](0028-one-effects-algebra-and-the-floor-lives-in-the-schema.md) (who issues a grant) and
[ADR-0050](0050-an-effect-has-a-lifecycle-and-an-observation-is-not-a-claim.md) (the request tool's first refusal) · builds on
[ADR-0197](0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md) (the CEO and its voice).

## Context

The floor (ADR-0028) names three classes of act that need a person: money, deletion of what cannot be recovered, and
publication outward. Every floored act needs a one-shot grant, the schema refuses one without it, and until now only
the owner issued grants, from the attention queue. So every such act, however routine, stopped its session until he
answered. The owner's order is the opposite default for his own machine: what he ordered is done to the end, and he
chooses how much he is asked.

## Decision

1. **Five modes, one setting.** `settings.json` `approvalMode` holds one of `important` (default, today's floor: all
   three classes wait), `critical` (deletion and publication wait, money within the limits goes ahead), `spending`
   (only money waits), `unusual` (an act waits only when this project has not done an act of this class on this target
   before: no spent grant for it), and `none` (nothing waits). A missing, unknown or unreadable value is `important`,
   never a looser mode (`shared/approvalMode.ts#approvalModeOf`, `main/hubPorts.ts`).
2. **The floor stays in the schema.** A mode does not remove the grant: when an act does not wait under the mode,
   Fabric issues the one-shot grant itself, as the system actor `approval-mode:<mode>`, confined to the asking
   session's project, act and target, alive ten minutes (`main/effectTools.ts#MODE_GRANT_TTL_MS`), and the policy then
   decides as before (containment, target, reservation). The journal's `grant.issued@1` names the mode as its issuer, so
   «who allowed this» has an answer for every act. A grant the mode cannot issue leaves the act waiting.
3. **Every session reads the mode.** `fabric_whoami` answers `approval: {mode, label, rule}` read per call; the CEO's
   brief tells it to read that field before an act above the floor and to pass it on; the voice gets the rule at the
   call's start (`main/ceoVoice.ts#voiceInstructions`). The rule says, in every mode: what the owner ordered is done to
   the end, a decision that is not his goes to the board, and the human gates wait.
4. **The human gates are outside every mode.** A sign-in, a one-time code, a payment or top-up, a secret a person types
   and a consent screen need the person's own hands; no mode, `none` included, lets an agent past them, and the rule
   names them (`shared/approvalMode.ts#HUMAN_GATES`).
5. **The home shows and switches it.** The home screen shows the mode and changes it in one action through the
   ordinary settings write (`approvalMode` is a key a window may write); the control is built by the home screen's
   owner on this module.

6. **The behaviour journal.** What the CEO, its voice and the sessions did is written, one line an act, to
   `userData/ceo/behaviour/<UTC day>.jsonl` (folder 0700, files 0600, kept 30 days, a line at most 4 KB, its reason
   redacted and cut to 300 characters; `main/behaviourJournal.ts`): the actor, the act, its target, on whose word (the
   owner by voice with the call's id, the same id as the call's own journal in `calls/`; the CEO from its console; the
   approval mode; an owner's grant; the agent's own ask) and what was decided. The CEO's acting tools (input, start,
   stop, resume, open, alias) and every decision of the floor write it; reads do not. The CEO and the voice read it
   with `fabric_ceo_journal` (`session_journal`), by days or by call.

## Consequences

- In `important` nothing changes. In the looser modes an act the owner did not see is done; the journal holds which
  mode allowed it, and the behaviour journal (the next change of this package) shows it beside the call that asked.
- The runner's containment check (FA-09) still refuses a floored act from a session whose tools Fabric cannot see:
  a mode decides whether the owner is asked, not whether Fabric can hold the session to its answer.
- `unusual` reads one row of `grants` per ask; an unreadable read is a first time, the safe side.
