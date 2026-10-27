-- 99 (by count; suffix 126): the home's journal reads on indexes of their own (CO-469, CO-477; the 0.3.15 release
-- review, iteration 1, DA-4, and iteration 2, ER-10).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 99. The task pipeline's prose
-- reservation held 126 and 127 unexecuted (`docs/evidence/plans/task-pipeline-persistence-contract.md`); this file takes
-- 126, the next free number, and by that document's collision rule the reservation moves to 127 and 128.
--
-- WHY. The home's reads filter the journal by `type` (a move into review, a close, a person's decision, the turns, the
-- requests between projects) and order by `seq`, and the enrolment lookup filters `payload->>'runtime_session_id'`.
-- Every read carries `estate_id` (the scoped store adds it). With no index on `type`, each was a parallel sequential scan
-- of the journal (measured on 200 000 events: `apps/desktop/test/journal-indexes-db.test.mjs`).
--
-- WHAT THIS CHANGES: two indexes, nothing else; no function, grant or projection moves.
--   * `journal_by_type`: (estate_id, type, seq desc), the newest events of one family first.
--   * `journal_enrolments_by_runtime`: the enrolments by the runtime session id they name, newest first.
--   The request transitions already have `board_transitions_by_request` (migration 108); the window start walks the
--   primary key. Schema 99 as a private-archive source (ADR-0079 decision 5): no archive shape, read as 98.

-- #region home-journal-indexes — docs: docs/evidence/plans/2026-10-27-release-1105-plan.md#landed-on-main
create index if not exists journal_by_type on journal (estate_id, type, seq desc);
create index if not exists journal_enrolments_by_runtime on journal (estate_id, (payload->>'runtime_session_id'), seq desc)
  where type = 'session.enrolled@1';
-- #endregion home-journal-indexes
