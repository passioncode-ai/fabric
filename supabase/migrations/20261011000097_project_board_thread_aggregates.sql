-- #region board-thread-aggregates — docs: docs/ux/scenarios.md#scn-143-see-what-projects-tell-each-other
-- 84 (by count; suffix 97 — 95/96 stay the pipeline's prose reservation, moved to 98/99 in the same
-- change): the Comms screen's filter slice (SCN-143, amended 2026-10-11; COM-07). The thread list
-- narrows on three filters and NEVER re-queries the board, so the one function that feeds it must
-- already answer with what the filters match on: which kinds of messages a thread HOLDS, and whether
-- it holds an open request. Client-side aggregation over the messages themselves would need every
-- message read first — the screen reads pages, so the aggregate belongs here, beside the rows.
--
-- `create or replace`, not a new function: same name, same signature, two added jsonb fields. Replace
-- keeps the grants migration 94 (80 by count then) made — service_role only — which the DB test
-- asserts rather than assumes. `board_list_operator` is untouched.
--
-- A request is OPEN outside the contract's terminal set (completed, failed_known, cancelled,
-- expired); outcome_unknown counts as open, because only reconciliation leaves it (the amendment's
-- own words). `kinds` is sorted and distinct, so the renderer's filter never has to dedupe.
create or replace function board_threads_operator(p_estate_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb;
begin
  if p_estate_id is null then
    return board_refusal('invalid_arguments', 'The thread request is not valid.');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'subject', t.subject,
           'participants', t.participants,
           'createdBy', t.created_by,
           'createdSeq', t.created_seq,
           'messageCount', s.count,
           'lastSeq', coalesce(s.last_seq, 0),
           'lastAt', case when s.last_at is not null then to_char(s.last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
           'kinds', coalesce(to_jsonb(s.kinds), '[]'::jsonb),
           'openRequests', r.open_requests
         ) order by t.created_seq), '[]'::jsonb)
    into v_rows
    from board_threads t
    left join lateral (
      select count(*)::integer as count, max(m.seq) as last_seq, max(m.at) as last_at,
             coalesce(array_agg(distinct m.kind order by m.kind), '{}'::text[]) as kinds
        from board_messages m
       where m.estate_id = t.estate_id and m.thread_id = t.id
    ) s on true
    left join lateral (
      select count(*)::integer as open_requests
        from board_requests br
        join board_messages m on m.id = br.message_id
       where m.estate_id = t.estate_id and m.thread_id = t.id
         and br.state not in ('completed', 'failed_known', 'cancelled', 'expired')
    ) r on true
   where t.estate_id = p_estate_id;
  return jsonb_build_object('ok', true, 'threads', v_rows);
end $$;
-- #endregion board-thread-aggregates
