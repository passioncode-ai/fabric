-- Migration 1 — the collated obligations:
--   ADR-0013  project hierarchy under the estate, no goal_id parent
--   ADR-0014  one append-only event journal from migration 1
--   ADR-0016  estate_id in the schema from migration 1, actor on every event
--   ADR-0004/0028  the floor as constraints: floored effects require a grant
--   ADR-0027  per-estate gapless order, single writer, synchronous projections
--   ADR-0030  Run grain (runs/nodes tables arrive with slice 3; grain is fixed here in comments)
-- RLS invariants per federation.md §7: TO authenticated + membership predicate,
-- wrapped (select auth.uid()), policy-column indexes. service_role is confined to
-- the desktop app's main process (ADR-0031 §2).

-- ————————————————————————————————————————————— identity plane (seeded, not journaled)

create table persons (
  id           uuid primary key default gen_random_uuid(),
  display_name text,
  auth_user    uuid unique,
  created_at   timestamptz not null default now()
);

-- ————————————————————————————————————————————— projection tables (registers)
-- Every table below except grants/effect_intents is a projection of the journal
-- (ADR-0014): rebuildable via rebuild_estate_projections().

create table estates (
  id         uuid primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table memberships (
  person_id  uuid not null references persons(id),
  estate_id  uuid not null references estates(id),
  role       text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (person_id, estate_id)
);
create index memberships_estate on memberships(estate_id);

create table projects (
  id              uuid primary key,
  estate_id       uuid not null,
  name            text not null,
  purpose         text,
  repo_path       text,
  status          text not null default 'active' check (status in ('active', 'archived')),
  config_revision integer not null default 1,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz
);
create index projects_estate on projects(estate_id);

create table goals (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  title      text not null,
  -- ADR-0004: autonomy is a goal field; the floor below is schema, not prompt
  autonomy   text not null check (autonomy in ('safe', 'guarded', 'maximum')),
  created_at timestamptz not null default now()
);
create index goals_project on goals(project_id);

create table agent_bindings (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id),
  estate_id    uuid not null,
  role         text not null,
  provider_ref text,
  status       text not null default 'active' check (status in ('active', 'disabled', 'retired')),
  created_at   timestamptz not null default now()
);
-- ADR-0010: exactly one product manager per project, enforced here, not by convention
create unique index one_pm_per_project
  on agent_bindings(project_id)
  where role = 'product-manager' and status = 'active';
create index agent_bindings_estate on agent_bindings(estate_id);

-- ————————————————————————————————————————————— the floor (ADR-0004/0028)

create table grants (
  id           uuid primary key default gen_random_uuid(),
  estate_id    uuid not null,
  floor_class  text not null check (floor_class in ('money', 'deletion', 'publication')),
  target       text not null,
  precondition jsonb,
  expires_at   timestamptz not null,
  issued_by    uuid,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index grants_estate on grants(estate_id);

create table effect_intents (
  id           uuid primary key default gen_random_uuid(),
  estate_id    uuid not null,
  node_id      uuid,
  action_class text not null,
  floor_class  text check (floor_class in ('money', 'deletion', 'publication')),
  grant_id     uuid references grants(id),
  receipt_seq  bigint not null,
  created_at   timestamptz not null default now(),
  -- ADR-0028 §2/3: a floored effect without a live grant does not exist.
  -- Code that bypasses the policy module still hits this line.
  constraint floored_needs_grant check (floor_class is null or grant_id is not null)
);
create index effect_intents_estate on effect_intents(estate_id);

-- ————————————————————————————————————————————— the journal (ADR-0014/0027)

create table journal (
  estate_id   uuid not null,           -- no FK: estates itself is a projection
  seq         bigint not null,         -- per-estate, gapless, assigned at commit
  type        text not null,           -- 'noun.verb@N'
  schema_rev  text not null default '1',
  actor       jsonb not null,          -- {kind: person|agent|system, id}
  project_id  uuid,
  run_id      uuid,
  node_id     uuid,
  occurred_at timestamptz not null default now(),
  payload     jsonb not null default '{}'::jsonb,
  primary key (estate_id, seq)
);

-- Append-only at the database level (ADR-0027 §6): nobody updates or deletes,
-- and inserts go only through append_event() below.
revoke insert, update, delete on table journal from public;
revoke insert, update, delete on table journal from anon, authenticated, service_role;

-- ————————————————————————————————————————————— projections (ADR-0027 §3)
-- Synchronous, in the append transaction; a failing projector rolls the append back.

create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Projectors are UPSERTS: replaying the journal over existing rows converges
  -- instead of colliding, which is what lets rebuild repair a corrupted register
  -- without deleting rows that non-projection tables (agent_bindings, goals)
  -- reference by FK.
  case e.type
    when 'estate.created@1' then
      insert into estates (id, name, created_at)
      values (e.estate_id, coalesce(e.payload->>'name', 'unnamed estate'), e.occurred_at)
      on conflict (id) do update set name = excluded.name;
    when 'project.created@1' then
      insert into projects (id, estate_id, name, purpose, repo_path, created_at)
      values ((e.payload->>'id')::uuid, e.estate_id,
              e.payload->>'name', e.payload->>'purpose', e.payload->>'repo_path',
              e.occurred_at)
      on conflict (id) do update
        set name = excluded.name, purpose = excluded.purpose,
            repo_path = excluded.repo_path;
    when 'project.archived@1' then
      update projects
        set status = 'archived', archived_at = e.occurred_at
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    else
      -- terminal.opened@1 / terminal.closed@1 and future types project nothing yet;
      -- the feed reads the journal directly (ADR-0027 §2).
      null;
  end case;
end $$;

-- The single writer (ADR-0027 §1). SECURITY DEFINER + execute granted to
-- service_role only: even privilege-wise there is exactly one door.
create or replace function append_event(
  p_estate_id uuid,
  p_type      text,
  p_actor     jsonb,
  p_payload   jsonb default '{}'::jsonb,
  p_schema_rev text default '1',
  p_project_id uuid default null,
  p_run_id     uuid default null,
  p_node_id    uuid default null
) returns journal
language plpgsql
security definer set search_path = public
as $$
declare
  v_seq bigint;
  v_event journal;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate_id;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload)
  values (p_estate_id, v_seq, p_type, p_schema_rev, p_actor, p_project_id, p_run_id, p_node_id, p_payload)
  returning * into v_event;
  perform apply_projections(v_event);
  return v_event;
