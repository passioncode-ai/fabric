// @vitest-environment jsdom
// Work that needs another project (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §5, its first way): a
// task page opens a coding agent's console in project B with the person's sentence and a link back to the task as its
// first instruction, through Fabric's own console start, and leaves a note in the task. «Поручить агенту B в Fabric»
// is 0.3.15's and is not offered.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { OpenConsoleContext } from '../consoles'
import type { ProjectRow } from '../../../shared/types'
import { CrossProjectConsole } from './CrossProjectConsole'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const project = (id: string, name: string, over: Partial<ProjectRow> = {}): ProjectRow => ({
  id, name, estate_id: 'e', purpose: null, repo_path: null, status: 'active', config_revision: 1, created_at: 'a',
  memory_backend: 'local', default_agent: 'claude-code', mcp_servers: [], ...over
})
const here = project('pa', 'Fabric')

function stub(open = vi.fn(async () => ({ sessionId: 's9' }))) {
  const api = {
    projects: { list: vi.fn(async () => [here, project('pd', 'Dashboards', { default_agent: 'codex' }), project('pb', 'Bot', { status: 'archived' }), project('pc', 'copylot')]) },
    terminal: { open },
    tasks: { note: vi.fn(async () => ({ ok: true })) }
  }
  vi.stubGlobal('window', Object.assign(window, { fabric: api }))
  return api
}
const show = (opened: string[] = []) => render(<I18nProvider locale="en"><OpenConsoleContext.Provider value={async (id) => { opened.push(id) }}>
  <CrossProjectConsole project={here} taskId="t1" taskTitle="Show nudges in the session window" />
</OpenConsoleContext.Provider></I18nProvider>)

describe('«Нужна правка в другом проекте»', () => {
  it('opens a console in the chosen project with the sentence and the way back to this task, and notes it in the task', async () => {
    const api = stub()
    const opened: string[] = []
    show(opened)
    fireEvent.click(screen.getByText(en['xp.title']))
    const select = await screen.findByLabelText(en['xp.project'])
    const options = [...(select as HTMLSelectElement).options].map((o) => o.textContent)
    expect(options).toEqual([en['xp.pick'], 'copylot', 'Dashboards'])
    fireEvent.change(select, { target: { value: 'pd' } })
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Show the agent\'s nudges in the session window' } })
    fireEvent.click(screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'Dashboards') }))
    await waitFor(() => expect(opened).toEqual(['s9']))
    const [projectId, optionId, first] = api.terminal.open.mock.calls[0] as unknown as [string, string, string]
    expect([projectId, optionId]).toEqual(['pd', 'codex'])
    expect(first).toContain('Show the agent\'s nudges in the session window')
    expect(first).toContain('Show nudges in the session window')
    expect(first).toContain('Fabric')
    expect(api.tasks.note).toHaveBeenCalledWith('t1', en['xp.note'].replace('{project}', 'Dashboards').replace('{what}', 'Show the agent\'s nudges in the session window'))
    expect(await screen.findByRole('status')).toBeTruthy()
  })

  it('waits for a project and a sentence before it offers to open, and offers no hand-off through Fabric', async () => {
    stub()
    show()
    fireEvent.click(screen.getByText(en['xp.title']))
    await screen.findByLabelText(en['xp.project'])
    expect((screen.getByRole('button', { name: en['xp.openNoProject'] }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/Fabric agent|агенту/)).toBeNull()
  })

  it('says a console that did not open, and writes no note', async () => {
    const api = stub(vi.fn(async () => { throw new Error('no such agent') }))
    show()
    fireEvent.click(screen.getByText(en['xp.title']))
    fireEvent.change(await screen.findByLabelText(en['xp.project']), { target: { value: 'pc' } })
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Check the voice' } })
    fireEvent.click(screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'copylot') }))
    expect(await screen.findByText(en['xp.failed'])).toBeTruthy()
    expect(screen.getByText('no such agent')).toBeTruthy()
    expect(api.tasks.note).not.toHaveBeenCalled()
  })
})
