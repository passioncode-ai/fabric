import { describe, expect, it } from 'vitest'
import {
  checkSourceShape,
  claimLife,
  isListableRemote,
  parseLeaseRefs,
  relatedPairs,
  relatedTo,
  remoteKey,
  resolveRepository,
  rowAppears,
  sessionStale,
  touchesOverlap,
  whereWorkRows,
  type ClaimRow,
  type SourceRow,
  type WorkClaimView,
  type WorkSessionView
} from './workClaims.ts'

const claim = (over: Partial<ClaimRow>): ClaimRow => ({
  id: 'c1', work_id: 't1', owner_session: 's1', agent: 'claude-code', came_in: 'enrolled', touches: [],
  claimed_at: '2026-10-11T10:00:00.000Z', expires_at: '2026-10-11T10:30:00.000Z', renewed_at: null,
  handover_requested_by: null, handover_requested_at: null, handover_note: null, ...over
})

describe('touches overlap segment-wise, in either direction', () => {
  it('a folder overlaps what is inside it, both ways', () => {
    expect(touchesOverlap('src/auth', 'src/auth/login.ts')).toBe(true)
    expect(touchesOverlap('./src/auth/login.ts', 'src/auth/')).toBe(true)
  })
  it('a sibling that shares a prefix is not an overlap', () => {
    expect(touchesOverlap('src/auth', 'src/authors')).toBe(false)
    expect(touchesOverlap('docs/a.md', 'docs/b.md')).toBe(false)
  })
  it('a pattern overlaps through its literal folder, and a root pattern overlaps everything', () => {
    expect(touchesOverlap('src/**/*.ts', 'src/auth/login.ts')).toBe(true)
    expect(touchesOverlap('src/**/*.ts', 'docs/x.md')).toBe(false)
    expect(touchesOverlap('**/*.md', 'apps/desktop/x.ts')).toBe(true)
  })
})

describe('related work is the same row, a linked task or an overlapping touch — never your own claim', () => {
  const sources = new Map<string, SourceRow>([
    ['t1', { task_id: 't1', repository: 'o/n', repo_path: '/r', path: 'docs/backlog.md', row_id: 'CO-1' }],
    ['t2', { task_id: 't2', repository: 'o/n', repo_path: '/r', path: 'docs/backlog.md', row_id: 'CO-1' }]
  ])
  it('the same backlog row on two tasks is related', () => {
    const r = relatedTo({ taskId: 't1', owner: 's1', touches: [] }, [claim({ id: 'c2', work_id: 't2', owner_session: 's2' })], sources, [])
    expect(r).toHaveLength(1)
    expect(r[0].why).toEqual([{ kind: 'same-row', row: 'CO-1 (docs/backlog.md)' }])
  })
  it('a link in either direction is related, and says which way', () => {
    const others = [claim({ id: 'c3', work_id: 't3', owner_session: 's3' })]
    expect(relatedTo({ taskId: 't9', owner: 's1', touches: [] }, others, new Map(), [{ task_id: 't9', rel: 'blocks', target_id: 't3' }])[0].why)
      .toEqual([{ kind: 'linked', rel: 'blocks', direction: 'from' }])
    expect(relatedTo({ taskId: 't9', owner: 's1', touches: [] }, others, new Map(), [{ task_id: 't3', rel: 'follows', target_id: 't9' }])[0].why)
      .toEqual([{ kind: 'linked', rel: 'follows', direction: 'to' }])
  })
  it('overlapping touches are related; the claimant\'s own other claims are not', () => {
    const others = [claim({ id: 'c4', work_id: 't4', owner_session: 's4', touches: ['src/auth'] }), claim({ id: 'c5', work_id: 't5', owner_session: 's1', touches: ['src/auth'] })]
    const r = relatedTo({ taskId: 't9', owner: 's1', touches: ['src/auth/login.ts'] }, others, new Map(), [])
    expect(r.map((x) => x.claimId)).toEqual(['c4'])
  })
  it('unrelated work warns of nothing', () => {
    expect(relatedTo({ taskId: 't9', owner: 's1', touches: ['a'] }, [claim({ id: 'c6', work_id: 't6', owner_session: 's6', touches: ['b'] })], new Map(), [])).toEqual([])
  })
  it('both rows of a pair carry the mark', () => {
    const pairs = relatedPairs([claim({ id: 'a', work_id: 't1', owner_session: 's1' }), claim({ id: 'b', work_id: 't2', owner_session: 's2' })], sources, [])
    expect(pairs.get('a')?.map((r) => r.claimId)).toEqual(['b'])
    expect(pairs.get('b')?.map((r) => r.claimId)).toEqual(['a'])
  })
})

describe('a claim never reads "working" past its expiry or after its session ended', () => {
  const now = Date.parse('2026-10-11T10:10:00.000Z')
  it('a held session within the expiry is live', () => expect(claimLife(claim({}), now, { lastSignAt: now - 1000 }).life).toBe('live'))
  it('past its expiry it is silent, with the last sign of life', () => {
    const r = claimLife(claim({ expires_at: '2026-10-11T10:05:00.000Z' }), now, { lastSignAt: Date.parse('2026-10-11T10:02:00.000Z') })
    expect(r).toEqual({ life: 'silent', lastSignAt: '2026-10-11T10:02:00.000Z' })
  })
  it('a session Fabric no longer holds has lapsed', () => expect(claimLife(claim({}), now, null).life).toBe('lapsed'))
  it('a session is stale past its window, never before', () => {
    expect(sessionStale(now - 11 * 60_000, now - 60 * 60_000, now)).toBe(true)
    expect(sessionStale(now - 9 * 60_000, now - 60 * 60_000, now)).toBe(false)
    expect(sessionStale(null, now - 11 * 60_000, now)).toBe(true)
  })
})

