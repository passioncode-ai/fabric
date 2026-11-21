// The search panel's «Везде» group (spec 2026-11-19 §2): ranked hits with where they happened and how to continue them,
// «Связи» drawing a hit's neighbourhood with the same list as text, a continue that names its outcome, and a group that
// says when it searched by words only or found nothing.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EverywhereSearch } from './EverywhereSearch'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import type { AroundAnswer, EverywhereAnswer } from '../../shared/estateSearch'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const hit = { id: 'claude:s1#20', kind: 'turn', title: 'Knowledge graph', passage: 'find the transcript by a phrase', at: '2026-11-19T10:00:00Z', node: 'session:s1',
  project: 'fabric', folder: '/d/fabric', context: 'org:passioncode', session_id: 's1', resume: "cd '/d/fabric' && claude --resume s1", cite: '/t/s1.jsonl:20', via: ['words'] }

function stub(answer: EverywhereAnswer, around: AroundAnswer = { ok: true, start: { id: 'session:s1', kind: 'session', label: 'Knowledge graph' }, nodes: [
  { id: 'task:t1', kind: 'task', label: 'The graph task', known: true, hop: 1, rel: 'cites', direction: 'out' },
  { id: 'commit:abc', kind: 'commit', label: 'abc feat: graph', known: true, hop: 2, rel: 'cites', direction: 'in' }
], capped: false }) {
  const api = { search: { everywhere: vi.fn(async () => answer), around: vi.fn(async () => around), resume: vi.fn(async () => ({ ok: true, session_id: 'new-console' })) } }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}
const show = (query: string) => render(<I18nProvider locale="en"><EverywhereSearch query={query} onError={() => {}} /></I18nProvider>)

describe('EverywhereSearch', () => {
  it('lists ranked hits with project and context, and says when meaning was not ranked', async () => {
    const api = stub({ ok: true, hits: [hit], degraded: ['vector-unavailable'], docs: 100 })
    show('transcript phrase')
    await screen.findByText('Knowledge graph')
    expect(api.search.everywhere).toHaveBeenCalledWith('transcript phrase')
    expect(screen.getByText(/fabric · org:passioncode · 2026-11-19/)).toBeTruthy()
    expect(screen.getByText(en['everywhere.wordsOnly'])).toBeTruthy()
  })

  it('draws what relates to a hit and lists the same as text', async () => {
    const api = stub({ ok: true, hits: [hit], degraded: [], docs: 100 })
    show('graph')
    fireEvent.click(await screen.findByText(en['everywhere.links']))
    await screen.findByText('The graph task')
    expect(api.search.around).toHaveBeenCalledWith('session:s1', 2)
    expect(screen.getByText('2 step: cites, abc feat: graph')).toBeTruthy()
  })

  it('continues a session and says where', async () => {
    const api = stub({ ok: true, hits: [hit], degraded: [], docs: 100 })
    show('graph')
    fireEvent.click(await screen.findByText(en['everywhere.resume']))
    await waitFor(() => expect(api.search.resume).toHaveBeenCalledWith('s1'))
    await screen.findByText('Continued in a Fabric console.')
  })

  it('names how much it searched when nothing matched, and asks nothing for one letter', async () => {
    const api = stub({ ok: true, hits: [], degraded: [], docs: 42 })
    show('zzzz')
    await screen.findByText(/Nothing matched in the 42 documents/)
    cleanup()
    show('z')
    await new Promise((r) => setTimeout(r, 350))
    expect(api.search.everywhere).toHaveBeenCalledTimes(1)
  })
})
