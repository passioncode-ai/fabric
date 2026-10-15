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
    expect(a.task).toEqual({ id: 't1', summary: 'Компьютер не засыпает, пока работает агент' })
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
    const v = composeHome({ where: where([session('s1', P1)], [claim('t1', P1, 's1')]), projects, stages: [], briefs: [], reviewTasks: [], activity: new Map(), now: 'x' })
    expect(v.projects[0].now).toMatchObject({ text: 'raw title t1' })
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
    expect(v.inWork[0].doing).toBeNull()
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
