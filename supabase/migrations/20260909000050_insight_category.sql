-- Whose lesson this is, what it is about, and what actually happened to the
-- correction (M182, ADR-0047).
--
-- THREE THINGS, and the second is a live falsehood rather than an absence.
--
-- ONE. `memory_facts.kind` is `note|finding|decision|trap` and that is the only
-- axis there is. A trap in the agent runner and a trap in this repository are
-- the same row, so neither can be filtered out of the other's context pack.
--
-- TWO. The projector already refuses an agent's attempt to bury a person's
-- fact, and it refuses with a WHERE clause:
--
--     and not (memory_facts.actor_kind = 'person' and e.actor->>'kind' = 'agent')
--
-- A WHERE clause that matches nothing raises nothing. The new claim is still
-- written — that part is right, both sit side by side and a person decides —
-- but nothing recorded that the burial had been refused, and the writing tool
-- returned the id it had been ASKED to supersede as though it had. The agent is
-- told its correction landed, the person's fact still answers every search, and
-- the two contradict each other with one of them believed retired.
--
-- SO THE OUTCOME IS COMPUTED WHERE THE REFUSAL HAPPENS AND WRITTEN DOWN. The
-- writer reads it back instead of restating its own request — the same rule as
-- ADR-0050's effects: a request is not an outcome, and only an observation may
-- say what happened. It is a column rather than a return value because the
-- projector has no caller to return to, and a second query afterwards would be
-- a different transaction's answer.
--
-- THREE. An occurrence is an INCIDENT, not a mention of one. Three task runs
-- hitting one incident and writing three facts about it are three facts and one
-- occurrence; counting them as three is how "this has happened three times"
-- becomes true of something that happened once — which is the exact number
-- M184's threshold will fire on. Identity is the capture episode: unique on
-- (estate, project, origin system, source id, episode key), so the three facts
-- resolve to one row by construction rather than by a de-duplicating pass.
--
-- ADDITIVE, AND REPLAY-SAFE. No event type is versioned: the new fields are
-- optional on `memory.project.recorded@1`, so a replay of the whole journal
-- gives every older fact `category='project'` (what it actually is — the old
-- writer had one subject, the project it ran in), `about` null and no
-- occurrence. Nothing is inferred from a basename or a model.

-- ── the facts learn what they are about ──────────────────────────────────────

alter table memory_facts
  add column if not exists category text not null default 'project',
  add column if not exists about_namespace text,
  add column if not exists about_key text,
  add column if not exists occurrence_id uuid,
  -- What was ASKED, kept apart from what happened. Both are needed: the writer
  -- has to be able to say what it tried to correct even when it did not.
  add column if not exists supersedes_requested uuid,
  add column if not exists correction_outcome text not null default 'not_requested',
  add column if not exists correction_reason text;

