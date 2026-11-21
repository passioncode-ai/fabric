# The CEO's and the voice's missing tools (CO-622)

The owner's order of 2026-11-21, about 04:20, in the CEO window (CEO session 53895bdc), relayed by the CEO with a brief
in `userData/ceo/inbox/` on the owner's Mac. Paraphrased here (ADR-0096 §5), since Fabric removes an inbox file 30 days
after it is written (`apps/desktop/src/main/ceoAgent.ts#INBOX_KEEP_MS`).

**The order, paraphrased.** Finish every tool the CEO agent of Fabric and its voice call still lack, so that everything
can be decided by voice, quickly. The voice gets the same tools as the CEO's console, and answers briefly.

**What the CEO had to work around on 2026-11-20 and 21, and the tool each asks for.**

1. **A start with its model and effort.** The CEO typed `/model …` into a console as text, and one session ran on
   another model than asked. Wanted: `model` and `effort` in `session_start`, and a model change of a live session that
   is read back.
2. **Delivery confirmed, and the answer awaited.** The CEO searched transcripts by hand to see whether a task arrived.
   Wanted: `session_input` answering «taken by turn N» from the runner's own transcript; `session_wait_reply` (the
   agent's next answer after an input, with a timeout) and `session_last_reply` (its last answer as text).
3. **A message to many sessions.** A pause sent to thirty sessions took thirty calls and did not reach sessions outside
   Fabric. Wanted: `session_broadcast` with a filter (all live, a project, idle under N minutes, Switchboard's and the
   machine's sessions too), pause and resume modes with their confirmations, and a register of who is paused.
4. **The CEO's board slot.** Session 8343a070's fix, released in 0.3.27; not part of this row.
5. **The board without SQL.** The CEO gets the board tools the voice has (`apps/desktop/src/main/voiceBoard.ts`):
   newest projects, a project's tasks with status and holder, a task's graph, search, and a board summary (backlog,
   running, in review, requests no responder answers).
6. **The CEO's own schedule.** A board round every 15 minutes lived only in the CEO's session. Wanted: a Fabric routine
   for the CEO that outlives a restart (the round, the slot, delivery checks).
7. **The owner's chat with his bot.** Wanted: a read-only tool for the owner's chat with his bot over a time window,
   through the communicator.
8. **The machines' state.** Wanted: `machine_status` for both Macs, with the disk guard's line.
9. **Reports to the owner.** `communicator_status` answers too much. Wanted: a short mode (link, undelivered, the last
   N commands with an honest state).
10. **The voice, from its retro.** Kept at parity: the call journal, no shell for prose, delegating, names heard by
    sound, the CEO's answer read back, what changed since the last call, stopping its own stuck launches, checking that
    a started session took its task; the address words mean the CEO.
11. **Faster by voice.** One-phrase scenarios: pause everyone, resume by the plan, what waits for me, the newest
    projects, start X on a named model, what is with task Y. Each answered briefly by voice, with a link in the window
    when it helps.

**How.** Through `task-pipeline`, with tests, in 0.3.28. The agent architect's consult named the reference templates
and patterns; it advises and never gates.
