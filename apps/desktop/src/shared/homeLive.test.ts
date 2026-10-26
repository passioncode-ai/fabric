import { describe, expect, it } from 'vitest'
import { composeHome, orderProjects, taskSummary, type StageRow, type TaskBrief } from './homeLive'
import type { WhereWorkView, WorkClaimView, WorkSessionView } from './workClaims'

const P1 = 'p1', P2 = 'p2', P3 = 'p3'
const projects = [{ id: P1, name: 'Fabric' }, { id: P2, name: 'Site' }, { id: P3, name: 'Quiet' }]
const session = (id: string, projectId: string | null, extra: Partial<WorkSessionView> = {}): WorkSessionView => ({
  sessionId: id, projectId, agent: 'claude-code', cameIn: 'launched', console: true, startedAt: '2026-10-14T08:00:00Z', lastSignAt: '2026-10-14T09:00:00Z', stale: false, ...extra
})
const claim = (taskId: string, projectId: string, sessionId: string, extra: Partial<WorkClaimView> = {}): WorkClaimView => ({
  claimId: 'c-' + taskId, projectId, taskId, title: 'raw title ' + taskId, status: 'running', source: null, sessionId, agent: 'claude-code', cameIn: 'launched',
  console: true, touches: [], since: '2026-10-14T08:30:00Z', until: '2026-10-14T10:00:00Z', lastSignAt: '2026-10-14T09:00:00Z', life: 'live' as never, related: [], ...extra
})
const where = (sessions: WorkSessionView[], claims: WorkClaimView[], unowned: WorkSessionView[] = []): WhereWorkView => ({
  rows: [P1, P2].map((id) => ({ projectId: id, name: id, sessions: sessions.filter((s) => s.projectId === id), claims: claims.filter((c) => c.projectId === id), review: 0, lastSignAt: null })),
  idle: 1, unowned, reviewError: null
} as unknown as WhereWorkView)
const stage = (sessionId: string, projectId: string, text: string, at: string, extra: Partial<StageRow> = {}): StageRow => ({
  session_id: sessionId, project_id: projectId, task_id: null, stage: text, step: null, of_steps: null, note: null, reported_at: at, ...extra
})

describe('taskSummary', () => {
  it('prefers what the agent wrote, then the title, never the instruction', () => {
    expect(taskSummary({ title: 'T', brief_what: '  Делаем версию,  где компьютер не засыпает ' })).toBe('Делаем версию, где компьютер не засыпает')
    expect(taskSummary({ title: 'Ship keep-awake', brief_what: null })).toBe('Ship keep-awake')
    expect(taskSummary({ title: null, brief_what: null }, 'claim title')).toBe('claim title')
    expect(taskSummary(undefined)).toBe('')
  })
})