do $$
begin
  -- A closed category, enforced HERE and not only in the DTO. A free-text
  -- category is a filter nobody can build, and the first misspelling silently
  -- creates a category of one that no reader will ever ask for.
  if not exists (select 1 from pg_constraint where conname = 'memory_facts_category_is_closed') then
    alter table memory_facts add constraint memory_facts_category_is_closed
      check (category in ('project', 'agents', 'harness', 'fabric', 'process'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'memory_facts_about_is_whole') then
    -- A namespace with no key addresses nothing, and a key with no namespace
    -- addresses everything.
    alter table memory_facts add constraint memory_facts_about_is_whole
      check ((about_namespace is null) = (about_key is null));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'memory_facts_about_namespace_is_closed') then
    alter table memory_facts add constraint memory_facts_about_namespace_is_closed
      check (about_namespace is null or about_namespace in
             ('project', 'provider', 'skill', 'fabric-component', 'process'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'memory_facts_correction_is_closed') then
    alter table memory_facts add constraint memory_facts_correction_is_closed
      check (correction_outcome in
             ('not_requested', 'superseded', 'conflict_proposed', 'rejected'));
  end if;

  -- THE FLOOR THIS MIGRATION EXISTS FOR. An outcome that is not the one the
  -- writer asked for must carry its reason: a refusal a caller cannot act on is
  -- a refusal it will simply retry, and a silent one is what shipped.
  if not exists (select 1 from pg_constraint where conname = 'a_refused_correction_says_why') then
    alter table memory_facts add constraint a_refused_correction_says_why
      check (correction_outcome in ('not_requested', 'superseded')
             or correction_reason is not null);
  end if;

  -- And an outcome other than "nothing was asked" needs something to have been
  -- asked about.
  if not exists (select 1 from pg_constraint where conname = 'a_correction_names_what_it_corrects') then
    alter table memory_facts add constraint a_correction_names_what_it_corrects
      check ((correction_outcome = 'not_requested') = (supersedes_requested is null));
  end if;
end $$;

create index if not exists memory_facts_by_about
  on memory_facts (estate_id, about_namespace, about_key)
  where about_namespace is not null;
create index if not exists memory_facts_by_category on memory_facts (estate_id, category);

-- ── an incident, once ────────────────────────────────────────────────────────

create table if not exists memory_occurrences (
  occurrence_id uuid primary key default gen_random_uuid(),
  estate_id     uuid not null,
  project_id    uuid,
  -- The CAPTURE, which is what an incident's identity is made of. A run
  -- correlation is not a recurrence identity: the same incident retried three
  -- times is one episode.
  origin_system text not null,
  source_id     text not null,
  episode_key   text not null,
  -- WHO established that this is a distinct occurrence. An agent saying so is a
  -- claim about the world made by the party with an interest in the number, so
  -- it is recorded as provisional and excluded from any threshold until a host
  -- observation or a review establishes distinctness.
  grouping      text not null default 'agent_proposed'
                  check (grouping in ('host_observed', 'reviewed', 'agent_proposed')),
  first_observed_at timestamptz not null,
  last_observed_at  timestamptz not null,
  constraint one_row_per_episode
    unique (estate_id, project_id, origin_system, source_id, episode_key)
);

create index if not exists memory_occurrences_by_estate
  on memory_occurrences (estate_id, project_id);

alter table memory_occurrences enable row level security;

-- P21: a missing grant looks exactly like an empty table.
grant select on memory_occurrences to authenticated, service_role;
revoke insert, update, delete on memory_occurrences from anon, authenticated;
revoke all on memory_occurrences from anon;

drop policy if exists memory_occurrences_read on memory_occurrences;
create policy memory_occurrences_read on memory_occurrences for select
  using (estate_id in (select estate_id from memberships where person_id = auth.uid()));

-- ── the projector, with the outcome written down ─────────────────────────────

create or replace function apply_memory_facts(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_supersedes uuid;
  v_occurrence uuid;
  v_origin     jsonb := e.payload->'occurrence';
  v_grouping   text;
  v_outcome    text := 'not_requested';
  v_reason     text;
  v_target     record;
  v_owner_seq  bigint;
begin
  -- The retrieval arm, carried forward unchanged. THIS FUNCTION PROJECTS TWO
  -- TYPES, and the first version of this migration replaced it with a body that
  -- handled one — silently dropping every `memory.retrieved@1` row, which is
  -- what the miss backlog and the retrieval count are made of. Caught by
  -- `agent-surface.test.mjs` on a full run: "three searches produced 0
  -- retrieval rows". Replacing a projector means carrying every arm it had.
  if e.type = 'memory.retrieved@1' then
    insert into memory_retrievals (id, estate_id, project_id, session_id, actor_kind,
                                   actor_id, store, query, hits, asked_at, seq)
    values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
            nullif(e.payload->>'session_id', '')::uuid,
            e.actor->>'kind', e.actor->>'id',
            e.payload->>'store', e.payload->>'query',
            coalesce((e.payload->>'hits')::integer, 0),
            e.occurred_at, e.seq)
    on conflict (id) do nothing;
    return;
  end if;

  if e.type <> 'memory.project.recorded@1' then return; end if;

  -- ── A FACT ID IS NOT A MUTABLE SLOT, and the refusal has to be replayable ──
  --
  -- The upsert below exists so a REPLAY is idempotent: the same event applied
  -- twice writes the same row and changes nothing. A DIFFERENT event carrying
  -- the same fact id is not a replay — it is a rewrite of history using the
  -- projector's own idempotency as the tool, and the earlier claim would vanish
  -- with no correction, no lineage and no receipt.
  --
  -- THE FIRST EVENT OWNS THE IDENTITY, and the second changes nothing.
  --
  -- It was a trigger raising `check_violation` first, and the probe showed why
  -- that is the wrong floor HERE. `rebuild_estate_projections` replays the
  -- whole journal, so a raise inside a projector arm does not refuse one write
  -- — it makes the entire estate unrebuildable, for as long as the offending
  -- pair sits in the journal. Refusing an append is a small failure; an estate
  -- whose projections can never be rebuilt is a large one, and ADR-0014 rests
  -- on the rebuild. Ignoring the later event is deterministic, replay-safe, and
  -- keeps exactly what the raise was protecting: the first claim stands.
  select seq into v_owner_seq
    from memory_facts
   where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
  if v_owner_seq is not null and v_owner_seq <> e.seq then return; end if;

  -- ── the occurrence, before the fact that cites it ──
  --
  -- Upserted on the episode tuple, so three facts about one incident find the
  -- one row rather than making a third. `first_observed_at` never moves
  -- backwards past what is already recorded; `last_observed_at` extends.
  if v_origin is not null
     and coalesce(v_origin->>'system', '') <> ''
     and coalesce(v_origin->>'source_id', '') <> ''
     and coalesce(v_origin->>'episode_key', '') <> '' then
    -- An agent's own assertion is provisional whoever it names; only an actor
    -- that is not the agent can promote it. The actor comes from the credential
    -- the event was appended under, never from the payload.
    v_grouping := case
                    when e.actor->>'kind' = 'agent' then 'agent_proposed'
                    when e.actor->>'kind' = 'person' then 'reviewed'
                    else 'host_observed'
                  end;
    insert into memory_occurrences (estate_id, project_id, origin_system, source_id,
                                    episode_key, grouping, first_observed_at, last_observed_at)
    values (e.estate_id, e.project_id, v_origin->>'system', v_origin->>'source_id',
            v_origin->>'episode_key', v_grouping, e.occurred_at, e.occurred_at)
    on conflict (estate_id, project_id, origin_system, source_id, episode_key)
      do update set
        last_observed_at = greatest(memory_occurrences.last_observed_at, excluded.last_observed_at),
        first_observed_at = least(memory_occurrences.first_observed_at, excluded.first_observed_at),
        -- Promotion only. A host observation establishes distinctness an agent
        -- had merely claimed; an agent citing an episode a host observed does
        -- not demote it back to provisional.
        grouping = case
                     when memory_occurrences.grouping = 'host_observed' then 'host_observed'
                     when excluded.grouping = 'host_observed' then 'host_observed'
                     when memory_occurrences.grouping = 'reviewed' or excluded.grouping = 'reviewed'
                       then 'reviewed'
                     else memory_occurrences.grouping
                   end
    returning occurrence_id into v_occurrence;
  end if;

  -- ── the correction, and what actually happened to it ──
  v_supersedes := nullif(e.payload->>'supersedes', '')::uuid;
  if v_supersedes is not null then
    select id, actor_kind, valid_to, superseded_by into v_target
      from memory_facts
     where id = v_supersedes
       and estate_id = e.estate_id
       and project_id = e.project_id;

    if not found then
      v_outcome := 'rejected';
      v_reason  := 'there is no such fact in this project';
    elsif v_target.valid_to is not null
          and v_target.superseded_by is distinct from (e.payload->>'id')::uuid then
      -- Already corrected BY SOMEBODY ELSE. Closing it again would silently
      -- overwrite whichever correction got there first.
      --
      -- "By somebody else" is the whole clause, and P24 is why: projections are
      -- REBUILT by replaying the journal OVER the existing rows rather than
      -- into an empty table (`rebuild_estate_projections`), so every arm has to
      -- be idempotent. Written as a bare `valid_to is not null`, this branch
      -- read the state its own previous application had produced: on the first
      -- pass the correction succeeded, on the rebuild it saw a closed target
      -- and demoted itself to a conflict. A projection that does not survive
      -- its own replay is not a projection (ADR-0014), and no unit test can
      -- see it — the defect only exists on the second application.
      v_outcome := 'conflict_proposed';
      v_reason  := 'that fact had already been corrected; this claim stands beside the correction';
    elsif v_target.actor_kind = 'person' and e.actor->>'kind' = 'agent' then
      v_outcome := 'conflict_proposed';
      v_reason  := 'an agent may not bury what a person recorded; both claims stand and a person decides';
    else
      v_outcome := 'superseded';
    end if;
  end if;

  insert into memory_facts (id, estate_id, project_id, claim, source_ref, kind,
                            actor_kind, actor_id, recorded_at, valid_from, seq,
                            category, about_namespace, about_key, occurrence_id,
                            supersedes_requested, correction_outcome, correction_reason)
  values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
          e.payload->>'claim', e.payload->>'source_ref',
          coalesce(e.payload->>'kind', 'note'),
          e.actor->>'kind', e.actor->>'id',
          e.occurred_at,
          coalesce((e.payload->>'valid_from')::timestamptz, e.occurred_at),
          e.seq,
          -- Absent means the project. Every fact recorded before this migration
          -- replays to exactly that, which is what it is.
          coalesce(nullif(e.payload->>'category', ''), 'project'),
          nullif(e.payload#>>'{about,namespace}', ''),
          nullif(e.payload#>>'{about,key}', ''),
          v_occurrence,
          v_supersedes, v_outcome, v_reason)
  on conflict (id) do update
    set claim = excluded.claim, source_ref = excluded.source_ref, kind = excluded.kind,
        actor_kind = excluded.actor_kind, actor_id = excluded.actor_id,
        valid_from = excluded.valid_from,
        -- CARRIED, and the probe is why. Without it `new.seq` equals `old.seq`
        -- on every upsert, so the trigger below — which tells a replay from a
        -- rewrite by exactly that difference — could never see one. The floor
        -- was installed, the trigger existed, and it was unreachable.
        seq = excluded.seq,
        category = excluded.category,
        about_namespace = excluded.about_namespace,
        about_key = excluded.about_key,
        occurrence_id = excluded.occurrence_id,
        supersedes_requested = excluded.supersedes_requested,
        correction_outcome = excluded.correction_outcome,
        correction_reason = excluded.correction_reason;

  if v_outcome = 'superseded' then
    update memory_facts
       set valid_to = e.occurred_at,
           superseded_by = (e.payload->>'id')::uuid
     where id = v_supersedes
       and estate_id = e.estate_id
       and project_id = e.project_id
       and valid_to is null;
  end if;
end $$;

revoke execute on function apply_memory_facts(journal) from public;
revoke execute on function apply_memory_facts(journal) from anon, authenticated, service_role;
drop trigger if exists memory_fact_is_not_a_slot on memory_facts;
drop function if exists memory_fact_is_not_a_slot();
