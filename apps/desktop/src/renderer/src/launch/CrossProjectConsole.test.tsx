// @vitest-environment jsdom
// Work that needs another project (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §5, its first way): a
// task page opens a coding agent's console in project B with the person's sentence and a link back to the task as its
// first instruction, through Fabric's own console start, and leaves a note in the task. «Поручить агенту B в Fabric»
// belongs to the release of 5 November and is not offered.
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
    projects: { list: vi.fn(async () => [here, project('pd', 'Dashboards', { default_agent: 'codex', repo_path: '/work/dashboards' }), project('pb', 'Bot', { status: 'archived' }), project('pc', 'copylot')]) },
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

  it('UX-13 (0.3.15 review, iteration 2): names each project as the rail does, its display name, never its slug', async () => {
    const api = stub()
    api.projects.list = vi.fn(async () => [here, project('pr', 'research-agent', { displayName: 'Research Agent', repo_path: '/work/ra' })])
    show()
    fireEvent.click(screen.getByText(en['xp.title']))
    const select = await screen.findByLabelText(en['xp.project'])
    expect([...(select as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([en['xp.pick'], 'Research Agent'])
    fireEvent.change(select, { target: { value: 'pr' } })
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Add the search' } })
    expect(screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'Research Agent') })).toBeTruthy()
    expect(document.body.textContent).not.toContain('research-agent')
  })

  it('waits for a project and a sentence before it offers to open, and offers no hand-off through Fabric', async () => {
    stub()
    show()
    fireEvent.click(screen.getByText(en['xp.title']))
    await screen.findByLabelText(en['xp.project'])
    expect((screen.getByRole('button', { name: en['xp.openNoProject'] }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/Fabric agent|агенту/)).toBeNull()
  })

  it('ER-14: a project with no repository says the agent starts in the home folder, and opens only on a second press', async () => {
    const api = stub()
    const opened: string[] = []
    show(opened)
    fireEvent.click(screen.getByText(en['xp.title']))
    fireEvent.change(await screen.findByLabelText(en['xp.project']), { target: { value: 'pc' } })
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Check the voice' } })
    expect(screen.getByText(en['xp.home'].replace('{project}', 'copylot'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'copylot') }))
    expect(api.terminal.open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en['xp.openHome'] }))
    await waitFor(() => expect(opened).toEqual(['s9']))
    expect(await screen.findByText(new RegExp(en['xp.doneHome'].split('{project}')[0]))).toBeTruthy()
  })

  it('DA-6: a project of another recorded business is refused, and nothing of this task reaches it', async () => {
    const api = stub()
    api.projects.list = vi.fn(async () => [{ ...here, business: 'Appvillis' }, project('px', 'Phonebot', { business: 'Other Co', repo_path: '/x' }), project('py', 'Same', { business: ' appvillis ', repo_path: '/y' })])
    render(<I18nProvider locale="en"><OpenConsoleContext.Provider value={async () => {}}>
      <CrossProjectConsole project={{ ...here, business: 'Appvillis' }} taskId="t1" taskTitle="Secret plan" />
    </OpenConsoleContext.Provider></I18nProvider>)
    fireEvent.click(screen.getByText(en['xp.title']))
    fireEvent.change(await screen.findByLabelText(en['xp.project']), { target: { value: 'px' } })
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Do it' } })
    expect(screen.getByText(en['xp.wall'].replaceAll('{project}', 'Phonebot'))).toBeTruthy()
    const button = screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'Phonebot') }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(api.terminal.open).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(en['xp.project']), { target: { value: 'py' } })
    expect(screen.queryByText(en['xp.wall'].replaceAll('{project}', 'Same'))).toBeNull()
  })

  it('ER-15, UX-15: a started console whose tab fails is said as started, noted, offered again, and never started twice', async () => {
    const api = stub()
    let tries = 0
    render(<I18nProvider locale="en"><OpenConsoleContext.Provider value={async () => { if (tries++ === 0) throw new Error('tab refused') }}>
      <CrossProjectConsole project={here} taskId="t1" taskTitle="Show nudges" />
    </OpenConsoleContext.Provider></I18nProvider>)
    fireEvent.click(screen.getByText(en['xp.title']))
    fireEvent.change(await screen.findByLabelText(en['xp.project']), { target: { value: 'pd' } })
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Fix it' } })
    const button = screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'Dashboards') }) as HTMLButtonElement
    fireEvent.click(button)
    expect(await screen.findByText(en['xp.tabFailed'].replace('{project}', 'Dashboards'))).toBeTruthy()
    expect(screen.queryByText(en['xp.failed'])).toBeNull()
    expect(api.tasks.note).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(api.terminal.open).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: en['agentScreen.openSession'] }))
    await waitFor(() => expect(screen.queryByText(en['xp.tabFailed'].replace('{project}', 'Dashboards'))).toBeNull())
    expect(api.terminal.open).toHaveBeenCalledTimes(1)
  })

  it('ER-26: every started console is remembered; picking A again after B shows A\'s session and starts nothing', async () => {
    let n = 0
    const api = stub(vi.fn(async () => ({ sessionId: `s${++n}` })))
    const opened: string[] = []
    show(opened)
    fireEvent.click(screen.getByText(en['xp.title']))
    const select = await screen.findByLabelText(en['xp.project'])
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Fix it' } })
    fireEvent.change(select, { target: { value: 'pd' } })
    fireEvent.click(screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'Dashboards') }))
    await waitFor(() => expect(opened).toEqual(['s1']))
    fireEvent.change(select, { target: { value: 'pc' } })
    fireEvent.click(screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'copylot') }))
    fireEvent.click(screen.getByRole('button', { name: en['xp.openHome'] }))
    await waitFor(() => expect(opened).toEqual(['s1', 's2']))
    fireEvent.change(select, { target: { value: 'pd' } })
    const again = screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'Dashboards') }) as HTMLButtonElement
    expect(again.disabled).toBe(true)
    fireEvent.click(again)
    expect(api.terminal.open).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status').textContent).toContain('Dashboards')
    fireEvent.click(screen.getByRole('button', { name: en['agentScreen.openSession'] }))
    await waitFor(() => expect(opened).toEqual(['s1', 's2', 's1']))
  })

  it('ER-25, UX-23: a started console whose tab and note both fail says one thing; once its tab opens, the form says so', async () => {
    const api = stub()
    api.tasks.note = vi.fn(async () => { throw new Error('note refused') })
    let tries = 0
    render(<I18nProvider locale="en"><OpenConsoleContext.Provider value={async () => { if (tries++ === 0) throw new Error('tab refused') }}>
      <CrossProjectConsole project={here} taskId="t1" taskTitle="Show nudges" />
    </OpenConsoleContext.Provider></I18nProvider>)
    fireEvent.click(screen.getByText(en['xp.title']))
    fireEvent.change(await screen.findByLabelText(en['xp.project']), { target: { value: 'pd' } })
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Fix it' } })
    fireEvent.click(screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'Dashboards') }))
    expect(await screen.findByText(en['xp.tabFailed'].replace('{project}', 'Dashboards'))).toBeTruthy()
    expect(screen.queryByText(en['xp.failed'])).toBeNull()
    expect(screen.getByText(en['xp.noteFailed'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['agentScreen.openSession'] }))
    await waitFor(() => expect(screen.queryByText(en['xp.tabFailed'].replace('{project}', 'Dashboards'))).toBeNull())
    expect(screen.getByRole('status').textContent).toMatch(new RegExp('^' + en['xp.done'].split('{project}')[0] + 'Dashboards'))
    expect(screen.getByText(en['xp.noteFailed'])).toBeTruthy()
  })

  it('says a console that did not open, and writes no note', async () => {
    const api = stub(vi.fn(async () => { throw new Error('no such agent') }))
    show()
    fireEvent.click(screen.getByText(en['xp.title']))
    fireEvent.change(await screen.findByLabelText(en['xp.project']), { target: { value: 'pc' } })
    fireEvent.change(screen.getByLabelText(en['xp.what']), { target: { value: 'Check the voice' } })
    fireEvent.click(screen.getByRole('button', { name: en['xp.open'].replace('{project}', 'copylot') }))
    fireEvent.click(screen.getByRole('button', { name: en['xp.openHome'] }))
    expect(await screen.findByText(en['xp.failed'])).toBeTruthy()
    expect(screen.getByText('no such agent')).toBeTruthy()
    expect(api.tasks.note).not.toHaveBeenCalled()
  })
})