describe('composeHome', () => {
  const s1 = session('s1', P1), s2 = session('s2', P2, { stale: true, lastSignAt: '2026-10-14T07:00:00Z' }), s3 = session('s3', null, { console: false })
  const c1 = claim('t1', P1, 's1')
  const view = composeHome({
    where: where([s1, s2], [c1], [s3]),
    projects,
    stages: [
      stage('s1', P1, 'old stage', '2026-10-14T08:40:00Z'),
      stage('s1', P1, 'Выкатываем версию, в которой компьютер не засыпает', '2026-10-14T08:55:00Z', { step: 3, of_steps: 5, note: 'жду CI' })
    ],
    briefs: [{ id: 't1', project_id: P1, title: 'keep-awake', brief_what: 'Компьютер не засыпает, пока работает агент', status: 'running' }],
    reviewTasks: [{ id: 't9', project_id: P2, title: 'Новая главная', brief_what: null, status: 'review', updated_at: '2026-10-14T06:00:00Z' }, { id: 't8', project_id: P2, title: 'x', brief_what: null, status: 'done' }],
    activity: new Map([[P1, '2026-10-13T10:00:00Z'], [P2, '2026-10-14T05:00:00Z'], [P3, '2026-10-01T00:00:00Z']]),
    now: '2026-10-14T09:01:00Z'
  })

  it('every session is a live agent with its newest stage in its own words, and its claimed task as a plain summary', () => {
    const a = view.live.find((l) => l.sessionId === 's1')!
    expect(a.projectName).toBe('Fabric')
    expect(a.doing).toEqual({ text: 'Выкатываем версию, в которой компьютер не засыпает', note: 'жду CI', step: 3, ofSteps: 5, at: '2026-10-14T08:55:00Z' })
    expect(a.task).toEqual({ id: 't1', projectId: P1, summary: 'Компьютер не засыпает, пока работает агент' })
    expect(view.live.find((l) => l.sessionId === 's3')!.projectId).toBeNull()
  })

  it('fresh agents lead and stale ones follow', () => {
    expect(view.live.map((l) => l.sessionId).at(-1)).toBe('s2')
  })

  it('in work carries the summary and the stage; review keeps only tasks in review', () => {
    expect(view.inWork).toHaveLength(1)
    expect(view.inWork[0]).toMatchObject({ summary: 'Компьютер не засыпает, пока работает агент', projectName: 'Fabric', doing: { step: 3 } })
    expect(view.review.map((r) => r.taskId)).toEqual(['t9'])
    expect(view.review[0].summary).toBe('Новая главная')
  })

  it("a project's now is a working agent's stage, its activity is the newest sign, and a quiet project says nothing", () => {
    const fabric = view.projects.find((p) => p.projectId === P1)!
    expect(fabric.now?.text).toBe('Выкатываем версию, в которой компьютер не засыпает')
    expect(fabric).toMatchObject({ live: 1, inWork: 1, review: 0, lastActivityAt: '2026-10-14T09:00:00Z' })
    const site = view.projects.find((p) => p.projectId === P2)!
    expect(site.now).toBeNull()
    expect(site.live).toBe(0)
    expect(site.review).toBe(1)
    expect(view.projects.find((p) => p.projectId === P3)!.lastActivityAt).toBe('2026-10-01T00:00:00Z')
  })

  it('a claim without a stage gives its task summary as the project now', () => {
    const v = composeHome({ where: where([session('s1', P1)], [claim('t1', P1, 's1')]), projects, stages: [], briefs: [{ id: 't1', project_id: P1, title: 'Import the CSV', brief_what: null, status: 'running' }], reviewTasks: [], activity: new Map(), now: 'x' })
    expect(v.projects[0].now).toMatchObject({ text: 'Import the CSV' })
  })
})

describe('composeHome — finished work (the operator\'s walk OF-18)', () => {
  it('lists the finished tasks of active projects, newest first, and says when the read stopped at its limit', () => {
    const done = [
      { id: 'd1', project_id: P1, title: 'Email sign-in', brief_what: null, status: 'done', updated_at: '2026-10-20T00:00:00Z' },
      { id: 'd2', project_id: P2, title: 'Team invites', brief_what: 'Invite people by link', status: 'done', updated_at: '2026-10-21T00:00:00Z' },
      { id: 'd3', project_id: 'gone', title: 'A removed project', brief_what: null, status: 'done', updated_at: '2026-10-22T00:00:00Z' }
    ]
    const v = composeHome({ where: where([], []), projects, stages: [], briefs: [], reviewTasks: [], doneTasks: done, limits: { done: 3 }, activity: new Map(), now: 'x' })
    expect(v.done.map((d) => d.taskId)).toEqual(['d2', 'd1'])
    expect(v.done[0]).toMatchObject({ projectName: 'Site', summary: 'Invite people by link', since: '2026-10-21T00:00:00Z' })
    expect(v.doneCapped).toBe(true)
  })
  it('is empty, not absent, when nothing is finished', () => {
    const v = composeHome({ where: where([], []), projects, stages: [], briefs: [], reviewTasks: [], activity: new Map(), now: 'x' })
    expect(v.done).toEqual([])
  })
})

describe('orderProjects', () => {
  it('favourites first in their own order, then the rest by latest activity', () => {
    const act = new Map([[P1, '2026-10-01'], [P2, '2026-10-14'], [P3, null]])
    const out = orderProjects(projects, [P3], (id) => act.get(id) ?? null).map((p) => p.id)
    expect(out).toEqual([P3, P2, P1])
  })
})

describe('composeHome — work Fabric launched itself', () => {
  it('a running task with no claim is in work, with its session\'s stage; a claimed one is not counted twice', () => {
    const s9 = session('s9', P1, { console: true })
    const v = composeHome({
      where: where([s9], [claim('t1', P1, 's9')]), projects, stages: [stage('s9', P1, 'Пишем тесты', '2026-10-14T08:59:00Z')], briefs: [],
      reviewTasks: [],
      runningTasks: [
        { id: 't7', project_id: P1, title: 'Fabric-launched', brief_what: 'Новая главная', status: 'running', updated_at: '2026-10-14T08:00:00Z', session_id: 's9' },
        { id: 't1', project_id: P1, title: 'claimed', brief_what: null, status: 'running', updated_at: '2026-10-14T08:00:00Z' }
      ],
      activity: new Map(), now: '2026-10-14T09:00:00Z'
    })
    expect(v.inWork.map((w) => w.taskId).sort()).toEqual(['t1', 't7'])
    expect(v.inWork.find((w) => w.taskId === 't7')).toMatchObject({ summary: 'Новая главная', console: true, sessionId: 's9', doing: { text: 'Пишем тесты' } })
  })
})


