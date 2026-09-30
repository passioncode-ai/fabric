-- Migration 9 — the statistics strip stops describing a moment that never existed.
--
-- It was assembled from four round trips: three counts issued together, then a
-- separate query for the last activity. Two moments, and a project that changes
-- between them produces a strip where the numbers are each true and the row is
-- not. That is a small lie on a screen whose whole job is to be the thing the
-- operator trusts instead of reading a transcript.
--
-- One statement, one snapshot. It also picks up transcripts, which migration 8
-- added and the strip could not see.
--
-- `security invoker`: this runs as whoever calls it, so RLS on every table below
-- still decides what is counted. A SECURITY DEFINER function here would be a
-- second way to read across estates, and migration 6 exists because one of those
-- had already been left open.

create or replace function project_stats(p_project_id uuid)
returns table (
  repos            integer,
  memory_facts     integer,
  transcripts      integer,
  transcript_chars bigint,
  events           integer,
  last_activity_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*)::integer from project_repos       where project_id = p_project_id),
    (select count(*)::integer from memory_facts        where project_id = p_project_id),
    (select count(*)::integer from session_transcripts where project_id = p_project_id),
    (select coalesce(sum(bytes), 0)::bigint from session_transcripts where project_id = p_project_id),
    (select count(*)::integer from journal             where project_id = p_project_id),
    (select max(occurred_at)  from journal             where project_id = p_project_id)
$$;

revoke execute on function project_stats(uuid) from public;
grant  execute on function project_stats(uuid) to authenticated, service_role;
