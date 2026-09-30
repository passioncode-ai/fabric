-- A goal is dated when it was defined, not when it was replayed (FA-06).
--
-- MEASURED 2026-09-10, by restoring an archive into a clean database and
-- comparing every projection column against the source: one differed.
-- `apply_goals` inserts without `created_at`, so the column's `default now()`
-- fires — and on a replay that is the moment of the REPLAY. A restored estate
-- said its goals were defined at the instant somebody recovered them.
--
-- Nine milliseconds in the probe. Years, on a real archive.
--
-- Every other arm in this projector already writes `e.occurred_at`, so this is
-- one omission rather than a policy: the journal knows when the goal was
-- defined, and a projection is a rendering of the journal or it is a second
-- source of truth (ADR-0014).
--
-- Additive: `apply_goals` is a per-concern function and this re-declares that
-- one function, leaving the dispatcher and every other arm untouched.

create or replace function apply_goals(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'goal.defined@1' then
      insert into goals (id, estate_id, project_id, title, autonomy, created_at)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id, e.payload->>'title',
              coalesce(e.payload->>'autonomy', 'safe'), e.occurred_at)
      on conflict (id) do nothing;
    else
      null;
  end case;
end;
$$;