describe('composeHome — a stage that names its task', () => {
  const run = (sessions: WorkSessionView[]) => composeHome({
    where: where(sessions, []), projects, briefs: [], reviewTasks: [],
    stages: [stage('s5', P1, 'Выкатываем', '2026-10-14T08:50:00Z', { task_id: 't3' })],
    runningTasks: [{ id: 't3', project_id: P1, title: 'x', brief_what: null, status: 'running', updated_at: '2026-10-14T08:00:00Z' }],
    activity: new Map(), now: '2026-10-14T09:00:00Z'
  })
  it('takes the stage when the session that reported it is still held', () => {
    expect(run([session('s5', P1)]).inWork[0]).toMatchObject({ live: true, doing: { text: 'Выкатываем' } })
  })
  it("an ended session's last stage is not what anyone is doing (0.3.6 review DA-9)", () => {
    const v = run([])
    // 0.3.14: with no session and no live claim the task is abandoned, apart from «В работе».
    expect(v.inWork).toEqual([])
    expect(v.abandoned?.[0].doing).toBeNull()
    expect(v.projects.find((p) => p.projectId === P1)!.now).toBeNull()
  })
})

describe('composeHome — work nobody is doing is not current (0.3.6 review UX-2)', () => {
  it('a silent or lapsed claim is listed, not live, and never a project\'s now', () => {
    const v = composeHome({
      where: where([session('s1', P1)], [claim('t1', P1, 's1', { life: 'silent' as never })]), projects,
      stages: [stage('s1', P1, 'Старый этап', '2026-10-14T08:00:00Z')], briefs: [], reviewTasks: [], activity: new Map(), now: '2026-10-14T09:00:00Z'
    })
    expect(v.inWork[0]).toMatchObject({ live: false, doing: null })
    const fabric = v.projects.find((p) => p.projectId === P1)!
    expect(fabric.inWork).toBe(0)
    expect(fabric.now?.text).toBe('Старый этап') // the held session itself still says what it is doing
  })
  it('a read stopped at its limit is a floor', () => {
    const many = Array.from({ length: 3 }, (_, i) => ({ id: 'r' + i, project_id: P1, title: 'r', brief_what: null, status: 'review' }))
    const v = composeHome({ where: where([], []), projects, stages: [], briefs: [], reviewTasks: many, limits: { review: 3 }, activity: new Map(), now: 'x' })
    expect(v.reviewCapped).toBe(true)
  })
  it("a claimed task with neither brief nor title is not named by its instruction (0.3.6 review i3 DA-1)", () => {
    const view = where([], [claim('bare', P1, 's-bare', { title: 'Implement the importer, then run every test' })])
    const v = composeHome({ where: view, projects, stages: [], briefs: [{ id: 'bare', project_id: P1, title: null, brief_what: null, status: 'running' }], reviewTasks: [], activity: new Map(), now: 'x' })
    expect(v.inWork[0].summary).toBe('')
  })
  it('a task of a project that is not active is not on the home (0.3.6 review i2 DA-4)', () => {
    const gone = { id: 'g1', project_id: 'not-active', title: 'old', brief_what: null, status: 'review' }
    const run = { id: 'g2', project_id: 'not-active', title: 'old', brief_what: null, status: 'running' }
    const v = composeHome({ where: where([], []), projects, stages: [], briefs: [], reviewTasks: [gone], runningTasks: [run], activity: new Map(), now: 'x' })
    expect(v.review).toEqual([])
    expect(v.inWork).toEqual([])
  })
  it("a project's review count is its own, not what fell into the capped list (0.3.6 review i2 ER-2)", () => {
    const listed = [{ id: 'r0', project_id: P1, title: 'r', brief_what: null, status: 'review' }]
    const v = composeHome({ where: where([], []), projects, stages: [], briefs: [], reviewTasks: listed, limits: { review: 1 },
      reviewProjectIds: [P1, projects[1].id, projects[1].id], activity: new Map(), now: 'x' })
    expect(v.projects.find((p) => p.projectId === P1)!.review).toBe(1)
    expect(v.projects.find((p) => p.projectId === projects[1].id)!.review).toBe(2)
  })
})

