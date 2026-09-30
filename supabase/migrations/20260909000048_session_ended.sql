-- The runtime ending is not the task finishing (M180, ADR-0040 §4).
--
-- MEASURED: `closeTaskForSession` appended `task.finished@1` with the exit code,
-- and the projector turns that into `status = 'finished'`. So a crashed agent,
-- a runner that was never installed, and a session killed because the operator
-- quit the app ALL marked the task finished, and every surface downstream read
-- work that completed.
--
-- The exit code answers a different question from the one anybody asks: exit 0
-- means the process ended tidily, which an agent that concluded the task was
-- impossible also does.

insert into event_types (type, projects, note) values
  ('session.ended@1', true,
   'a session runtime ended, with what the evidence says about WHY — kept apart from whether the task finished')
on conflict (type) do nothing;
