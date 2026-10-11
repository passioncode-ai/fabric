-- #region board-operator-read — docs: docs/evidence/plans/2026-10-04-project-communications.md#com-07--live-board-history-and-chain-interface
-- 80 (by count; suffix 84 — 82/83 are the pipeline's prose reservation, CO-221): the operator's read
-- path onto the project board, for the board's operator screen (COM-06 scenarios, COM-07 live board).
--
-- Why a separate path: `board_list`/`board_get` answer for exactly one reader Project and refuse
-- everyone else (`p_reader = any (t.participants)`), which is the contract's rule for agents. The
-- operator is not a Project and takes part in no thread. Their reading of the LOCAL estate's board
-- is the decision ADR-0117 records as D3: "whether an admin reads agent content" is deferred for the
-- ENTERPRISE release, not for the local board — so the local read is sanctioned here, as two
-- security-definer functions with the read logic in one place, never as a table scan from the app.
-- These functions WRITE nothing: read marks, unread counts and requests belong to participant
-- Projects, and the operator's screen gets none of them.

-- The estate's threads, oldest first: who takes part, what it is about, how much it holds and where
-- the reading cursor starts. Project names are resolved by the caller; the board keeps its own ids.
create function board_threads_operator(p_estate_id uuid) returns jsonb
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
           'lastAt', case when s.last_at is not null then to_char(s.last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
         ) order by t.created_seq), '[]'::jsonb)
    into v_rows
    from board_threads t
    left join lateral (
      select count(*)::integer as count, max(m.seq) as last_seq, max(m.at) as last_at
        from board_messages m
       where m.estate_id = t.estate_id and m.thread_id = t.id
    ) s on true
   where t.estate_id = p_estate_id;
  return jsonb_build_object('ok', true, 'threads', v_rows);
end $$;

-- One page for the operator: messages of one thread, or of the whole estate when p_thread is null,
-- after `p_after_seq`, oldest first, at most 100 — the same paging contract as board_list, so the
-- screen's cursor logic is the board's own. No participant check and no read mark: the operator is
-- not a reader Project (ADR-0117 D3). A redacted message keeps its id and digest and loses its body,
-- exactly as board_message_json already shapes it.
create function board_list_operator(p_estate_id uuid, p_thread uuid, p_after_seq bigint, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); v_rows jsonb; v_last bigint; v_more boolean;
begin
  if p_estate_id is null or p_after_seq is null or p_after_seq < 0 then
    return board_refusal('invalid_arguments', 'The page request is not valid.');
  end if;
  if p_thread is not null and not exists (select 1 from board_threads t where t.id = p_thread and t.estate_id = p_estate_id) then
    return board_refusal('not_found', 'That thread is not part of this estate.');
  end if;
  with page as (
    select m.id, m.seq from board_messages m
     where m.estate_id = p_estate_id and m.seq > p_after_seq
       and (p_thread is null or m.thread_id = p_thread)
     order by m.seq limit v_limit + 1),
  kept as (select id, seq from page order by seq limit v_limit)
  select coalesce((select jsonb_agg(board_message_json(bm) order by bm.seq) from board_messages bm join kept k on k.id = bm.id), '[]'::jsonb),
         (select max(seq) from kept), (select count(*) from page) > v_limit
    into v_rows, v_last, v_more;
  return jsonb_build_object('ok', true, 'messages', v_rows, 'last_seq', coalesce(v_last, p_after_seq), 'more', coalesce(v_more, false));
end $$;

-- The same door as the board's own commands: the service role only — the host's main process, which is
-- where the operator's screen reads from. Nobody else's role reaches a board row, here either.
revoke execute on function board_threads_operator(uuid), board_list_operator(uuid, uuid, bigint, integer)
  from public, anon, authenticated;
grant execute on function board_threads_operator(uuid), board_list_operator(uuid, uuid, bigint, integer)
  to service_role;
-- #endregion board-operator-read
