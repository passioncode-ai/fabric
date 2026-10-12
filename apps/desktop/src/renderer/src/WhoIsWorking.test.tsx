// SCR-31 «Who is working on what» and SCR-78 «Where work is» (SCN-140, SCN-141): silent until read, a reading's
// "nobody" only from a read list, «related» on both rows of a pair, never "working" past an expiry, the release
// asked before it is made, the unowned row always there.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { WhoIsWorking } from './WhoIsWorking'
import { WhereWorkScreen } from './launch/WhereWorkScreen'
import type { ProjectWorkView, WhereWorkView, WorkClaimView } from '../../shared/workClaims'

const claim = (over: Partial<WorkClaimView>): WorkClaimView => ({
  claimId: 'c1', projectId: 'p1', taskId: 't1', title: 'Login form', status: 'running', source: { repository: 'o/n', path: 'docs/backlog.md', id: 'CO-901' },
  sessionId: 's1', agent: 'claude-code', cameIn: 'launched', console: true, touches: ['src/auth'], since: new Date().toISOString(),
  until: new Date(Date.now() + 600_000).toISOString(), lastSignAt: new Date().toISOString(), life: 'live', related: [], ...over
})
const view = (over: Partial<ProjectWorkView> = {}): ProjectWorkView => ({ claims: [], held: [], sessions: [], leases: null, readAt: new Date().toISOString(), ...over })