end $$;

revoke execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) from public;
revoke execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) from anon, authenticated;
grant  execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) to service_role;

-- Rebuild fixture (ADR-0027 §3): a projection must equal its replay.
create or replace function rebuild_estate_projections(p_estate_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare e journal;
begin
  -- Upsert-replay: converges corrupted rows back to the journal's truth without
  -- deleting rows other tables reference. Orphan removal (a projection row the
  -- journal never produced) is a slice-3 concern, noted in iteration-1-modules §4.
  for e in select * from journal where estate_id = p_estate_id order by seq loop
    perform apply_projections(e);
  end loop;
end $$;

revoke execute on function rebuild_estate_projections(uuid) from public;
revoke execute on function rebuild_estate_projections(uuid) from anon, authenticated;
grant  execute on function rebuild_estate_projections(uuid) to service_role;

-- ————————————————————————————————————————————— RLS (federation.md §7)
-- Read policies for authenticated members; no write policies — writes go through
-- append_event under the service role in the app's main process. RLS is shipped
-- and tested from migration 1; runtime principals arrive with membership (M38).

alter table persons        enable row level security;
alter table estates        enable row level security;
alter table memberships    enable row level security;
alter table projects       enable row level security;
alter table goals          enable row level security;
alter table agent_bindings enable row level security;
alter table grants         enable row level security;
alter table effect_intents enable row level security;
alter table journal        enable row level security;

create or replace function member_estates()
returns setof uuid
language sql
stable
security invoker set search_path = public
as $$
  select m.estate_id
  from memberships m
  join persons p on p.id = m.person_id
  where p.auth_user = (select auth.uid())
$$;

create policy self_person_read on persons
  for select to authenticated
  using (auth_user = (select auth.uid()));

create policy member_estate_read on estates
  for select to authenticated
  using (id in (select member_estates()));

-- Direct predicate, deliberately NOT member_estates(): a memberships policy that
-- calls a function reading memberships is infinite recursion. persons' own RLS
-- confines the subquery to the caller's row, which is exactly the semantics.
create policy own_membership_read on memberships
  for select to authenticated
  using (person_id in (select id from persons where auth_user = (select auth.uid())));

create policy member_projects_read on projects
  for select to authenticated
  using (estate_id in (select member_estates()));

create policy member_goals_read on goals
  for select to authenticated
  using (project_id in (select id from projects where estate_id in (select member_estates())));

create policy member_bindings_read on agent_bindings
  for select to authenticated
  using (estate_id in (select member_estates()));

create policy member_grants_read on grants
  for select to authenticated
  using (estate_id in (select member_estates()));

create policy member_effects_read on effect_intents
  for select to authenticated
  using (estate_id in (select member_estates()));

create policy member_journal_read on journal
  for select to authenticated
  using (estate_id in (select member_estates()));

-- ————————————————————————————————————————————— table privileges (explicit)
-- Privileges gate tables, RLS gates rows. authenticated reads through RLS;
-- service_role (the app's main process) writes registers — but the journal
-- stays single-doored: select only, all writes through append_event.

grant usage on schema public to authenticated, service_role;
grant select on persons, estates, memberships, projects, goals,
                agent_bindings, grants, effect_intents, journal
  to authenticated;
grant select, insert, update, delete on persons, estates, memberships, projects,
                goals, agent_bindings, grants, effect_intents
  to service_role;
grant select on journal to service_role;
grant execute on function member_estates() to authenticated, service_role;
