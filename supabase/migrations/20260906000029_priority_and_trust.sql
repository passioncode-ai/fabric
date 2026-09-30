-- Project priority and CEO trust (M156, ADR-0036).
--
-- Two things the Board needs before it can rank across projects: how much a
-- project's items weigh (its DECLARED tier, never mutated by the system, plus
-- measured pressure computed at read time in `shared/projectWeight.ts`), and how
-- far the CEO may settle on the operator's behalf (a trust level that inherits
-- the estate and may be lowered per project, never raised — ADR-0004's shape on
-- a different subject).
--
-- The tier is stored on the project; the estate defaults live in one row. Both
-- move only by a journalled event, because "who set this channel's trust" and
-- "who called this project critical" must stay answerable.

alter table projects add column priority_tier text not null default 'active'
  check (priority_tier in ('critical','active','steady','paused'));
alter table projects add column priority_because text;
-- null = inherit the estate's trust; a value may only LOWER it (enforced in the
-- reader, `ceoTrustFor`, because "may not exceed" is a comparison the schema
-- cannot make without the estate row in hand).
alter table projects add column ceo_trust text
  check (ceo_trust is null or ceo_trust in ('ask','cited','routine','proposing'));

create table estate_settings (
  estate_id uuid primary key,
  ceo_trust text not null default 'cited'
    check (ceo_trust in ('ask','cited','routine','proposing')),
  criticality_threshold integer not null default 60,
  -- The rank weights (shared/projectWeight.ts defaults), tunable. Stored as JSON
  -- so a change is one event, and every Board item shows its components so a
  -- mis-set weight is a visible wrong order rather than a mystery.
  priority_weights jsonb,
  seq bigint not null
);

create or replace function apply_priority(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'project.priority.set@1' then
      update projects
         set priority_tier = e.payload->>'tier',
             priority_because = e.payload->>'because'
       where id = (e.payload->>'project_id')::uuid and estate_id = e.estate_id;

    when 'project.trust.set@1' then
      -- Empty string clears the override (back to inheriting the estate).
      update projects
         set ceo_trust = nullif(e.payload->>'trust','')
       where id = (e.payload->>'project_id')::uuid and estate_id = e.estate_id;

    when 'estate.settings.set@1' then
      insert into estate_settings (estate_id, ceo_trust, criticality_threshold, priority_weights, seq)
      values (e.estate_id,
              coalesce(e.payload->>'ceo_trust', 'cited'),
              coalesce((e.payload->>'criticality_threshold')::int, 60),
              e.payload->'priority_weights',
              e.seq)
      on conflict (estate_id) do update
        set ceo_trust = coalesce(e.payload->>'ceo_trust', estate_settings.ceo_trust),
            criticality_threshold = coalesce((e.payload->>'criticality_threshold')::int, estate_settings.criticality_threshold),
            priority_weights = coalesce(e.payload->'priority_weights', estate_settings.priority_weights),
            seq = e.seq;
    else
      null;
  end case;
end;
$$;

create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform apply_projections_legacy(e);
  perform apply_operating_surfaces(e);
  perform apply_move_provenance(e);
  perform apply_project_servers(e);
  perform apply_created_agents(e);
  perform apply_routines(e);
  perform apply_proposals(e);
  perform apply_handoffs(e);
  perform apply_link_needs(e);
  perform apply_questions(e);
  perform apply_priority(e);
end;
$$;

alter table estate_settings enable row level security;
create policy member_estate_settings_read on estate_settings
  for select to authenticated
  using (estate_id in (select member_estates()));
grant select on estate_settings to authenticated;
grant select, insert, update, delete on estate_settings to service_role;

revoke execute on function apply_priority(journal) from public;
revoke execute on function apply_priority(journal) from anon, authenticated, service_role;
revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;

insert into event_types (type, projects, note) values
  ('project.priority.set@1', true, 'the operator declares a project''s priority tier — never mutated by the system (M156)'),
  ('project.trust.set@1',    true, 'the operator overrides the CEO trust for one project; may only lower the estate''s'),
  ('estate.settings.set@1',  true, 'estate-wide CEO trust, criticality threshold and rank weights')
on conflict (type) do nothing;
