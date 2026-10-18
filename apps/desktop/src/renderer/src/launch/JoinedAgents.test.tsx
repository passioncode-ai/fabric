// A coding agent let in on its own, and «Отключить» (SCN-167, ADR-0160 §3; 0.3.7 wave 3). In Агенты each coding agent
// that joined from a terminal carries «подключился сам», the fact Fabric cannot prove which program it is, and
// «Отключить»; a disconnected one says «Отключён» with «Пустить снова». Both are acts with their undo; no dialog.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import type { ActAnswer } from '../../../shared/acts.ts'
import type { HubOverview } from '../../../shared/access.ts'
import { JoinedAgents } from './JoinedAgents'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const grant = (resource: string) => ({ grantId: 'g' + resource, callee: 'fabric', capability: 'session.enroll', resource, line: { kind: 'other', text: '' } as never, expiresAt: '2027-10-18T00:00:00Z' })
const overview = (over: Partial<HubOverview> = {}): HubOverview => ({
  hub: { listening: true, origin: 'http://127.0.0.1:47070' }, products: [], pending: [], denials: [],
  agents: [
    { bindingId: 'b1', agent: { agentId: 'codex', name: 'Codex', installedBy: null, repository: null, codingAgent: true }, since: '2026-10-18T10:00:00Z', grants: [grant('project:p1')] },
    { bindingId: 'b2', agent: { agentId: 'codex', name: 'Codex', installedBy: null, repository: null, codingAgent: true }, since: '2026-10-18T11:00:00Z', grants: [grant('project:p2')] },
    { bindingId: 'b3', agent: { agentId: 'research', name: 'Research', installedBy: 'x', repository: null }, since: '2026-10-18T11:00:00Z', grants: [{ ...grant('x'), callee: 'research', capability: 'web.read' }] }
  ],
  keptOut: { readable: true, agents: [{ agentId: 'kimi-code', name: 'Kimi Code', at: '2026-10-18T09:00:00Z' }] },
  ...over
})

function mount(ov: HubOverview | Error, acts: { disconnectAgent?: (id: string) => Promise<ActAnswer>; letAgentIn?: (id: string) => Promise<ActAnswer> } = {}, locale: 'en' | 'ru' = 'en') {
  const read = vi.fn(async () => { if (ov instanceof Error) throw ov; return ov })
  const disconnectAgent = vi.fn(acts.disconnectAgent ?? (async (_id: string): Promise<ActAnswer> => ({ ok: true, seq: 5 })))
  const letAgentIn = vi.fn(acts.letAgentIn ?? (async (_id: string): Promise<ActAnswer> => ({ ok: true, seq: 6 })))
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { overview: read, disconnectAgent, letAgentIn } } }))
  render(<I18nProvider locale={locale}><JoinedAgents projects={[{ id: 'p1', name: 'Fabric' }, { id: 'p2', name: 'Nicegram' }]} /></I18nProvider>)
  return { read, disconnectAgent, letAgentIn }
}

describe('coding agents that joined on their own', () => {
  it('lists each coding agent once, with «подключился сам», its projects, the proof line and «Отключить»; not a product’s agent', async () => {
    mount(overview())
    const row = await screen.findByRole('listitem', { name: 'Codex' })
    expect(row.textContent).toContain(en['joined.self'])
    expect(row.textContent).toContain('Fabric')
    expect(row.textContent).toContain('Nicegram')
    expect(row.textContent).toContain(en['joined.proof'].replace('{name}', 'Codex'))
    expect(within(row).getByRole('button', { name: en['joined.disconnect'] })).toBeTruthy()
    expect(screen.queryByRole('listitem', { name: 'Research' })).toBeNull()
  })

  it('«Отключить» is one press, no dialog, and reads the list again', async () => {
    const { disconnectAgent, read } = mount(overview())
    const row = await screen.findByRole('listitem', { name: 'Codex' })
    fireEvent.click(within(row).getByRole('button', { name: en['joined.disconnect'] }))
    await waitFor(() => expect(disconnectAgent).toHaveBeenCalledWith('codex'))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })

  it('a disconnected agent says «Отключён» and «Пустить снова» lets it back in', async () => {
    const { letAgentIn } = mount(overview())
    const row = await screen.findByRole('listitem', { name: 'Kimi Code' })
    expect(row.textContent).toContain(en['joined.out'])
    fireEvent.click(within(row).getByRole('button', { name: en['joined.letIn'] }))
    await waitFor(() => expect(letAgentIn).toHaveBeenCalledWith('kimi-code'))
  })

  it('a disconnect that fails leaves the agent connected and says so on its row, with the machine’s words', async () => {
    mount(overview(), { disconnectAgent: async () => ({ ok: false, reason: 'failed', says: 'binding store unreachable' }) })
    const row = await screen.findByRole('listitem', { name: 'Codex' })
    fireEvent.click(within(row).getByRole('button', { name: en['joined.disconnect'] }))
    await waitFor(() => expect(row.textContent).toContain(en['joined.disconnectFailed']))
    expect(row.textContent).toContain('binding store unreachable')
    expect(within(row).getByRole('button', { name: en['joined.disconnect'] })).toBeTruthy()
  })

  it('a list of disconnected agents that cannot be read says nobody is kept out now', async () => {
    mount(overview({ keptOut: { readable: false, agents: [] } }))
    expect(await screen.findByText(en['joined.outUnreadable'])).toBeTruthy()
  })

  it('says nothing joined yet, and a failed read in our words', async () => {
    mount(overview({ agents: [], keptOut: { readable: true, agents: [] } }))
    expect(await screen.findByText(en['joined.none'])).toBeTruthy()
    cleanup()
    mount(new Error('agent access is not ready yet'))
    expect(await screen.findByText(en['joined.failed'])).toBeTruthy()
    expect(screen.getByText('agent access is not ready yet')).toBeTruthy()
  })

  it('speaks Russian', async () => {
    mount(overview(), {}, 'ru')
    const row = await screen.findByRole('listitem', { name: 'Codex' })
    expect(within(row).getByRole('button', { name: ru['joined.disconnect'] })).toBeTruthy()
    expect(ru['joined.disconnect']).toBe('Отключить')
    expect(ru['joined.letIn']).toBe('Пустить снова')
  })
})
