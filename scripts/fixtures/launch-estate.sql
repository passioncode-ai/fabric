-- The launch demo estate (SCR-30…SCR-41 · docs/reports/product.html, "демонстрационные данные").
--
-- The launch design shows four projects, an open board and 28 days of work. A fresh estate
-- shows every screen in its empty state, so the design can be compared with the app — and
-- the app photographed for the site — only against an estate that holds what the design
-- holds. This is that estate, and nothing else: its own fixed id, never the operator's.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 [-v estate=<uuid>] [-v lang=en] -f scripts/fixtures/launch-estate.sql
--
-- The estate id defaults to 00000000-0000-0000-0000-00000000de30; every other id is derived
-- from it, so a second estate (fresh dates, the same story) is one `-v estate=` away.
--
-- BACKDATED, AND SAID SO. A rhythm of 28 days needs events on 28 days, and `append_event`
-- stamps `now()`. So `demo_append` below is `append_event` with one difference: the caller
-- names `occurred_at`. The row goes through the SAME projector (`apply_projections`) under the
-- SAME per-estate lock and sequence, so every projection agrees with the journal it came from.
-- It exists only inside this file and is dropped at the end; nothing else may write a past.
--
-- IDEMPOTENT: the whole estate is skipped when it already exists. To refresh the dates, create
-- it under a new id rather than deleting one — the journal is append-only.

\if :{?estate}
\else
  \set estate '00000000-0000-0000-0000-00000000de30'
\endif
select set_config('launch_fixture.estate', :'estate', false);
-- The story's language: `-v lang=en` tells it in English (the public site's screenshots); Russian otherwise.
\if :{?lang}
\else
  \set lang 'ru'
\endif
select set_config('launch_fixture.lang', :'lang', false);

create or replace function demo_text(p_ru text, p_en text) returns text
language sql stable as $fn$ select case current_setting('launch_fixture.lang') when 'en' then p_en else p_ru end $fn$;

create or replace function demo_append(
  p_estate uuid, p_type text, p_actor jsonb, p_payload jsonb, p_project uuid, p_at timestamptz
) returns void
language plpgsql
as $fn$
declare
  v_seq bigint;
  v_event journal;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_estate::text, 4242));
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, payload, occurred_at)
  values (p_estate, v_seq, p_type, '1', p_actor, p_project, p_payload, p_at)
  returning * into v_event;
  perform apply_projections(v_event);
end $fn$;

do $$
declare
  est      constant uuid := current_setting('launch_fixture.estate')::uuid;
  operator constant jsonb := jsonb_build_object('kind', 'person', 'id', '00000000-0000-0000-0000-00000000000a');
  claude   constant jsonb := jsonb_build_object('kind', 'agent', 'id', 'demo-claude-code');
  codex    constant jsonb := jsonb_build_object('kind', 'agent', 'id', 'demo-codex');
  atlas    constant uuid := md5(current_setting('launch_fixture.estate') || 'atlas')::uuid;
  studio   constant uuid := md5(current_setting('launch_fixture.estate') || 'studio')::uuid;
  signal   constant uuid := md5(current_setting('launch_fixture.estate') || 'signal')::uuid;
  orbit    constant uuid := md5(current_setting('launch_fixture.estate') || 'orbit')::uuid;
  today    constant timestamptz := date_trunc('day', now());
  projects uuid[];
  titles text[] := array[demo_text('Собрать пакет контекста для запуска', 'Assemble the context pack for a run'), demo_text('Описать сценарий приглашения', 'Describe the invitation scenario'),
    demo_text('Сверить права доступа команды', 'Reconcile the team access rights'), demo_text('Проверить дайджест на трёх читателях', 'Try the digest on three readers'), demo_text('Повторная доставка событий', 'Event redelivery'),
    demo_text('Разобрать отзывы пилота', 'Go through the pilot feedback'), demo_text('Уточнить цель недели', 'Clarify the goal of the week'), demo_text('Подготовить заметку о решении', 'Prepare a note on the decision')];
  d int; p uuid; t uuid; q uuid; at timestamptz; agent jsonb;
