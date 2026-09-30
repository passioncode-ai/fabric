-- The chain's dispatch record is a thing the journal will accept (FA-02).
--
-- MEASURED 2026-09-10, and it is the second of three swallowed failures that
-- each, alone, stopped every chain in this product from ever advancing:
--
--   1. The dispatch guarded itself with a conditional update to
--      `status = 'dispatching'`. `project_tasks_status_check` has allowed
--      backlog, running, review, done, cancelled, open, finished and abandoned
--      since migration one, and nothing ever added that word. Postgres rejected
--      the write; the caller destructured `error` away and read the empty answer
--      as another process winning the race.
--   2. The outbox record it then journalled, `chain.dispatch@1`, was never
--      registered in `event_types`. `append_event` refuses an unregistered type
--      by design — "unregistered event type chain.dispatch@1" — so the append
--      threw.
--   3. The whole tick sits in one try/catch that reports through `ops.failed`.
--      Either failure above became a line in an operations log and a tick that
--      returned quietly, and the board simply never moved.
--
-- Registering the type is the half that belongs in the schema. The first and
-- third are code, and they are fixed in the same change: the dispatch now goes
-- through `admit_task_launch` — the command the operator's Run already used —
-- so there is no invented status to reject, and the refusal it returns is a
-- typed reason rather than an absence.
--
-- `projects: true` because a dispatch belongs to the project whose chain it
-- advances; a receipt with no project cannot be read from the work it is about.

insert into event_types (type, projects, note) values
  ('chain.dispatch@1', true,
   'a chain step was admitted and is being dispatched: the intent, journalled before the spawn, naming the run it belongs to')
on conflict (type) do nothing;
