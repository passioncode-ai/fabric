-- ADR-0134 (Fabric 0.4.0, wave 1): a coding agent Fabric did not launch enrolls into a project on the operator's
-- consent. The consent itself rides the hub's access tables (ADR-0115: callee 'fabric', capability
-- 'session.enroll', resource 'project:<uuid>' — their check constraints already admit those values), so the only
-- new fact is the enrollment: the session Fabric minted for it. Like terminal.opened@1 it projects nothing; the
-- readers of sessions read the journal.

insert into event_types (type, projects, note) values
  ('session.enrolled@1', false, 'a coding agent opened outside Fabric was admitted to one project on the operator''s standing grant and given a session; the event carries the session id, the runner, the binding and grant ids, how the folder resolved and a digest of the folder, never the folder itself');