describe('a claim on a task that left work (ER-3)', () => {
  it('keeps a task in review out of «В работе», so it is in one column only', async () => {
    const { composeTaskBoard } = await import('./taskBoard')
    const briefs = [
      { id: 'r1', project_id: P1, title: 'Reviewed', brief_what: null, status: 'review' },
      { id: 'w1', project_id: P1, title: 'Working', brief_what: null, status: 'running' }
    ]
    const reviewTasks = [{ id: 'r1', project_id: P1, title: 'Reviewed', brief_what: null, status: 'review', updated_at: '2026-10-23T01:00:00Z' }]
    const home = composeHome({ where: where([session('s1', P1), session('s2', P1)], [claim('r1', P1, 's1'), claim('w1', P1, 's2')]), projects, stages: [], briefs, reviewTasks, activity: new Map(), now: 'x' })
    expect(home.inWork.map((w) => w.taskId)).toEqual(['w1'])
    const board = composeTaskBoard({ home, queued: [], projects, queuedLimit: 100 })
    expect(board.columns.flatMap((c) => c.cards.map((x) => x.taskId)).filter((id) => id === 'r1')).toHaveLength(1)
  })
})

describe('«Закончили» lists finished tasks only (0.3.11 review ER-8)', () => {
  it('drops a row whose status is not done', () => {
    const doneTasks = [
      { id: 'd1', project_id: P1, title: 'Shipped', brief_what: null, status: 'done', updated_at: '2026-10-20T00:00:00Z' },
      { id: 'r1', project_id: P1, title: 'Still in review', brief_what: null, status: 'review', updated_at: '2026-10-21T00:00:00Z' }
    ]
    const v = composeHome({ where: where([], []), projects, stages: [], briefs: [], reviewTasks: [], doneTasks, activity: new Map(), now: 'x' })
    expect(v.done.map((d) => d.taskId)).toEqual(['d1'])
  })
})

describe('a claimed task back in the queue (0.3.11 review, iteration 2, ER-4)', () => {
  it('is not in «В работе»', () => {
    const briefs = [{ id: 'b1', project_id: P1, title: 'Back in the queue', brief_what: null, status: 'backlog' }]
    const home = composeHome({ where: where([session('s1', P1)], [claim('b1', P1, 's1')]), projects, stages: [], briefs, reviewTasks: [], activity: new Map(), now: 'x' })
    expect(home.inWork).toHaveLength(0)
  })
})

describe('composeHome: a task in work whose spec is not gathered (ADR-0176 §1)', () => {
  it('flags a claimed or running task whose brief lacks a part, and says nothing for a brief read without its parts', () => {
    const v = composeHome({
      where: where([session('s1', P1)], [claim('t1', P1, 's1'), claim('t2', P1, 's1')]),
      projects, stages: [],
      briefs: [
        { id: 't1', project_id: P1, title: 'Short', brief_what: 'Do it', brief_why: '', brief_expected: null, status: 'running' },
        { id: 't2', project_id: P1, title: 'Old read', brief_what: 'Do it', status: 'running' }
      ],
      reviewTasks: [],
      runningTasks: [{ id: 't3', project_id: P1, title: 'Whole', brief_what: 'a', brief_why: 'b', brief_expected: 'c', status: 'running', updated_at: '2026-10-14T08:00:00Z' }],
      activity: new Map(), now: '2026-10-14T09:00:00Z'
    })
    // t3 has no session: it is abandoned since 0.3.14, and keeps its flag there.
    const byId = new Map([...v.inWork, ...(v.abandoned ?? [])].map((w) => [w.taskId, w.specMissing]))
    expect(byId.get('t1')).toBe(true)
    expect(byId.get('t2')).toBeUndefined()
    expect(byId.get('t3')).toBe(false)
  })
})

