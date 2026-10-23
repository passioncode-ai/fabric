// SCN-175 (W2 S5, OF-32): the project graph.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { GraphScreen } from './GraphScreen'

const graph = {
  nodes: [
    { id: 'a', name: 'fabric', summary: 'The CEO agent', business: 'PassionCode' },
    { id: 'b', name: 'contract', summary: null, business: 'PassionCode' },
    { id: 'c', name: 'site', summary: null, business: null },
    { id: 'outside:x', name: 'Some Service', summary: null, business: null, outside: true }
  ],
  edges: [
    { from: 'a', to: 'b', kind: 'depends-on' },
    { from: 'a', to: 'outside:x', kind: 'used-by' },
    { from: 'b', to: 'c', kind: 'board', weight: 4 }
  ],
  businesses: ['PassionCode']
}
const install = (g: () => Promise<unknown>) => vi.stubGlobal('window', Object.assign(window, { fabric: { projects: { graph: vi.fn(g) } } }))
const show = (projectId: string | null, on = { onProject: vi.fn(), onWhole: vi.fn() }) =>
  render(<I18nProvider locale="en"><GraphScreen projectId={projectId} feedMark={0} {...on} /></I18nProvider>)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the project graph (SCN-175)', () => {
  it('draws businesses as columns, the projects without one and the targets outside Fabric apart, and a project opens its page', async () => {
    install(async () => graph)
    const on = { onProject: vi.fn(), onWhole: vi.fn() }
    const { container } = show(null, on)
    await waitFor(() => expect(screen.getByText('fabric')).toBeTruthy())
    expect([...container.querySelectorAll('.lg-column')].map((h) => h.textContent)).toEqual(['PassionCode', en['graph.noBusiness'], en['graph.outside']])
    expect(container.querySelectorAll('.lg-line')).toHaveLength(3)
    expect(container.querySelector('.lg-node.outside')?.tagName).toBe('DIV')
    fireEvent.click(screen.getByText('contract'))
    expect(on.onProject).toHaveBeenCalledWith('b')
    expect(screen.getByText('fabric: Depends on contract')).toBeTruthy()
    expect(screen.getByText('contract and site: 4 messages on the board')).toBeTruthy()
  })

  it('centred on a project shows it and its neighbours, and offers the whole graph', async () => {
    install(async () => graph)
    const on = { onProject: vi.fn(), onWhole: vi.fn() }
    show('c', on)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'site and its neighbours' })).toBeTruthy())
    expect(screen.queryByText('fabric')).toBeNull()
    expect(screen.getByText('contract')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['graph.whole'] }))
    expect(on.onWhole).toHaveBeenCalled()
  })

  it('says a graph it could not read, and an estate with no relations yet', async () => {
    install(async () => { throw new Error('board down') })
    show(null)
    await waitFor(() => expect(screen.getByText(en['graph.unreadable'])).toBeTruthy())
    cleanup()
    install(async () => ({ nodes: [{ id: 'a', name: 'fabric', summary: null, business: null }], edges: [], businesses: [] }))
    show(null)
    await waitFor(() => expect(screen.getByText(en['graph.empty'])).toBeTruthy())
  })
})

// 0.3.12 review UX-10: «Колонки это бизнесы; …» dropped the dash's grammar, and «… : сообщений на доске: 4» had two colons.
describe('the graph speaks Russian grammatically (0.3.12 review UX-10)', () => {
  it('counts a board line with its plural form, after one colon, and its lede reads whole', async () => {
    install(async () => ({ ...graph, edges: [...graph.edges, { from: 'a', to: 'c', kind: 'board', weight: 1 }, { from: 'b', to: 'a', kind: 'board', weight: 5 }] }))
    render(<I18nProvider locale="ru"><GraphScreen projectId={null} feedMark={0} onProject={vi.fn()} onWhole={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('contract и site: 4 сообщения на доске')).toBeTruthy())
    expect(screen.getByText('fabric и site: 1 сообщение на доске')).toBeTruthy()
    expect(screen.getByText('contract и fabric: 5 сообщений на доске')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Колонки это|сообщений на доске: \d/)
  })
})
