// SCR-31 «Who is working on what» and SCR-78 «Where work is» (SCN-140, SCN-141): silent until read, a reading's
// "nobody" only from a read list, «related» on both rows of a pair, never "working" past an expiry, the release
// asked before it is made, the unowned row always there.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { WhoIsWorking } from './WhoIsWorking'
import { WhereWorkScreen } from './launch/WhereWorkScreen'
import type { ProjectWorkView, WhereWorkView, WorkClaimView } from '../../shared/workClaims'

const claim = (over: Partial<WorkClaimView>): WorkClaimView => ({
  claimId: 'c1', projectId: 'p1', taskId: 't1', title: 'Login form', status: 'running', source: { repository: 'o/n', path: 'docs/backlog.md', id: 'CO-901' },
  sessionId: 's1', agent: 'claude-code', cameIn: 'enrolled', touches: ['src/auth'], since: new Date().toISOString(),
  until: new Date(Date.now() + 600_000).toISOString(), lastSignAt: new Date().toISOString(), life: 'live', related: [], ...over
})
const view = (over: Partial<ProjectWorkView> = {}): ProjectWorkView => ({ claims: [], held: [], sessions: [], leases: null, readAt: new Date().toISOString(), ...over })

function stub(fabric: Record<string, unknown>) {
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric }))
}
const show = (ui: React.ReactNode) => render(<I18nProvider locale="en">{ui}</I18nProvider>)

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Who is working on what', () => {
  it('says nothing about nobody before it has read, then says nobody from the reading', async () => {
    let answer: (v: ProjectWorkView) => void = () => {}
    stub({ work: { project: vi.fn(() => new Promise<ProjectWorkView>((r) => { answer = r })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    expect(screen.getByText(en['work.who.reading'])).toBeTruthy()
    expect(screen.queryByText(en['work.who.none'])).toBeNull()
    answer(view())
    await waitFor(() => expect(screen.getByText(en['work.who.none'])).toBeTruthy())
  })

  it('an unreadable list is the reason with Try again, never "nobody"', async () => {
    stub({ work: { project: vi.fn(async () => { throw new Error('db down') }) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Could not read who is working here/)).toBeTruthy())
    expect(screen.getByRole('button', { name: en['common.retry'] })).toBeTruthy()
    expect(screen.queryByText(en['work.who.none'])).toBeNull()
  })

  it('both rows of a related pair carry «related»; a lapsed claim never reads as working', async () => {
    const a = claim({ claimId: 'a', related: [{ claimId: 'b', taskId: 't2', title: 'Auth rewrite', why: [{ kind: 'overlap', mine: 'src/auth', theirs: 'src/auth/login.ts' }] }] })
    const b = claim({ claimId: 'b', taskId: 't2', title: 'Auth rewrite', life: 'lapsed', related: [{ claimId: 'a', taskId: 't1', title: 'Login form', why: [{ kind: 'overlap', mine: 'src/auth/login.ts', theirs: 'src/auth' }] }] })
    stub({ work: { project: vi.fn(async () => view({ claims: [a, b] })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await waitFor(() => expect(screen.getAllByText(en['work.who.related'])).toHaveLength(2))
    expect(screen.getByText(en['work.who.lapsed'])).toBeTruthy()
    expect(screen.getAllByText(/backlog row CO-901 in docs\/backlog\.md/)).toHaveLength(2)
  })

  it('Release… asks first, names the agent and the task, and Cancel releases nothing', async () => {
    const release = vi.fn(async () => ({ released: true, claimId: 'c1' }))
    stub({ work: { project: vi.fn(async () => view({ claims: [claim({})] })), release } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await waitFor(() => screen.getByRole('button', { name: en['work.who.more'] }))
    fireEvent.click(screen.getByRole('button', { name: en['work.who.more'] }))
    fireEvent.click(screen.getByRole('button', { name: en['work.who.release'] }))
    expect(screen.getByText(en['work.release.title'])).toBeTruthy()
    expect(screen.getByText(/Claude Code stops holding Login form now/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['common.cancel'] }))
    expect(release).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en['work.who.more'] }))
    fireEvent.click(screen.getByRole('button', { name: en['work.who.release'] }))
    fireEvent.click(screen.getByRole('button', { name: en['work.release.confirm'] }))
    await waitFor(() => expect(release).toHaveBeenCalledWith('c1'))
  })

  it("agent-sync's leases are listed read-only, and an unread list says why", async () => {
    stub({ work: { project: vi.fn(async () => view({ leases: { read: false, reason: 'no answer within 8 s' } })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await waitFor(() => expect(screen.getByText(/agent-sync leases could not be read: no answer within 8 s/)).toBeTruthy())
  })
})

describe('Where work is', () => {
  const where = (over: Partial<WhereWorkView> = {}): WhereWorkView => ({ rows: [], idle: 0, unowned: [], reviewUnread: null, readAt: new Date().toISOString(), ...over })
  const screenWith = () => <WhereWorkScreen feedMark={0} onProject={() => {}} onTask={() => {}} onReview={() => {}} />

  it('nothing in flight still shows the last row, «Sessions with no project», with "none"', async () => {
    stub({ work: { estate: vi.fn(async () => where({ idle: 3 })) } })
    show(screenWith())
    await waitFor(() => expect(screen.getByText(en['work.where.nothing'])).toBeTruthy())
    expect(screen.getByText(en['work.where.unowned'])).toBeTruthy()
    expect(screen.getByText(/3 more projects with nothing in flight/)).toBeTruthy()
  })

  it('an unread estate is the reason with Try again, never "no work"', async () => {
    stub({ work: { estate: vi.fn(async () => { throw new Error('offline') }) } })
    show(screenWith())
    await waitFor(() => expect(screen.getByText(/Could not read where work is/)).toBeTruthy())
    expect(screen.queryByText(en['work.where.nothing'])).toBeNull()
  })

  it('a quiet session reads its silence, an unread review queue says so, and a claim opens its task', async () => {
    const onTask = vi.fn()
    const stale = { sessionId: 's1', projectId: 'p1', agent: 'codex', cameIn: 'enrolled' as const, startedAt: new Date(Date.now() - 3600_000).toISOString(), lastSignAt: new Date(Date.now() - 25 * 60_000).toISOString(), stale: true }
    stub({ work: { estate: vi.fn(async () => where({ rows: [{ projectId: 'p1', name: 'Atlas', sessions: [stale], claims: [claim({})], review: null, lastSignAt: new Date().toISOString() }], reviewUnread: 'x' })) } })
    show(<WhereWorkScreen feedMark={0} onProject={() => {}} onTask={onTask} onReview={() => {}} />)
    await waitFor(() => expect(screen.getByText(/no sign for 25 min/)).toBeTruthy())
    expect(screen.getByText(en['work.where.reviewUnread'])).toBeTruthy()
    fireEvent.click(screen.getByText('Login form'))
    expect(onTask).toHaveBeenCalledWith('p1', 't1')
  })
})
