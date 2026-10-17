-- Repository identity and detach tombstones (ADR-0136): a clone can resolve by normalized remote, and an automatic
-- enrollment cannot undo an operator's detach. Existing duplicates are reported, never dropped.

-- #region project-repo-identity — docs: docs/adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md#decision
alter table project_repos
  add column remote_key text,
  add column kind text not null default 'checkout'
    check (kind in ('primary', 'checkout', 'worktree'));

update project_repos set kind = case when is_primary then 'primary' else 'checkout' end;
create index project_repos_remote_key on project_repos(estate_id, remote_key);

do $$
begin
  if exists (select 1 from project_repos where estate_id is not null and path is not null
             group by estate_id, path having count(*) > 1) then
    raise warning 'project_repos has duplicate (estate_id, path) rows; they are preserved and the unique estate-path index is not created';
  else
    create unique index project_repos_unique_estate_path on project_repos(estate_id, path);
  end if;
end $$;

create table project_repo_removals (
  id          uuid not null,
  estate_id   uuid not null,
  project_id  uuid not null,
  path        text not null,
  remote_key  text,
  kind        text not null default 'checkout' check (kind in ('primary', 'checkout', 'worktree')),
  detached_at timestamptz not null,
  primary key (estate_id, id)
);
create index project_repo_removals_project on project_repo_removals(project_id);
create index project_repo_removals_remote on project_repo_removals(estate_id, remote_key);
alter table project_repo_removals enable row level security;
create policy member_repo_removals_read on project_repo_removals
  for select to authenticated
  using (estate_id in (select member_estates()));
grant select on project_repo_removals to authenticated;
grant select, insert, update, delete on project_repo_removals to service_role;

create or replace function apply_project_repo_identity(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'project.repo.attached@1' then
      update project_repos
        set remote_key = nullif(e.payload->>'remote_key', ''),
            kind = coalesce(nullif(e.payload->>'kind', ''), case when is_primary then 'primary' else 'checkout' end)
      where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
      -- An explicit attach, by either the operator or an agent, clears the matching removal. Automation checks the
      -- tombstone before it reaches this point; the journal remains the complete history of both directions.
      delete from project_repo_removals
      where estate_id = e.estate_id
        and (
          id = (e.payload->>'id')::uuid
          or (project_id = e.project_id and (
            (nullif(e.payload->>'path', '') is not null and path = e.payload->>'path')
            or (nullif(e.payload->>'remote_key', '') is not null and remote_key = e.payload->>'remote_key')
          ))
        );
    when 'project.repo.detached@1' then
      -- Detach events written before path identity was recorded cannot create a tombstone.
      if nullif(e.payload->>'path', '') is null then return; end if;
      insert into project_repo_removals (id, estate_id, project_id, path, remote_key, kind, detached_at)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id, e.payload->>'path',
              nullif(e.payload->>'remote_key', ''), coalesce(nullif(e.payload->>'kind', ''), 'checkout'), e.occurred_at)
      on conflict (estate_id, id) do update
        set path = excluded.path, remote_key = excluded.remote_key, kind = excluded.kind, detached_at = excluded.detached_at;
    else null;
  end case;
end $$;
revoke execute on function apply_project_repo_identity(journal) from public, anon, authenticated, service_role;

create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform apply_estate_and_projects(e);
  perform apply_project_repo_identity(e);
  perform apply_task_lifecycle_base(e);
  perform apply_memory_facts(e);
  perform apply_operating_surfaces(e);
  perform apply_goals(e);
  perform apply_move_provenance(e);
  perform apply_project_servers(e);
  perform apply_created_agents(e);
  perform apply_routines(e);
  perform apply_proposals(e);
  perform apply_handoffs(e);
  perform apply_link_needs(e);
  perform apply_questions(e);
  perform apply_question_deferrals(e);
  perform apply_priority(e);
  perform apply_grants(e);
  perform apply_effect_lifecycle(e);
  perform apply_heartbeats(e);
  perform apply_deliveries(e);
  perform apply_task_runs(e);
  perform apply_transcript_capture(e);
  perform apply_ceo_receipt(e);
  perform apply_releases(e);
  perform apply_hub_access(e);
  perform apply_comms(e);
  perform apply_task_sources(e);
  perform apply_work_claims(e);
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;
-- #endregion project-repo-identity
