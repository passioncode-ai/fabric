// Memory (SCN-190, SCR-92): the overview with each source's freshness, the organizations and projects as a map with its
// table twin, a project's card that narrows search and changes, a search hit whose quote is checked, the window's
// states (index not open, the first index still reading, no canvas), and the graph mapped into @fabric/graph's model.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryScreen, memoryGraphData, quoteOf } from './MemoryScreen'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const NOW = '2026-11-20T21:00:00.000Z'
const overview = {
  ok: true as const, at: NOW, docs: 194897, nodes: 76528, edges: 135552, bytes: 1_008_730_112, projects: 121, sessions: 867,
  byKind: { session: 867, turn: 12317, task: 1602, message: 37948, commit: 24209, document: 117019 }, bySource: {},
  byContext: [{ context: 'personal', label: 'Owner', docs: 100 }], vectors: { model: 'embeddinggemma', embedded: 5600, of: 194897 },
  sources: [
    { source: 'transcripts' as const, state: 'catching-up' as const, readAt: NOW, left: 197, unread: 0, error: null },
    { source: 'fabric' as const, state: 'fresh' as const, readAt: NOW, left: 0, unread: 0, error: null },
    { source: 'board' as const, state: 'unread' as const, readAt: null, left: 0, unread: 0, error: 'board-unread: the board could not be read' },
    { source: 'git' as const, state: 'fresh' as const, readAt: NOW, left: 0, unread: 0, error: null },
    { source: 'vectors' as const, state: 'never' as const, readAt: null, left: 0, unread: 0, error: null }
  ],
  lastPass: null
}
const graph = {
  ok: true as const,
  nodes: [
    { id: 'ctx:personal', kind: 'organization' as const, label: 'Owner', context: 'personal', docs: 30, projects: 2 },
    { id: 'project:p1', kind: 'project' as const, label: 'alpha', context: 'personal', docs: 20, byKind: { task: 12, commit: 8 }, lastAt: NOW, role: 'canonical', folder: '/d/alpha' },
    { id: 'project:p2', kind: 'project' as const, label: 'beta', context: 'personal', docs: 10, byKind: { message: 10 }, lastAt: null, role: 'canonical', folder: '/d/beta' }
  ],
  edges: [
    { source: 'project:p1', target: 'ctx:personal', kind: 'in' as const, weight: 1 },
    { source: 'project:p2', target: 'ctx:personal', kind: 'in' as const, weight: 1 },
    { source: 'project:p1', target: 'project:p2', kind: 'board' as const, weight: 4 }
  ],
  organizations: [{ context: 'personal', label: 'Owner', projects: 2, docs: 30 }]
}
const hit = { id: 'task:t1', kind: 'task', title: 'Memory dashboard', passage: '… draw the organizations and their projects …', at: NOW, node: 'task:t1',
  project: 'alpha', folder: '/d/alpha', context: 'personal', session_id: null, resume: null, cite: null, digest: 'abc', via: ['words'] }

function stub(o: object = overview) {
  const api = {
    memoryIndex: {
      overview: vi.fn(async () => o),
      graph: vi.fn(async () => graph),
      changes: vi.fn(async (_h: number, project?: string) => ({ ok: true, since: NOW, hours: 24, total: 3, capped: false,
        changes: [{ project: project ?? 'alpha', kind: 'commit', count: 3, newest: [{ id: 'commit:c1', title: 'feat: memory', at: NOW, node: 'commit:c1' }] }] })),
      check: vi.fn(async () => ({ ok: true, outcome: 'answer', kept: 1, verdicts: [{ doc: 'task:t1', kept: true }] })),
      search: vi.fn(async () => ({ ok: true, hits: [hit], degraded: [], docs: 194897 }))
    }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}
const show = () => render(<I18nProvider locale="en"><MemoryScreen onError={() => {}} /></I18nProvider>)

describe('MemoryScreen', () => {
  it('shows what the base holds and each source\'s freshness, a failing one with its reason', async () => {
    stub()
    show()
    await screen.findByText('194,897')
    expect(screen.getByText(en['memoryBase.catching'].replace('{left}', '197'))).toBeTruthy()
    const sources = screen.getByRole('list', { name: en['memoryBase.sourcesLabel'] })
    expect(within(sources).getByText(en['memoryBase.state.catching-up'])).toBeTruthy()
    expect(within(sources).getByText(en['memoryBase.state.unread'])).toBeTruthy()
    expect(within(sources).getByTitle('board-unread: the board could not be read')).toBeTruthy()
    expect(screen.getByText('2.9 % (5,600)')).toBeTruthy()
  })

  it('says the base is not open, with the reason, instead of zeros', async () => {
    stub({ ok: false, reason: 'the index is not running yet' })
    show()
    await screen.findByText(en['memoryBase.notOpen'])
    expect(screen.queryByText('0')).toBeNull()
  })

  it('has the map\'s text twin, and a project picked from it narrows the search and the changes', async () => {
    const api = stub()
    show()
    // jsdom has no 2D canvas: the map says so, and the table still holds every project.
    await screen.findByText(en['memoryBase.noCanvas'])
    fireEvent.click(screen.getByText(en['memoryBase.tableSummary']))
    fireEvent.click(screen.getByRole('button', { name: en['memoryBase.pick'].replace('{name}', 'alpha') }))
    await screen.findByRole('region', { name: en['memoryBase.cardLabel'].replace('{name}', 'alpha') })
    await waitFor(() => expect(api.memoryIndex.changes).toHaveBeenLastCalledWith(24, 'alpha'))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'organizations' } })
    await screen.findByText('Memory dashboard')
    expect(api.memoryIndex.search).toHaveBeenLastCalledWith('organizations', 'alpha')
  })

  it('checks a hit\'s quote against its source and says the verdict', async () => {
    const api = stub()
    show()
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'organizations' } })
    fireEvent.click(await screen.findByText(en['memoryBase.check']))
    await screen.findByText(en['memoryBase.verified'])
    expect(api.memoryIndex.check).toHaveBeenCalledWith([{ quote: 'draw the organizations and their projects', doc: 'task:t1', digest: 'abc' }])
  })

  it('switches what changed between a day and a week', async () => {
    const api = stub()
    show()
    fireEvent.click(await screen.findByRole('button', { name: en['memoryBase.week'] }))
    await waitFor(() => expect(api.memoryIndex.changes).toHaveBeenLastCalledWith(168, undefined))
  })
})

describe('memory graph mapping', () => {
  it('puts each project in its organization\'s group and keeps the board line with its weight', () => {
    const d = memoryGraphData(graph)
    expect(d.nodes.find((n) => n.id === 'project:p1')).toMatchObject({ group: 'ctx:personal', size: 20, kind: 'project' })
    expect(d.nodes.find((n) => n.id === 'ctx:personal')?.group).toBeUndefined()
    expect(d.edges).toContainEqual({ from: 'project:p1', to: 'project:p2', kind: 'board', weight: 4 })
  })

  it('takes a passage as a quote without the ellipses that mark its cut', () => {
    expect(quoteOf('… one two … three …')).toBe('one two three')
  })
})
