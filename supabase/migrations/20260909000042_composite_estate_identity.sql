-- A binding is not admitted merely because the uuid exists (S02).
--
-- MEASURED: eleven foreign keys in this schema, every one of them single-column
-- and pointing at the target's `id` alone. Not one asks whether the referenced
-- row is in the SAME ESTATE. So `effect_intents.grant_id` will accept a grant
-- belonging to somebody else's estate; `project_tasks.goal_id` will accept
-- another estate's goal; `task_links` will join a task across the boundary the
-- whole of S02 exists to hold.
--
-- Nothing does that today, and that is the point: the paths are closed by
-- FUNCTIONS that remember to filter — `reserve_effect`, the projector's
-- twenty-six estate predicates, the scoped store. Every one of those is a
-- caller being careful. ADR-0049: a boundary held by care holds until somebody
-- is busy, and the twelfth foreign key is written by somebody who never read
-- this file.
--
-- The composite identity is what makes the reference itself impossible. A row
-- citing a parent names the estate as well, and the database compares them.

-- ————————————————————————————————— 1 · the identities the references need
alter table projects           add constraint projects_estate_identity           unique (estate_id, id);
alter table grants             add constraint grants_estate_identity             unique (estate_id, id);
alter table grant_reservations add constraint grant_reservations_estate_identity unique (estate_id, reservation_id);
alter table project_tasks      add constraint project_tasks_estate_identity      unique (estate_id, id);
alter table goals              add constraint goals_estate_identity              unique (estate_id, id);

-- ————————————————————————————————— 2 · every cross-table reference carries its estate
--
-- `persons` and `estates` are deliberately untouched: a person is identity-plane
-- and belongs to no estate, and `memberships.estate_id -> estates` IS the estate
-- reference rather than one that needs qualifying.

alter table agent_bindings drop constraint if exists agent_bindings_project_id_fkey;
alter table agent_bindings add constraint agent_bindings_project_in_estate
  foreign key (estate_id, project_id) references projects (estate_id, id);

alter table goals drop constraint if exists goals_project_id_fkey;
alter table goals add constraint goals_project_in_estate
  foreign key (estate_id, project_id) references projects (estate_id, id);

alter table effect_intents drop constraint if exists effect_intents_grant_id_fkey;
alter table effect_intents add constraint effect_intents_grant_in_estate
  foreign key (estate_id, grant_id) references grants (estate_id, id);

alter table effect_intents drop constraint if exists effect_intents_reservation_id_fkey;
alter table effect_intents add constraint effect_intents_reservation_in_estate
  foreign key (estate_id, reservation_id) references grant_reservations (estate_id, reservation_id);

alter table grant_reservations drop constraint if exists grant_reservations_grant_id_fkey;
alter table grant_reservations add constraint grant_reservations_grant_in_estate
  foreign key (estate_id, grant_id) references grants (estate_id, id);

alter table leases drop constraint if exists leases_work_id_fkey;
alter table leases add constraint leases_work_in_estate
  foreign key (estate_id, work_id) references project_tasks (estate_id, id);

alter table project_tasks drop constraint if exists project_tasks_goal_id_fkey;
alter table project_tasks add constraint project_tasks_goal_in_estate
  foreign key (estate_id, goal_id) references goals (estate_id, id);

alter table task_links drop constraint if exists task_links_task_id_fkey;
alter table task_links add constraint task_links_task_in_estate
  foreign key (estate_id, task_id) references project_tasks (estate_id, id);

alter table task_notes drop constraint if exists task_notes_task_id_fkey;
alter table task_notes add constraint task_notes_task_in_estate
  foreign key (estate_id, task_id) references project_tasks (estate_id, id);
