-- A routine whose instruction is composed when it fires (M132).
--
-- The nightly backlog agent is not a new mechanism: a routine already runs work
-- on a schedule, with the quota gate in front of it (M94) and the loop bound
-- behind it (M68). What it adds is an instruction built AT FIRE TIME from the
-- backlog, instead of one typed once and repeated — because "work the backlog"
-- means something different every night, and a fixed sentence would have the
-- agent rediscover the list it was scheduled to work.
--
-- `fixed` stays the default and the existing rows keep behaving exactly as they
-- did: a kind added with a default is a column, and a kind added without one is
-- a migration that changes what already runs.

alter table routines
  add column if not exists kind text not null default 'fixed'
    check (kind in ('fixed', 'backlog'));

comment on column routines.kind is
  'fixed: run the instruction as written. backlog: compose it from the project''s
   backlog in the operator''s priority order at fire time — and do NOT run at all
   when the backlog is empty, because a session with nothing to do burns quota
   and writes a transcript saying so, every night, for as long as it exists.';

create or replace function apply_routines(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'routine.defined@1' then
      insert into routines (id, estate_id, project_id, instruction, option_id,
                            every_minutes, kind, created_by, created_at)
      values ((e.payload->>'id')::uuid, e.estate_id, (e.payload->>'project_id')::uuid,
              e.payload->>'instruction', e.payload->>'option_id',
              (e.payload->>'every_minutes')::int,
              coalesce(e.payload->>'kind', 'fixed'),
              e.actor->>'id', e.occurred_at)
      on conflict (id) do nothing;

    when 'routine.ran@1' then
      update routines
         set last_run_at = e.occurred_at, last_task_id = (e.payload->>'task_id')::uuid
       where id = (e.payload->>'id')::uuid;

    when 'routine.updated@1' then
      update routines
         set enabled = coalesce((e.payload->>'enabled')::boolean, enabled),
             every_minutes = coalesce((e.payload->>'every_minutes')::int, every_minutes)
       where id = (e.payload->>'id')::uuid;

    else
      null;
  end case;
end;
$$;

revoke execute on function apply_routines(journal) from public;
revoke execute on function apply_routines(journal) from anon, authenticated, service_role;
