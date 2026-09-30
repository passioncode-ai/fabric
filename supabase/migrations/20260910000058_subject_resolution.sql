-- Who is acting, resolved at the trusted boundary (FA-07 · S09).
--
-- WHAT MIGRATION 52 SAID ABOUT ITSELF, and it was right: "It is not an
-- authentication system: there is no login here, OPERATOR_ACTOR is the literal
-- string 'operator', and every RLS policy that keys off auth.uid() has never
-- been exercised by this application because it connects as the service role."
-- It built the FLOOR — an estate keeps an owner, a membership carries a revision
-- — before identity arrived. This is the layer that stands on it.
--
-- AND IT DOES NOT CHOOSE A PROVIDER. Which identity provider this product uses
-- is an activation decision the operator owns, listed as one in the audit's own
-- question table. What is built here is the SEAM: a subject is resolved against
-- `persons` and `memberships` in the database, so adding a provider is wiring an
-- `auth_user` into a row rather than surgery on every command. Until one is
-- chosen the product runs single-operator, and that is recorded as the reason
-- rather than left as an appearance of authentication.
--
-- THE REVISION IS THE POINT. Authority is read, a decision is made on it, and
-- the write happens later; a revoke landing in between is exactly what the
-- revision exists to catch. Resolving returns it, so a caller that read revision
-- 3 and writes against 4 is acting on authority that has moved.

create or replace function resolve_subject(
  p_estate_id uuid,
  p_person_id uuid
)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  p persons;
  m memberships;
begin
  select * into p from persons where id = p_person_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason_code', 'no_such_person',
      'says', 'that person does not exist');
  end if;

  select * into m from memberships
   where estate_id = p_estate_id and person_id = p_person_id;
  if not found then
    -- The SAME answer whether the estate is empty, the person was never a
    -- member, or their membership was revoked a second ago. A refusal that
    -- distinguished them would let an outsider map an estate's roster by asking.
    return jsonb_build_object('ok', false, 'reason_code', 'not_a_member',
      'says', 'that person is not a member of this estate');
  end if;

  return jsonb_build_object('ok', true,
    'person_id', p.id,
    'display_name', p.display_name,
    'auth_user', p.auth_user,
    'role', m.role,
    'revision', m.revision);
end;
$$;

comment on function resolve_subject(uuid, uuid) is
  'FA-07. Resolves a person to their membership in one estate, with the revision authority moves on. Refuses a non-member with the same sentence it gives a stranger.';

-- ── the person the product runs as, until a provider is chosen ──────────────
--
-- A ROW, not a literal. `OPERATOR_ACTOR` was the string 'operator' in one file
-- and the same object written out twice more in another, so the operator's
-- identity had three definitions and nothing forbade a fourth. A row can hold an
-- `auth_user` the day a provider lands; a string cannot.
--
-- THE JOURNAL'S AUTHORSHIP DOES NOT MOVE. Events already written say
-- `person:operator`, and rewriting them would falsify the record to tidy a
-- vocabulary. The person carries the legacy handle as its display name, so a
-- reader resolves both to one identity without any history changing.
insert into persons (id, display_name, auth_user)
values ('00000000-0000-0000-0000-00000000000a', 'operator', null)
on conflict (id) do nothing;

insert into memberships (person_id, estate_id, role, changed_by)
select '00000000-0000-0000-0000-00000000000a', e.id, 'owner', 'migration:subject-resolution'
  from estates e
on conflict (person_id, estate_id) do nothing;

revoke execute on function resolve_subject(uuid, uuid) from public, anon, authenticated;
grant execute on function resolve_subject(uuid, uuid) to service_role;

-- ── an estate is created with an owner ──────────────────────────────────────
--
-- Extended rather than rewritten: every other arm of this concern function is
-- unchanged and one clause is added beside them.
create or replace function apply_estate_and_projects(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_next_primary uuid;
begin
  case e.type
    when 'estate.created@1' then
      insert into estates (id, name, created_at)
      values (e.estate_id, coalesce(e.payload->>'name', 'unnamed estate'), e.occurred_at)
      on conflict (id) do update set name = excluded.name;
      -- AN ESTATE IS CREATED WITH AN OWNER, or it is created unreachable (FA-07).
      --
      -- MEASURED 2026-09-10: a brand new estate got no membership at all, so the
      -- identity port could not establish a subject and a fresh install would
      -- not start. Migration 58 seeds the estates that already existed; this is
      -- the same fact for every one created from here on.
      --
      -- The owner travels IN THE EVENT rather than being assumed, so the record
      -- says who founded the estate. A legacy event naming nobody leaves it
      -- without one — visible immediately at the identity boundary, which is
      -- where it matters — rather than inventing an owner nobody appointed.
      --
      -- Guarded on the person EXISTING, because a projector may not refuse: a
      -- foreign key violation here would abort a replay and leave an estate that
      -- cannot be rebuilt, which is the failure operating-surfaces.md 4.1 exists
      -- to prevent.
      if e.payload->>'owner_person_id' is not null
         and exists (select 1 from persons where id = (e.payload->>'owner_person_id')::uuid) then
        insert into memberships (person_id, estate_id, role, changed_by)
        values ((e.payload->>'owner_person_id')::uuid, e.estate_id, 'owner', 'estate.created@1')
        on conflict (person_id, estate_id) do nothing;
      end if;
    when 'project.created@1' then
      insert into projects (id, estate_id, name, purpose, repo_path, created_at,
                            memory_backend, default_agent)
      values ((e.payload->>'id')::uuid, e.estate_id,
              e.payload->>'name', e.payload->>'purpose', e.payload->>'repo_path',
              e.occurred_at,
              coalesce(e.payload->>'memory_backend', 'local'),
              coalesce(e.payload->>'default_agent', 'claude-code'))
      on conflict (id) do update
        set name = excluded.name, purpose = excluded.purpose,
            repo_path = excluded.repo_path,
            memory_backend = excluded.memory_backend,
            default_agent = excluded.default_agent;
    when 'project.updated@1' then
      update projects
        set name      = coalesce(e.payload->>'name', name),
            purpose   = case when e.payload ? 'purpose'   then e.payload->>'purpose'   else purpose end,
            repo_path = case when e.payload ? 'repo_path' then e.payload->>'repo_path' else repo_path end,
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.settings.updated@1' then
      update projects
        set memory_backend = coalesce(e.payload->>'memory_backend', memory_backend),
            default_agent  = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.archived@1' then
      update projects
        set status = 'archived', archived_at = e.occurred_at
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.repo.attached@1' then
      insert into project_repos (id, estate_id, project_id, path, label, is_primary, attached_at)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'path', e.payload->>'label',
              coalesce((e.payload->>'is_primary')::boolean, false), e.occurred_at)
      on conflict (id) do update set path = excluded.path, label = excluded.label;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        update project_repos set is_primary = true where id = (e.payload->>'id')::uuid
               and estate_id = e.estate_id;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    when 'project.repo.detached@1' then
      delete from project_repos where id = (e.payload->>'id')::uuid and project_id = e.project_id
             and estate_id = e.estate_id;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        select id into v_next_primary from project_repos
          where project_id = e.project_id order by attached_at limit 1;
        if v_next_primary is not null then
          update project_repos set is_primary = true where id = v_next_primary
                 and estate_id = e.estate_id;
        end if;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    else
      null;
  end case;
end $$;