begin
  projects := array[atlas, studio, atlas, signal, orbit];
  if exists (select 1 from estates where id = est) then
    raise notice 'launch demo estate already exists; nothing appended';
    return;
  end if;
  perform demo_append(est, 'estate.created@1', jsonb_build_object('kind', 'system', 'id', 'launch-fixture'),
    jsonb_build_object('name', demo_text('Моё пространство', 'My space'), 'owner_person_id', '00000000-0000-0000-0000-00000000000a'),
    null, today - interval '27 days' + interval '8 hours');

  perform demo_append(est, 'project.created@1', operator, jsonb_build_object('id', atlas, 'name', 'Atlas',
    'purpose', demo_text('Запустить командный доступ без потери контекста', 'Launch team access without losing context')), atlas, today - interval '27 days' + interval '9 hours');
  perform demo_append(est, 'project.created@1', operator, jsonb_build_object('id', studio, 'name', 'Studio',
    'purpose', demo_text('Проверить спрос на новую услугу', 'Test demand for a new service')), studio, today - interval '27 days' + interval '9 hours 10 minutes');
  perform demo_append(est, 'project.created@1', operator, jsonb_build_object('id', signal, 'name', 'Signal',
    'purpose', demo_text('Проверить гипотезу еженедельного дайджеста', 'Test the weekly digest hypothesis')), signal, today - interval '27 days' + interval '9 hours 20 minutes');
  perform demo_append(est, 'project.created@1', operator, jsonb_build_object('id', orbit, 'name', 'Orbit',
    'purpose', demo_text('Надёжная доставка событий API', 'Reliable API event delivery')), orbit, today - interval '27 days' + interval '9 hours 30 minutes');

  -- 28 days of ordinary work: most days a task is filed and taken by an agent; every third day
  -- one finishes; every fourth a decision is asked and answered. Two quiet days on purpose,
  -- because a rhythm without gaps is not a rhythm anyone has.
  for d in reverse 26..1 loop
    continue when d in (9, 16);
    p := projects[1 + (d % array_length(projects, 1))];
    agent := case when d % 2 = 0 then claude else codex end;
    at := today - make_interval(days => d) + interval '10 hours';
    t := md5(est || 'task' || d)::uuid;
    perform demo_append(est, 'task.created@1', operator, jsonb_build_object('id', t, 'project_id', p,
      'title', titles[1 + (d % array_length(titles, 1))], 'instruction', demo_text('Демонстрационная задача.', 'A demo task.')), p, at);
    perform demo_append(est, 'task.moved@1', agent, jsonb_build_object('task_id', t, 'project_id', p, 'to', 'running'),
      p, at + interval '20 minutes');
    if d % 4 = 0 then
      q := md5(est || 'q' || d)::uuid;
      perform demo_append(est, 'question.asked@1', agent, jsonb_build_object('id', q, 'project_id', p, 'kind', 'decision',
        'text', demo_text('Какой вариант берём для «', 'Which option do we take for “') || titles[1 + (d % array_length(titles, 1))] || demo_text('»?', '”?'),
        'options', jsonb_build_array(jsonb_build_object('id', 'a', 'label', demo_text('Первый', 'The first')), jsonb_build_object('id', 'b', 'label', demo_text('Второй', 'The second')))),
        p, at + interval '1 hour');
      perform demo_append(est, 'question.answered@1', operator, jsonb_build_object('id', q, 'answer', demo_text('Берём первый.', 'We take the first.'),
        'chosen_option', 'a', 'answered_by_kind', 'person'), p, at + interval '2 hours');
    end if;
    if d % 3 = 0 then
      perform demo_append(est, 'task.moved@1', agent, jsonb_build_object('task_id', t, 'project_id', p, 'to', 'review'),
        p, at + interval '3 hours');
      perform demo_append(est, 'task.moved@1', operator, jsonb_build_object('task_id', t, 'project_id', p, 'to', 'done'),
        p, at + interval '5 hours');
    end if;
    -- Releases with their basis (ADR-0084), as the launch design draws them: Atlas 0.4.1 not
    -- accepted and rolled back by a new record, 0.4.2 verified, 0.4.3 a candidate; Studio 0.2.1
    -- verified. Decisions are project memory of kind `decision`; the tasks are this loop's own.
    if d = 12 then
      perform demo_append(est, 'memory.project.recorded@1', operator, jsonb_build_object('id', md5(est || 'decision-history')::uuid,
        'claim', demo_text('История работы принадлежит проекту, а не сессии агента.', 'The history of the work belongs to the project, not to an agent session.'), 'kind', 'decision', 'source_ref', 'demo'),
        atlas, at + interval '6 hours');
      perform demo_append(est, 'release.recorded@1', operator, jsonb_build_object('id', md5(est || 'release-atlas-041')::uuid,
        'name', 'Atlas 0.4.1', 'environment', demo_text('Demo / локальная среда', 'Demo / local environment'), 'summary', demo_text('Пробная сборка таймлайна: истории сессий объединены.', 'Trial timeline build: session histories merged.'),
        'task_ids', jsonb_build_array(md5(est || 'task15')::uuid), 'decision_ids', jsonb_build_array(md5(est || 'decision-history')::uuid),
        'rolls_back', null, 'command_id', md5(est || 'cmd-release-atlas-041')::uuid), atlas, at + interval '7 hours');
      perform demo_append(est, 'release.verified@1', operator, jsonb_build_object('id', md5(est || 'release-atlas-041')::uuid,
        'outcome', 'failed', 'receipt', demo_text('Возврат показал пакет другого запуска.', 'The return showed the pack of another run.')), atlas, at + interval '8 hours');
    end if;
    if d = 11 then
      perform demo_append(est, 'release.recorded@1', operator, jsonb_build_object('id', md5(est || 'release-studio-021')::uuid,
        'name', 'Studio 0.2.1', 'environment', demo_text('Demo / локальная среда', 'Demo / local environment'), 'summary', demo_text('Подготовлена проверка новой коллекции.', 'A check of the new collection is ready.'),
        'task_ids', jsonb_build_array(md5(est || 'task21')::uuid), 'decision_ids', '[]'::jsonb,
        'rolls_back', null, 'command_id', md5(est || 'cmd-release-studio-021')::uuid), studio, at + interval '7 hours');
      perform demo_append(est, 'release.verified@1', operator, jsonb_build_object('id', md5(est || 'release-studio-021')::uuid,
        'outcome', 'accepted', 'receipt', demo_text('Проверка коллекции принята в демонстрационной среде.', 'Collection check accepted in the demo environment.')), studio, at + interval '8 hours');
    end if;
    if d = 10 then
      perform demo_append(est, 'release.recorded@1', operator, jsonb_build_object('id', md5(est || 'release-atlas-040r')::uuid,
        'name', demo_text('Atlas 0.4.0 · возврат', 'Atlas 0.4.0 · rollback'), 'environment', demo_text('Demo / локальная среда', 'Demo / local environment'), 'summary', demo_text('Пробная сборка таймлайна заменена предыдущей.', 'The trial timeline build was replaced by the previous one.'),
        'task_ids', '[]'::jsonb, 'decision_ids', '[]'::jsonb,
        'rolls_back', md5(est || 'release-atlas-041')::uuid, 'command_id', md5(est || 'cmd-release-atlas-040r')::uuid), atlas, at + interval '7 hours');
      perform demo_append(est, 'release.verified@1', operator, jsonb_build_object('id', md5(est || 'release-atlas-040r')::uuid,
        'outcome', 'accepted', 'receipt', demo_text('Прежняя сборка работает: история сессий читается.', 'The previous build works: session history reads back.')), atlas, at + interval '8 hours');
    end if;
    if d = 5 then
      perform demo_append(est, 'memory.project.recorded@1', operator, jsonb_build_object('id', md5(est || 'decision-pack')::uuid,
        'claim', demo_text('Пакет возвращения собирается из решений и их источников.', 'The return pack is built from decisions and their sources.'), 'kind', 'decision', 'source_ref', 'demo'),
        atlas, at + interval '6 hours');
      perform demo_append(est, 'release.recorded@1', operator, jsonb_build_object('id', md5(est || 'release-atlas-042')::uuid,
        'name', 'Atlas 0.4.2', 'environment', demo_text('Demo / локальная среда', 'Demo / local environment'), 'summary', demo_text('История сохраняется при смене сессии.', 'History survives a change of session.'),
        'task_ids', jsonb_build_array(md5(est || 'task12')::uuid, md5(est || 'task15')::uuid),
        'decision_ids', jsonb_build_array(md5(est || 'decision-history')::uuid, md5(est || 'decision-pack')::uuid),
        'rolls_back', null, 'command_id', md5(est || 'cmd-release-atlas-042')::uuid), atlas, at + interval '7 hours');
      perform demo_append(est, 'release.verified@1', operator, jsonb_build_object('id', md5(est || 'release-atlas-042')::uuid,
        'outcome', 'accepted', 'receipt', demo_text('Проверка возврата принята оператором в демонстрационной среде; относится к этой среде и сборке.', 'Return check accepted by the operator in the demo environment; it applies to this environment and build.')),
        atlas, at + interval '8 hours');
    end if;
    if d = 2 then
      perform demo_append(est, 'release.recorded@1', operator, jsonb_build_object('id', md5(est || 'release-atlas-043')::uuid,
        'name', 'Atlas 0.4.3', 'environment', demo_text('Ещё не опубликован', 'Not yet published'), 'summary', demo_text('Пакет возвращения: чтение истории и причины решений.', 'Return pack: reading history and the reasons for decisions.'),
        'task_ids', '[]'::jsonb, 'decision_ids', jsonb_build_array(md5(est || 'decision-pack')::uuid),
        'rolls_back', null, 'command_id', md5(est || 'cmd-release-atlas-043')::uuid), atlas, at + interval '7 hours');
    end if;
    if d = 3 then
      -- Three days ago: a question set aside for next time (SCR-41 «На следующий раз»); it stays open.
      perform demo_append(est, 'question.asked@1', codex, jsonb_build_object('id', md5(est || 'topic4')::uuid,
        'project_id', signal, 'kind', 'decision', 'text', demo_text('Нужна ли проверка уже отозванных приглашений?', 'Do revoked invitations need a check too?'),
        'options', jsonb_build_array(jsonb_build_object('id', 'yes', 'label', demo_text('Нужна', 'Yes')), jsonb_build_object('id', 'no', 'label', demo_text('Не нужна', 'No')))),
        signal, at + interval '5 hours');
      perform demo_append(est, 'question.deferred@1', operator, jsonb_build_object('id', md5(est || 'topic4')::uuid,
        'reason', demo_text('Вернёмся после пилота: сначала посмотрим, сколько приглашений отзывают.', 'Back to it after the pilot: first see how many invitations get revoked.')),
        signal, at + interval '6 hours');
    end if;
  end loop;

  -- Yesterday: one topic still open.
  perform demo_append(est, 'question.asked@1', claude, jsonb_build_object('id', md5(est || 'topic3')::uuid,
    'project_id', studio, 'kind', 'fact', 'text', demo_text('Сверить прежнего владельца услуги перед пилотом', 'Confirm the previous owner of the service before the pilot'),
    'options', jsonb_build_array(jsonb_build_object('id', 'ok', 'label', demo_text('Сверено', 'Reconciled')))),
    studio, today - interval '1 day' + interval '17 hours');

  -- Today, as the design shows it, appended in the order it happened: a question at 3h30 ago,
  -- a result handed over, work started, and the question an agent stopped on.
  perform demo_append(est, 'question.asked@1', codex, jsonb_build_object('id', md5(est || 'topic2')::uuid,
    'project_id', atlas, 'kind', 'access', 'text', demo_text('Разрешить проверку приглашения на staging?', 'Allow the invitation check on staging?'),
    'options', jsonb_build_array(jsonb_build_object('id', 'yes', 'label', demo_text('Разрешить', 'Allow')), jsonb_build_object('id', 'no', 'label', demo_text('Пока нет', 'Not yet')))),
    atlas, now() - interval '3 hours 30 minutes');
  perform demo_append(est, 'task.created@1', operator, jsonb_build_object('id', md5(est || 'task-today-2')::uuid, 'project_id', atlas,
    'title', demo_text('Исследовать два прошлых запуска', 'Investigate two past runs'), 'instruction', demo_text('Демонстрационная задача.', 'A demo task.')), atlas, now() - interval '3 hours');
  perform demo_append(est, 'task.moved@1', codex, jsonb_build_object('task_id', md5(est || 'task-today-2')::uuid, 'project_id', atlas, 'to', 'running'),
    atlas, now() - interval '150 minutes');
  perform demo_append(est, 'task.created@1', operator, jsonb_build_object('id', md5(est || 'task-today')::uuid, 'project_id', atlas,
    'title', demo_text('Собрать пакет контекста для Claude Code', 'Assemble the context pack for Claude Code'), 'instruction', demo_text('Демонстрационная задача.', 'A demo task.')), atlas, now() - interval '90 minutes');
  perform demo_append(est, 'task.moved@1', claude, jsonb_build_object('task_id', md5(est || 'task-today')::uuid, 'project_id', atlas, 'to', 'running'),
    atlas, now() - interval '80 minutes');
  perform demo_append(est, 'task.moved@1', codex, jsonb_build_object('task_id', md5(est || 'task-today-2')::uuid, 'project_id', atlas, 'to', 'review'),
    atlas, now() - interval '65 minutes');
  perform demo_append(est, 'question.asked@1', claude, jsonb_build_object('id', md5(est || 'topic1')::uuid,
    'project_id', atlas, 'kind', 'decision', 'text', demo_text('Какой контекст передавать следующему агенту?', 'What context should the next agent get?'),
    'why_blocked', demo_text('Агент остановился перед выбором состава контекста.', 'The agent stopped before choosing what the context should contain.'),
    'options', jsonb_build_array(jsonb_build_object('id', 'full', 'label', demo_text('Полный пакет', 'The full pack')), jsonb_build_object('id', 'lean', 'label', demo_text('Только решения', 'Decisions only')))),
    atlas, now() - interval '50 minutes');
end $$;

drop function demo_append(uuid, text, jsonb, jsonb, uuid, timestamptz);
drop function demo_text(text, text);

-- The receipt: what this estate holds, counted from its own rows.
select 'launch-fixture' as what,
       (select count(*) from projects where estate_id = current_setting('launch_fixture.estate')::uuid) as projects,
       (select count(*) from questions where estate_id = current_setting('launch_fixture.estate')::uuid and status = 'open') as open_questions,
       (select count(*) from question_deferrals where estate_id = current_setting('launch_fixture.estate')::uuid) as set_aside,
       (select count(*) from releases where estate_id = current_setting('launch_fixture.estate')::uuid) as releases,
       (select count(*) from journal where estate_id = current_setting('launch_fixture.estate')::uuid) as events,
       (select count(distinct occurred_at::date) from journal where estate_id = current_setting('launch_fixture.estate')::uuid) as days,
       -- Must be 0: a backdated event out of sequence would give the journal a history it cannot have.
       (select count(*) from (select occurred_at < lag(occurred_at) over (order by seq) as back
          from journal where estate_id = current_setting('launch_fixture.estate')::uuid) x where back) as backwards_steps;
