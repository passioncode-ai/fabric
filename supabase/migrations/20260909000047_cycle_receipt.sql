-- A cycle leaves a receipt, including when it did nothing (S15, ADR-0037).
--
-- MEASURED: the tick is a `setInterval` calling two producers, and it recorded
-- NOTHING about itself. `routine.ran@1` says a routine ran; no event says a
-- cycle happened. So "did the tick run at 14:00" had no answer — and after the
-- app had been closed, nothing in the estate distinguished "nothing was due"
-- from "nobody was watching".
--
-- ADR-0037 says plainly that Fabric has no always-on process. Without this row
-- the product says it by OMISSION, and an empty feed reads as a promise kept.
--
-- THE EMPTY CYCLE IS THE POINT. A receipt only when work happened would leave
-- the same hole: the silence of a healthy idle estate and the silence of a
-- closed laptop would still look identical.

insert into event_types (type, projects, note) values
  ('cycle.ran@1', false,
   'one pass of the periodic cycle, recorded even when it did nothing — the row that tells a quiet estate apart from an absent one')
on conflict (type) do nothing;