describe('a backlog row is an address: a repository, a relative path, an id', () => {
  it('refuses each part by name', () => {
    expect(checkSourceShape({ repository: '', path: 'a.md', id: 'CO-1' })).toMatchObject({ ok: false, part: 'repository' })
    expect(checkSourceShape({ repository: 'o/n', path: '../etc/passwd', id: 'CO-1' })).toMatchObject({ ok: false, part: 'path' })
    expect(checkSourceShape({ repository: 'o/n', path: '/abs.md', id: 'CO-1' })).toMatchObject({ ok: false, part: 'path' })
    expect(checkSourceShape({ repository: 'o/n', path: 'a.md', id: 'CO 1' })).toMatchObject({ ok: false, part: 'id' })
    expect(checkSourceShape({ repository: 'o/n', path: './docs/a.md', id: 'CO-1' })).toEqual({ ok: true, source: { repository: 'o/n', path: 'docs/a.md', id: 'CO-1' } })
  })
  it('one repository by any of its remote spellings', () => {
    const k = 'github.com/passioncode-ai/fabric'
    for (const r of ['git@github.com:passioncode-ai/fabric.git', 'https://github.com/passioncode-ai/fabric', 'ssh://git@github.com/passioncode-ai/fabric.git', 'passioncode-ai/fabric'])
      expect(remoteKey(r)).toBe(k)
    expect(remoteKey('/Users/me/repo')).toBeNull()
  })
  it('resolves by folder or by origin, and nothing else', () => {
    const repos = [{ path: '/w/fabric', remote: 'git@github.com:passioncode-ai/fabric.git' }]
    expect(resolveRepository('https://github.com/passioncode-ai/fabric', repos)).toEqual({ path: '/w/fabric' })
    expect(resolveRepository('/w/fabric/', repos)).toEqual({ path: '/w/fabric' })
    expect(resolveRepository('passioncode-ai/other', repos)).toBeNull()
  })
  it('an id appears only as a whole token', () => {
    expect(rowAppears('| CO-256 | x |', 'CO-256')).toBe(true)
    expect(rowAppears('| CO-2560 | x |', 'CO-256')).toBe(false)
    expect(rowAppears('XCO-256', 'CO-256')).toBe(false)
  })
})

describe('agent-sync lease refs are parsed, decoded and bounded', () => {
  it('decodes keys and ignores everything that is not a lease ref', () => {
    const out = parseLeaseRefs([
      'ca5ef24199653c4b651b350ba29097c6f9e13b32\trefs/agent-sync/leases/docs%2Fadr%2F0115-x.md',
      '3905b3425038958095c01389a40c239c12e8b0d5\trefs/agent-sync/leases/CONTEXT.md',
      '69aaba0aa7a90cd802e3705e39dd03accea96ffe\trefs/agent-sync/ids/ADR',
      'garbage'
    ].join('\n'))
    expect(out.leases.map((l) => l.key)).toEqual(['docs/adr/0115-x.md', 'CONTEXT.md'])
    expect(out.truncated).toBe(false)
  })
  it('stops at its bound and says so', () => {
    const lines = Array.from({ length: 205 }, (_, i) => `${'a'.repeat(40)}\trefs/agent-sync/leases/k${i}`).join('\n')
    const out = parseLeaseRefs(lines)
    expect(out.leases).toHaveLength(200)
    expect(out.truncated).toBe(true)
  })
  it('lists only https and ssh remotes', () => {
    expect(isListableRemote('git@github.com:o/n.git')).toBe(true)
    expect(isListableRemote('https://github.com/o/n')).toBe(true)
    expect(isListableRemote('ssh://git@host/o/n')).toBe(true)
    for (const bad of ['/local/repo', 'file:///x', 'ext::sh -c id', '--upload-pack=x', 'https://h/o n'])
      expect(isListableRemote(bad), bad).toBe(false)
  })
})

describe('Where work is: rows in flight, the idle counted, the unowned always kept apart', () => {
  const s = (over: Partial<WorkSessionView>): WorkSessionView => ({ sessionId: 's', projectId: 'p1', agent: 'claude-code', cameIn: 'enrolled', startedAt: '2026-10-11T10:00:00.000Z', lastSignAt: null, stale: false, ...over })
  const c = { claimId: 'c', projectId: 'p2', taskId: 't', lastSignAt: '2026-10-11T10:05:00.000Z' } as WorkClaimView
  it('a project with a session, a claim or a review is in flight; the rest are counted', () => {
    const out = whereWorkRows({
      projects: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }, { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }],
      sessions: [s({ sessionId: 's1' }), s({ sessionId: 's9', projectId: 'gone' })],
      claims: [c],
      review: new Map([['p3', 2]])
    })
    expect(out.rows.map((r) => r.projectId).sort()).toEqual(['p1', 'p2', 'p3'])
    expect(out.idle).toBe(1)
    expect(out.unowned.map((x) => x.sessionId)).toEqual(['s9'])
  })
  it('an unread review queue is null on every row, never a zero', () => {
    const out = whereWorkRows({ projects: [{ id: 'p1', name: 'A' }], sessions: [s({})], claims: [], review: null })
    expect(out.rows[0].review).toBeNull()
  })
})