function stub(fabric: Record<string, unknown>) {
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric }))
}
const show = (ui: React.ReactNode, locale: 'en' | 'ru' = 'en') => render(<I18nProvider locale={locale}>{ui}</I18nProvider>)
const session = (over: Record<string, unknown> = {}) => ({ sessionId: 's7', projectId: 'p1', agent: 'claude-code', cameIn: 'enrolled' as const, console: false,
  startedAt: new Date(Date.now() - 12 * 60_000).toISOString(), lastSignAt: new Date().toISOString(), stale: false, ...over })

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
    // UX-10: our sentence, in the operator's language; the machine's words a secondary line beneath it.
    await waitFor(() => expect(screen.getByText(en['work.who.unreadable'])).toBeTruthy())
    expect(en['work.who.unreadable']).not.toContain('{reason}')
    expect(screen.getByText('db down').className).toContain('error-detail')
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

  it("an IPC failure is the main process's sentence, never Electron's wrapper", async () => {
    stub({ work: { project: vi.fn(async () => { throw new Error("Error invoking remote method 'work:project': Error: the local stack is not answering") }) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await waitFor(() => expect(screen.getByText(/the local stack is not answering/)).toBeTruthy())
    expect(screen.queryByText(/invoking remote method/)).toBeNull()
  })

  it('a linked pair says the relation in words, and an untitled task is never an id', async () => {
    const a = claim({ claimId: 'a', related: [{ claimId: 'b', taskId: 'f3a9c2d1-0000', title: '', why: [{ kind: 'linked', rel: 'blocks', direction: 'from' }] }] })
    stub({ work: { project: vi.fn(async () => view({ claims: [a], held: [{ projectId: 'p1', taskId: '77e1b0aa-1111', title: '', sessionId: 's9', until: new Date(Date.now() + 600_000).toISOString() }] })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await waitFor(() => expect(screen.getByText(/linked: this task blocks it/)).toBeTruthy())
    expect(screen.queryByText(/\(blocks\)|f3a9c2d1|77e1b0aa/)).toBeNull()
    expect(screen.getAllByText(/untitled task/).length).toBeGreaterThanOrEqual(2)
  })

  it('reads again each minute, so a session that started since the last reading shows (0.3.5 i2 UX-1)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const project = vi.fn(async () => view())
    stub({ work: { project } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await waitFor(() => expect(project).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(60_000)
    await waitFor(() => expect(project).toHaveBeenCalledTimes(2))
    vi.useRealTimers()
  })

  it("a reading that answers for the previous project never shows on the current one (0.3.5 i2 UX-10)", async () => {
    let answerP1: (v: ProjectWorkView) => void = () => {}
    const project = vi.fn((id: string) => id === 'p1' ? new Promise<ProjectWorkView>((r) => { answerP1 = r }) : Promise.resolve(view()))
    stub({ work: { project } })
    const r = show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    r.rerender(<I18nProvider locale="en"><WhoIsWorking projectId="p2" feedMark={0} onError={() => {}} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText(en['work.who.none'])).toBeTruthy())
    answerP1(view({ claims: [claim({ title: 'Stale from p1' })] }))
    await new Promise((res) => setTimeout(res, 20))
    expect(screen.queryByText('Stale from p1')).toBeNull()
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

  it("agent-sync's leases are listed read-only, and an unread list says why once, in the operator's language (UX-5)", async () => {
    stub({ work: { project: vi.fn(async () => view({ leases: { read: false, code: 'timeout' } })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    const line = await screen.findByText(en['work.leases.unread'].replace('{reason}', en['work.leases.why.timeout']))
    expect(line.textContent!.match(/could not be read/g), 'the clause is said once').toHaveLength(1)
    cleanup()
    stub({ work: { project: vi.fn(async () => view({ leases: { read: false, code: 'refused' } })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />, 'ru')
    const said = await screen.findByText(ru['work.leases.unread']!.replace('{reason}', ru['work.leases.why.refused']!))
    expect(said.textContent!.replace('agent-sync', ''), 'no English reason inside the Russian sentence').not.toMatch(/[a-z]{4,}/)
  })

  it('a repository with no remote is said as that, not as a failure; one that does not use agent-sync shows no block (UX-5)', async () => {
    stub({ work: { project: vi.fn(async () => view({ leases: { read: false, code: 'no-origin' } })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await screen.findByText(en['work.leases.noOrigin'])
    expect(screen.queryByText(/could not be read/)).toBeNull()
    cleanup()
    stub({ work: { project: vi.fn(async () => view({ leases: null })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await screen.findByText(en['work.who.none'])
    expect(screen.queryByText(en['work.leases.title'])).toBeNull()
  })

  it('an agent Fabric holds no console for is not offered «Open session»; the row says where it runs (UX-3)', async () => {
    const openSession = vi.fn(async () => undefined)
    stub({ work: { project: vi.fn(async () => view({ claims: [claim({ cameIn: 'enrolled', console: false })] })) }, windows: { openSession } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await screen.findByText(en['work.who.outside.enrolled'])
    expect(screen.queryByRole('button', { name: en['work.who.open'] }), 'Open would show "This session is gone"').toBeNull()
    cleanup()
    stub({ work: { project: vi.fn(async () => view({ claims: [claim({ cameIn: 'hub', console: false })] })) }, windows: { openSession } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await screen.findByText(en['work.who.outside.other'])
    cleanup()
    stub({ work: { project: vi.fn(async () => view({ claims: [claim({})] })) }, windows: { openSession } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: en['work.who.open'] }))
    await waitFor(() => expect(openSession).toHaveBeenCalledWith('s1'))
  })

  it('a session working here without a claim is shown, so the page never says "nobody" over it (UX-4)', async () => {
    stub({ work: { project: vi.fn(async () => view({ claims: [claim({ sessionId: 's1' })], sessions: [session({ sessionId: 's1', console: true, cameIn: 'launched' }), session()] })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await screen.findByText(/no task claimed/)
    expect(screen.getAllByText(/no task claimed/), 'the session that holds a claim is its claim row, not a second row').toHaveLength(1)
    expect(screen.queryByText(en['work.who.none'])).toBeNull()
    cleanup()
    stub({ work: { project: vi.fn(async () => view({ sessions: [session()] })) } })
    show(<WhoIsWorking projectId="p1" feedMark={0} onError={() => {}} />)
    await screen.findByText(/no task claimed/)
    expect(screen.queryByText(en['work.who.none'])).toBeNull()
    expect(screen.getByText(en['work.who.outside.enrolled'])).toBeTruthy()
  })
})

describe('Where work is', () => {
  const where = (over: Partial<WhereWorkView> = {}): WhereWorkView => ({ rows: [], idle: 0, unowned: [], reviewUnread: null, readAt: new Date().toISOString(), ...over })
  const screenWith = () => <WhereWorkScreen feedMark={0} onProject={() => {}} onTask={() => {}} onReview={() => {}} onError={() => {}} />

  it('nothing in flight still shows the last row, «Sessions with no project», with "none"', async () => {
    stub({ work: { estate: vi.fn(async () => where({ idle: 3 })) } })
    show(screenWith())
    await waitFor(() => expect(screen.getByText(en['work.where.nothing'])).toBeTruthy())
    expect(screen.getByText(en['work.where.unowned'])).toBeTruthy()
    expect(screen.getByText(en['work.where.idle'].replace('{count}', '3'))).toBeTruthy()
  })

  it('one idle project is never "1 more projects" (UX-13)', async () => {
    stub({ work: { estate: vi.fn(async () => where({ idle: 1 })) } })
    show(screenWith())
    await screen.findByText(en['work.where.idle'].replace('{count}', '1'))
    expect(screen.queryByText(/\b1 more projects\b/)).toBeNull()
  })

  it('an unread estate is our sentence with the machine words beneath (UX-10)', async () => {
    stub({ work: { estate: vi.fn(async () => { throw new Error("Error invoking remote method 'work:estate': Error: the claims could not be read: relation missing") }) } })
    show(screenWith())
    await screen.findByText(en['work.where.unreadable'])
    expect(screen.getByText('the claims could not be read: relation missing').className).toContain('error-detail')
  })

  it('a session Fabric holds no console for does not open a window; its row says where it runs (UX-3)', async () => {
    const openSession = vi.fn(async () => undefined)
    stub({ work: { estate: vi.fn(async () => where({ rows: [{ projectId: 'p1', name: 'Atlas', sessions: [session()], claims: [], review: 0, lastSignAt: new Date().toISOString() }] })) }, windows: { openSession } })
    show(screenWith())
    fireEvent.click(await screen.findByText(new RegExp(en['work.who.outside.enrolled'])))
    expect(openSession).not.toHaveBeenCalled()
  })

  it('an unread estate is the reason with Try again, never "no work"', async () => {
    stub({ work: { estate: vi.fn(async () => { throw new Error('offline') }) } })
    show(screenWith())
    await waitFor(() => expect(screen.getByText(en['work.where.unreadable'])).toBeTruthy())
    expect(screen.getByRole('button', { name: en['common.retry'] })).toBeTruthy()
    expect(screen.queryByText(en['work.where.nothing'])).toBeNull()
  })

  it('a claim whose session ended reads the same as on the project screen, and a session that will not open is said', async () => {
    const onError = vi.fn()
    const live = { sessionId: 's1', projectId: 'p1', agent: 'codex', cameIn: 'launched' as const, console: true, startedAt: new Date().toISOString(), lastSignAt: new Date().toISOString(), stale: false }
    stub({
      work: { estate: vi.fn(async () => where({ rows: [{ projectId: 'p1', name: 'Atlas', sessions: [live], claims: [claim({ life: 'lapsed', title: '' })], review: null, lastSignAt: new Date().toISOString() }] })) },
      windows: { openSession: vi.fn(async () => { throw new Error("Error invoking remote method 'windows:open-session': Error: the session has ended") }) }
    })
    show(<WhereWorkScreen feedMark={0} onProject={() => {}} onTask={() => {}} onReview={() => {}} onError={onError} />)
    await waitFor(() => expect(screen.getByText(en['work.who.lapsed'])).toBeTruthy())
    expect(screen.getByText(en['work.task.untitled'])).toBeTruthy()
    fireEvent.click(screen.getByText(en['work.where.active']))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('the session has ended'))
  })

  it('a session with no project names its folder and opens when Fabric holds its console (0.3.5 i2 UX-3)', async () => {
    const openSession = vi.fn(async () => {})
    const now = new Date().toISOString()
    stub({
      work: { estate: vi.fn(async () => where({ unowned: [
        { sessionId: 'sx', projectId: null, agent: 'claude-code', cameIn: 'launched' as const, console: true, folder: '/work/scratch', startedAt: now, lastSignAt: now, stale: false },
        { sessionId: 'sy', projectId: null, agent: 'codex', cameIn: 'enrolled' as const, console: false, folder: null, startedAt: now, lastSignAt: now, stale: false }
      ] })) },
      windows: { openSession }
    })
    show(<WhereWorkScreen feedMark={0} onProject={() => {}} onTask={() => {}} onReview={() => {}} onError={() => {}} />)
    await waitFor(() => expect(screen.getByText(/in \/work\/scratch/)).toBeTruthy())
    expect(screen.getByText(/its folder is not shared with Fabric/)).toBeTruthy()
    fireEvent.click(screen.getByText(/in \/work\/scratch/))
    expect(openSession).toHaveBeenCalledWith('sx')
  })

  it('a quiet session reads its silence, an unread review queue says so, and a claim opens its task', async () => {
    const onTask = vi.fn()
    const stale = { sessionId: 's1', projectId: 'p1', agent: 'codex', cameIn: 'enrolled' as const, console: false, startedAt: new Date(Date.now() - 3600_000).toISOString(), lastSignAt: new Date(Date.now() - 25 * 60_000).toISOString(), stale: true }
    stub({ work: { estate: vi.fn(async () => where({ rows: [{ projectId: 'p1', name: 'Atlas', sessions: [stale], claims: [claim({})], review: null, lastSignAt: new Date().toISOString() }], reviewUnread: 'x' })) } })
    show(<WhereWorkScreen feedMark={0} onProject={() => {}} onTask={onTask} onReview={() => {}} onError={() => {}} />)
    await waitFor(() => expect(screen.getByText(/no sign for 25 min/)).toBeTruthy())
    expect(screen.getByText(en['work.where.reviewUnread'])).toBeTruthy()
    fireEvent.click(screen.getByText('Login form'))
    expect(onTask).toHaveBeenCalledWith('p1', 't1')
  })
})
