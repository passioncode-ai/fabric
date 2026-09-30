-- The authority plane gets its vocabulary.
--
-- `grants` and `effect_intents` have existed since migration 1, with the floor
-- in the schema: `CHECK (floor_class is null or grant_id is not null)`. What did
-- not exist was any way to WRITE the decisions that fill them — the four event
-- types below were named in the slice-3 register (`iteration-1-modules.md` §11)
-- and never registered, so `append_event` refused them, which is the register
-- working rather than failing.
--
-- Measured 2026-09-03, before this migration: zero grants, zero effect intents,
-- zero authority events of any kind in the estate. The vision's third principle
-- — every effect has a boundary, an owner and a receipt — had never once been
-- exercised. This is the migration that lets it be.
--
-- `projects` is true for all four: an authority decision is always about
-- something inside a project, and a decision with no project is a decision
-- nobody can scope.

insert into event_types (type, projects, note) values
  ('policy.decided@1', true,
   'the decision port''s verdict — recorded for a REFUSAL exactly as for an allowance, because a plane that only writes down its yeses cannot say what it stopped'),
  ('grant.issued@1', true,
   'one-shot authority for one floored class on one target, with an expiry — not a role and not a setting'),
  ('grant.consumed@1', true,
   'the grant was spent, naming the receipt it was spent on'),
  ('effect.executed@1', true,
   'the effect happened; this event IS the receipt, and effect_intents.receipt_seq points at it')
on conflict (type) do nothing;