// 0.3.14 (the operator, 2026-10-26: «какие сейчас в работе агенты и какая у него конкретно задача»): an agent's current
// task was its OLDEST live claim, missed a task Fabric launched in its session, dropped an untitled task and ignored
// the task its stage report names.
describe("composeHome: an agent's current task (0.3.14)", () => {
  const base = { projects, reviewTasks: [], activity: new Map<string, string | null>(), now: '2026-10-26T12:00:00Z' }
  it('is its newest live claim whose task is still running', () => {
    const v = composeHome({
      ...base,
      where: where([session('s1', P1)], [
        claim('old', P1, 's1', { since: '2026-10-26T08:00:00Z' }),
        claim('new', P1, 's1', { since: '2026-10-26T10:00:00Z' }),
        claim('moved', P1, 's1', { since: '2026-10-26T11:00:00Z' }),
        claim('silent', P1, 's1', { since: '2026-10-26T11:30:00Z', life: 'silent' as never })
      ]),
      stages: [],
      briefs: [
        { id: 'old', project_id: P1, title: 'Old', brief_what: null, status: 'running' },
        { id: 'new', project_id: P1, title: 'New', brief_what: null, status: 'running' },
        { id: 'moved', project_id: P1, title: 'Moved', brief_what: null, status: 'review' },
        { id: 'silent', project_id: P1, title: 'Silent', brief_what: null, status: 'running' }
      ]
    })
    expect(v.live[0].task).toEqual({ id: 'new', projectId: P1, summary: 'New' })
  })

  it('else the running task Fabric launched in its session', () => {
    const v = composeHome({
      ...base, where: where([session('s1', P1)], []), stages: [], briefs: [],
      runningTasks: [{ id: 'l1', project_id: P1, title: 'Launched', brief_what: null, status: 'running', session_id: 's1', updated_at: '2026-10-26T09:00:00Z' }]
    })
    expect(v.live[0].task).toEqual({ id: 'l1', projectId: P1, summary: 'Launched' })
    expect(v.inWork.map((w) => [w.taskId, w.sessionId])).toEqual([['l1', 's1']])
    expect(v.projects.find((p) => p.projectId === P1)).toMatchObject({ live: 1, inWork: 1 })
  })

  it('else the task its newest stage report names, in that report\'s project', () => {
    const v = composeHome({
      ...base, where: where([session('s1', P1)], []), briefs: [],
      stages: [
        stage('s1', P2, 'Older step', '2026-10-26T09:00:00Z', { task_id: 'x-old' }),
        stage('s1', P2, 'Building the board', '2026-10-26T10:00:00Z', { task_id: 'x1' }),
        stage('s1', P1, 'Reading', '2026-10-26T11:00:00Z')
      ]
    })
    expect(v.live[0].task).toEqual({ id: 'x1', projectId: P2, summary: '' })
  })

  it('keeps an untitled claimed task, with an empty summary the screens say as untitled', () => {
    const v = composeHome({ ...base, where: where([session('s1', P1)], [claim('u1', P1, 's1', { title: '' })]), stages: [], briefs: [{ id: 'u1', project_id: P1, title: null, brief_what: null, status: 'running' }] })
    expect(v.live[0].task).toEqual({ id: 'u1', projectId: P1, summary: '' })
  })
})

// 0.3.14: «В работе» kept dead work (claims nobody signs, running tasks whose session is gone). Work with no live claim
// and no live session is «Брошено», apart, and counted in neither the home's «В работе» nor the board's.
describe('composeHome: abandoned work is apart from «В работе» (0.3.14)', () => {
  const base = { projects, stages: [], reviewTasks: [], activity: new Map<string, string | null>(), now: '2026-10-26T12:00:00Z' }
  const brief = (id: string) => ({ id, project_id: P1, title: 'T ' + id, brief_what: null, status: 'running' })
  it('a claim whose session ended, or a running task with no live session, is abandoned; a silent claim of a live session stays', () => {
    const v = composeHome({
      ...base,
      where: where([session('s1', P1), session('s2', P1, { stale: true })], [
        claim('gone', P1, 's9', { life: 'lapsed' as never }),
        claim('quiet', P1, 's1', { life: 'silent' as never }),
        claim('working', P1, 's1')
      ]),
      briefs: [brief('gone'), brief('quiet'), brief('working')],
      runningTasks: [
        { ...brief('orphan'), updated_at: '2026-10-26T09:00:00Z' },
        { ...brief('staleRun'), session_id: 's2', updated_at: '2026-10-26T09:00:00Z' },
        { ...brief('liveRun'), session_id: 's1', updated_at: '2026-10-26T09:00:00Z' }
      ]
    })
    expect(v.inWork.map((w) => w.taskId).sort()).toEqual(['liveRun', 'quiet', 'working'])
    expect(v.abandoned?.map((w) => w.taskId).sort()).toEqual(['gone', 'orphan', 'staleRun'])
    expect(v.projects.find((p) => p.projectId === P1)!.inWork).toBe(2)
  })
  it('says no abandoned work as an empty list', () => {
    expect(composeHome({ ...base, where: where([], []), briefs: [] }).abandoned).toEqual([])
  })
})
