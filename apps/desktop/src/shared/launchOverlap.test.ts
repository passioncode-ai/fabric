import { describe, expect, it } from 'vitest'
import { inferTouches, launchOverlap, type LaunchClaim } from './launchOverlap'

const claim = (over: Partial<LaunchClaim>): LaunchClaim => ({
  id: 'c1', work_id: 't-other', owner_session: 's-other', agent: 'claude-code', came_in: 'enrolled', touches: [],
  claimed_at: '2026-11-06T10:00:00Z', expires_at: '2026-11-06T11:00:00Z', renewed_at: null,
  handover_requested_by: null, handover_requested_at: null, handover_note: null,
  task: { id: 't-other', title: 'Fix the login' }, life: 'live', ...over
})

describe('inferTouches (CO-522 wave A)', () => {
  it('takes the repository paths a task names, and leaves words, links and absolute paths alone', () => {
    expect(inferTouches('Fix `apps/desktop/src/main/hub.ts` and docs/launch/release-mac.md; see https://x.io/a/b and /etc/hosts.'))
      .toEqual(['apps/desktop/src/main/hub.ts', 'docs/launch/release-mac.md'])
    expect(inferTouches('Make the login faster')).toEqual([])
    expect(inferTouches('src/auth/ then src/auth/login.ts, src/auth/')).toEqual(['src/auth', 'src/auth/login.ts'])
  })
})

describe('launchOverlap (CO-522 wave A)', () => {
  it('names a live claim whose touches overlap what the task names', () => {
    const r = launchOverlap({ taskId: null, text: 'Change apps/desktop/src/main/hub.ts' },
      [claim({ touches: ['apps/desktop/src/main'] })], new Map(), [])
    expect(r.overlaps).toHaveLength(1)
    expect(r.overlaps[0]!.why).toEqual([{ kind: 'overlap', mine: 'apps/desktop/src/main/hub.ts', theirs: 'apps/desktop/src/main' }])
    expect(r.alsoWorking).toEqual([])
  })

  it('names the session already holding the same task as an overlap', () => {
    const r = launchOverlap({ taskId: 't-other', text: 'x' }, [claim({})], new Map(), [])
    expect(r.overlaps[0]!.why).toEqual([{ kind: 'same-task' }])
  })

  it('a live claim with nothing in common is listed as also working in the project; a lapsed one is not', () => {
    const r = launchOverlap({ taskId: null, text: 'Make the login faster' },
      [claim({}), claim({ id: 'c2', owner_session: 's-gone', life: 'lapsed' })], new Map(), [])
    expect(r.overlaps).toEqual([])
    expect(r.alsoWorking.map((c) => c.claimId)).toEqual(['c1'])
  })

  it('the same backlog row and a task link count, as relatedTo counts them', () => {
    const row = { repository: 'r', repo_path: '/r', path: 'BACKLOG.md', row_id: 'B-1' }
    const sources = new Map([['t-mine', { task_id: 't-mine', ...row }], ['t-other', { task_id: 't-other', ...row }]])
    const r = launchOverlap({ taskId: 't-mine', text: '' }, [claim({})], sources, [{ task_id: 't-mine', rel: 'blocks', target_id: 't-other' }])
    expect(r.overlaps[0]!.why.map((w) => w.kind).sort()).toEqual(['linked', 'same-row'])
  })
})
