-- What the observer saw, recorded once per condition (M179).
--
-- MEASURED: `deriveLiveness` shipped in M178 with exactly one caller in the
-- tree — its own test. Every rule about stalls, waits and harness breaks was
-- correct, tested, and never applied to a running session.
--
-- ONE ROW PER CONDITION, not one per pass. A stalled session sampled every
-- thirty seconds would produce an obligation every thirty seconds, and an
-- operator learns to scroll past a list that repeats itself.

insert into event_types (type, projects, note) values
  ('session.observed@1', true,
   'the observer changed its judgement about a session; it records a transition, never a repeat of the same state')
on conflict (type) do nothing;
