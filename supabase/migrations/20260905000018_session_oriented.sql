-- Did the agent ever ask for its rules? (M123)
--
-- Fabric now launches a connecting session with a preamble telling it to call
-- `fabric_whoami` before anything else, because the rules that govern the task
-- tools live in that call and nowhere else. A preamble is an INSTRUCTION, and
-- this repository's standing rule is that an instruction is a claim until
-- something observes the result.
--
-- So the call itself is journalled, once per session. A session with no
-- `session.oriented@1` row is a session that worked without reading the rules
-- it was bound by — which is a fact about our delivery, not about the agent,
-- and the only way to find out whether the preamble does anything at all.
--
-- Not projected: there is no state to hold. The question asked of this event is
-- "did it ever happen for this session", which is a query over the journal, and
-- a projection would be a second copy of an answer the journal already gives.

insert into event_types (type, projects, note) values
  ('session.oriented@1', false, 'the session asked for its rules with fabric_whoami; absence means the preamble did not work (M123)')
on conflict (type) do nothing;
