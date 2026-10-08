// The first run and the start paths (ADR-0100), driven through the real components with the bridge
// stubbed at its edge. Each case asserts what reaches the bridge — the act — not only what is drawn.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { PersonaProvider } from '../launch/persona'
import { FirstRun, firstRunDue } from './FirstRun'
import { StartScreen, explainError, type StartPath } from './StartPaths'
import { forgetAgentAttempts } from './AgentPaths'
import type { CandidateView, ExecutorRow, FolderView, ScanView } from '../../../shared/startPaths.ts'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); forgetAgentAttempts() })

const repo = (over: Partial<CandidateView>): CandidateView => ({
  path: '/w/a', name: 'a', git: true, kind: 'repository', parent: null, branch: 'main', remote: null,
  lastCommit: { at: '2026-10-01T10:00:00Z', subject: 'first' }, stack: ['Node.js'], group: '/w/a', importedBy: [], ...over
})

function bridge(over: Record<string, unknown> = {}) {
  const fabric = {
    persona: { read: vi.fn(async () => ({ persona: { seed: 731, style: 'orbit' }, chosen: false })), save: vi.fn(async (next: unknown) => ({ persona: next, saved: true })) },
    start: {
      chooseFolder: vi.fn(async () => '/w'),
      inspect: vi.fn(async (): Promise<FolderView> => ({ ...repo({ path: '/w/alpha', name: 'alpha' }) })),
      scan: vi.fn(async (): Promise<ScanView> => ({ root: '/w', candidates: [], visited: 1, unreadable: 0, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-03T00:00:00Z' })),
      cancelScan: vi.fn(async () => undefined),
      lastScan: vi.fn(async () => null),
      createFolder: vi.fn(async () => ({ ok: true, path: '/w/new-thing' })),
      adapterSkills: vi.fn(async () => ({ ready: true, where: 'plugin', version: '0.8.0', found: { 'creating-fabric-agents': true, 'adapting-projects-to-fabric': true }, command: 'npx @passioncode-ai/passioncode@latest update', launcherCovers: true })),
      executors: vi.fn(async () => [
        { id: 'claude-code', label: 'Claude Code', connected: true, state: 'found', version: '2.1.288', path: '/bin/claude', install: null },
        { id: 'codex', label: 'Codex', connected: false, state: 'missing', version: null, path: null, install: 'npm install -g @openai/codex' }
      ])
    },
    projects: { create: vi.fn(async (input: { id: string; name: string; repoPaths?: string[] }) => ({ id: input.id, name: input.name })) },
    settings: { read: vi.fn(async () => ({ runnerFallback: { order: [] } })) },
    tasks: { start: vi.fn(async (_input: unknown) => ({ session: { sessionId: "s1" } })) },
    windows: { openSession: vi.fn(async () => undefined) },
    ...over
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric }))
  return fabric
}

function start(path: StartPath, projects: { id: string; name: string }[] | null = []) {
  const handlers = { onPath: vi.fn(), onCreated: vi.fn(), onOpenProject: vi.fn(), onHome: vi.fn(), onProjectsChanged: vi.fn() }
  render(
    <I18nProvider locale="en">
      <StartScreen path={path} projects={projects as never} {...handlers} />
    </I18nProvider>
  )
  return handlers
}

describe('the first run (SCN-126)', () => {
  // #region executor-auth-render-test — docs: docs/ux/scenarios.md#scn-126-first-run-name-look-coding-agents-where-to-start
  const executor = (authentication?: ExecutorRow['authentication']): ExecutorRow => ({ id: 'claude-code', label: 'Claude Code', connected: false, state: 'found', version: '2.1.289', path: '/fixture/claude', install: null, authentication })
  it('shows separate sign-in states without promoting connectivity or blocking continuation', async () => {
    for (const [state, key] of [
      ['authenticated', 'start.executor.auth.authenticated'], ['not-authenticated', 'start.executor.auth.notAuthenticated'],
      ['unsupported', 'start.executor.auth.unsupported'], ['unknown', 'start.executor.auth.unknown']
    ] as const) {
      bridge({ start: { ...bridge().start, executors: vi.fn(async () => [executor({ state, method: null, reason: null })]) } })
      render(<I18nProvider locale="en"><PersonaProvider><FirstRun onFinish={vi.fn()} /></PersonaProvider></I18nProvider>)
      fireEvent.click(await screen.findByRole('button', { name: en['first.skip'] }))
      await screen.findByText(en[key])
      expect(screen.queryByText(en['first.exec.state.found']), 'signed in never promotes Fabric connectivity').toBeNull()
      fireEvent.click(screen.getByRole('button', { name: en['first.exec.continueWithout'] }))
      await screen.findByText(en['first.start.lede'])
      cleanup()
    }
  })
  it('treats an older bridge with no status as unknown, and ignores a stale authenticated reply', async () => {
    let resolveOld!: (rows: ExecutorRow[]) => void
    const executors = vi.fn().mockImplementationOnce(() => new Promise<ExecutorRow[]>((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce([executor()])
    bridge({ start: { ...bridge().start, executors } })
    render(<I18nProvider locale="en"><PersonaProvider><FirstRun onFinish={vi.fn()} /></PersonaProvider></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: en['first.skip'] }))
    await waitFor(() => expect(executors).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: en['first.exec.recheck'] }))
    await screen.findByText(en['start.executor.auth.unknown'])
    await act(async () => { resolveOld([executor({ state: 'authenticated', method: 'claude.ai', reason: null })]) })
    expect(screen.queryByText(en['start.executor.auth.authenticated'])).toBeNull()
    expect(screen.getByText(en['start.executor.auth.unknown'])).toBeTruthy()
  })
  it('lets the operator continue while the auth check is pending and ignores its late answer after leaving', async () => {
    let answer!: (rows: ExecutorRow[]) => void
    const executors = vi.fn(() => new Promise<ExecutorRow[]>((resolve) => { answer = resolve }))
    bridge({ start: { ...bridge().start, executors } })
    render(<I18nProvider locale="en"><PersonaProvider><FirstRun onFinish={vi.fn()} /></PersonaProvider></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: en['first.skip'] }))
    await screen.findByText(en['first.exec.checking'])
    const next = screen.getByRole('button', { name: en['first.exec.continueWithout'] }) as HTMLButtonElement
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    await screen.findByText(en['first.start.lede'])
    await act(async () => { answer([executor({ state: 'authenticated', method: 'claude.ai', reason: null })]) })
    expect(screen.queryByText(en['first.exec.title'])).toBeNull()
    expect(screen.queryByText(en['start.executor.auth.authenticated'])).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['first.back'] }))
    await waitFor(() => expect(executors).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(en['start.executor.auth.authenticated']), 're-entry starts a fresh check, never reuses a skipped result').toBeNull()
  })
  // #endregion executor-auth-render-test
  it('is due only for a never-finished estate known to be empty', () => {
    expect(firstRunDue(null, [])).toBe(true)
    expect(firstRunDue(null, null), 'an unknown list is not an empty one').toBe(false)
    expect(firstRunDue(null, [{}]), 'an installation with projects is never walked back through it').toBe(false)
    expect(firstRunDue('2026-10-03T00:00:00Z', [])).toBe(false)
    expect(firstRunDue(undefined, []), 'settings from a main process that predates the first run never start it').toBe(false)
  })

  it('keeps the name and look, shows what the machine has, and finishes on the chosen path', async () => {
    const fabric = bridge()
    const onFinish = vi.fn()
    render(<I18nProvider locale="en"><PersonaProvider><FirstRun onFinish={onFinish} /></PersonaProvider></I18nProvider>)
    fireEvent.change(await screen.findByLabelText(new RegExp(en['first.persona.name'])), { target: { value: '  Atlas  ' } })
    expect(screen.getByText(en['first.persona.hello'].replace('{name}', 'Atlas'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['first.next'] }))
    await waitFor(() => expect(fabric.persona.save).toHaveBeenCalledWith({ seed: 731, style: 'orbit', name: 'Atlas' }))

    await screen.findByText(en['first.exec.title'])
    await screen.findByText(en['first.exec.found'].replace('{version}', '2.1.288'))
    expect(screen.getByText('npm install -g @openai/codex'), 'a missing agent shows its install command').toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['first.next'] }))

    await screen.findByText(en['first.start.title'].replace('{name}', 'Atlas'))
    fireEvent.click(screen.getByRole('button', { name: en['start.card.open.many'] }))
    expect(onFinish).toHaveBeenCalledWith('scan')
  })

  it('a look that was not saved says so and still lets the operator continue', async () => {
    bridge({ persona: { read: vi.fn(async () => ({ persona: { seed: 731, style: 'orbit' }, chosen: false })), save: vi.fn(async () => ({ persona: { seed: 731, style: 'orbit' }, saved: false, reason: 'disk full' })) } })
    render(<I18nProvider locale="en"><PersonaProvider><FirstRun onFinish={vi.fn()} /></PersonaProvider></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: en['first.next'] }))
    await screen.findByText(en['first.persona.notSaved'].replace('{reason}', 'disk full'))
    fireEvent.click(screen.getByRole('button', { name: en['first.persona.continueAnyway'] }))
    await screen.findByText(en['first.exec.title'])
  })

  it('with no coding agent found, says so and still continues', async () => {
    bridge({ start: { ...bridge().start, executors: vi.fn(async () => [{ id: 'claude-code', label: 'Claude Code', connected: true, state: 'unresponsive', version: null, path: '/bin/claude', install: null }]) } })
    render(<I18nProvider locale="en"><PersonaProvider><FirstRun onFinish={vi.fn()} /></PersonaProvider></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: en['first.skip'] }))
    await screen.findByText(en['first.exec.unresponsive'].replaceAll('{program}', 'claude'))
    expect(screen.queryByRole('button', { name: en['first.exec.copy'] }), 'an installed agent that did not answer is not told to install it').toBeNull()
    expect(screen.getByRole('button', { name: en['first.exec.continueWithout'] })).toBeTruthy()
  })
})

describe('add a project (SCN-127)', () => {
  it('reads the chosen folder, then creates the Project with it attached under the confirmed name', async () => {
    const fabric = bridge()
    const h = start('add')
    fireEvent.click(screen.getByRole('button', { name: en['start.add.choose'] }))
    const name = await screen.findByLabelText(en['start.name.label'])
    expect((name as HTMLInputElement).value).toBe('alpha')
    fireEvent.change(name, { target: { value: 'Alpha service' } })
    fireEvent.click(screen.getByRole('button', { name: en['start.add.create'] }))
    await waitFor(() => expect(fabric.projects.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha service', repoPaths: ['/w/alpha'] })))
    await waitFor(() => expect(h.onCreated).toHaveBeenCalled())
  })

  it('a folder already in a project offers that project', async () => {
    bridge({ start: { ...bridge().start, inspect: vi.fn(async () => repo({ path: '/w/alpha', name: 'alpha', importedBy: [{ id: 'p1', name: 'Alpha' }] })) } })
    const h = start('add')
    fireEvent.click(screen.getByRole('button', { name: en['start.add.choose'] }))
    await screen.findByText(en['start.add.already'].replace('{names}', 'Alpha'))
    expect(screen.queryByRole('button', { name: en['start.add.create'] }), 'no duplicate Project is offered').toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['start.add.openExisting'] }))
    expect(h.onOpenProject).toHaveBeenCalledWith('p1')
  })

  it('a failed create says why and keeps the folder, and a retry is the same create (same id)', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('stack down')).mockImplementation(async (i: { id: string }) => ({ id: i.id }))
    bridge({ projects: { create } })
    start('add')
    fireEvent.click(screen.getByRole('button', { name: en['start.add.choose'] }))
    fireEvent.click(await screen.findByRole('button', { name: en['start.add.create'] }))
    await screen.findByText(en['start.add.failed'].replace('{reason}', 'stack down'))
    fireEvent.click(screen.getByRole('button', { name: en['start.add.create'] }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
    expect(create.mock.calls[0][0].id).toBe(create.mock.calls[1][0].id)
  })
})

describe('scan a projects folder (SCN-128)', () => {
  const scan: ScanView = {
    root: '/w', visited: 9, unreadable: 0, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-03T00:00:00Z',
    candidates: [
      repo({ path: '/w/a', name: 'a', group: '/w/a' }),
      repo({ path: '/w/_wt/a-fix', name: 'a-fix', kind: 'worktree', parent: '/w/a', group: '/w/a' }),
      repo({ path: '/w/b', name: 'b', group: '/w/b', importedBy: [{ id: 'pb', name: 'Bee' }] }),
      repo({ path: '/w/c', name: 'c', group: '/w/c' })
    ]
  }

  it('creates nothing until ticked, then one Project per ticked repository; an imported one cannot be ticked', async () => {
    const fabric = bridge({ start: { ...bridge().start, scan: vi.fn(async () => scan) } })
    const h = start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    await screen.findByText(en['start.scan.group'].replace('{name}', 'a').replace('{count}', '2'))
    expect(fabric.projects.create).not.toHaveBeenCalled()
    const row = (name: string) => screen.getByText(name, { selector: 'b' }).closest('label') as HTMLElement
    expect((within(row('b')).getByRole('checkbox') as HTMLInputElement).disabled, 'an imported repository cannot be ticked again').toBe(true)
    fireEvent.click(within(row('a')).getByRole('checkbox'))
    fireEvent.click(within(row('c')).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.import'].replace('{count}', '2') }))
    await waitFor(() => expect(fabric.projects.create).toHaveBeenCalledTimes(2))
    expect(fabric.projects.create.mock.calls.map((c) => c[0].repoPaths)).toEqual([['/w/a'], ['/w/c']])
    await waitFor(() => expect(h.onProjectsChanged, 'the sidebar is told new projects exist').toHaveBeenCalled())
    await screen.findByText(en['start.scan.importedAll'].replace('{ok}', '2'))
  })

  it('says when the walk was stopped by its bound', async () => {
    bridge({ start: { ...bridge().start, scan: vi.fn(async () => ({ ...scan, truncated: true })) } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    await screen.findByText(en['start.scan.truncated'].replace('{visited}', '9'))
  })

  it('a failed import of one repository is reported and stays ticked for a retry', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('no')).mockImplementation(async (i: { id: string }) => ({ id: i.id }))
    bridge({ start: { ...bridge().start, scan: vi.fn(async () => scan) }, projects: { create } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    const row = async (name: string) => (await screen.findByText(name, { selector: 'b' })).closest('label') as HTMLElement
    fireEvent.click(within(await row('a')).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.import'].replace('{count}', '1') }))
    await screen.findByText(en['start.scan.importedSome'].replace('{ok}', '0').replace('{failed}', '1'))
    expect((within(await row('a')).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })
})

// 0.3.3 onboarding R2: a scanned project arrives with what its repository says it is.
describe('a scanned project arrives with its own description as its purpose', () => {
  const scan: ScanView = {
    root: '/w', visited: 3, unreadable: 0, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-08T00:00:00Z',
    candidates: [
      repo({ path: '/w/a', name: 'a', group: '/w/a', summary: 'A ledger for agent teams', summaryFile: 'package.json' }),
      repo({ path: '/w/c', name: 'c', group: '/w/c', summary: null })
    ]
  }

  it('shows it under the name, and sends it as the purpose; a repository that says nothing gets none', async () => {
    const fabric = bridge({ start: { ...bridge().start, scan: vi.fn(async () => scan) } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    await screen.findByText('A ledger for agent teams')
    const row = (name: string) => screen.getByText(name, { selector: 'b' }).closest('label') as HTMLElement
    fireEvent.click(within(row('a')).getByRole('checkbox'))
    fireEvent.click(within(row('c')).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.import'].replace('{count}', '2') }))
    await waitFor(() => expect(fabric.projects.create).toHaveBeenCalledTimes(2))
    const calls = fabric.projects.create.mock.calls.map((c) => c[0] as { name: string; purpose?: string })
    expect(calls.find((c) => c.name === 'a')?.purpose).toBe('From package.json: A ledger for agent teams')
    expect(calls.find((c) => c.name === 'c')?.purpose, 'no description is no purpose, never an invented one').toBeUndefined()
  })
})

describe('after a scan: set the first one up with the agent (plan R3a)', () => {
  it('offers it beside Open the first one, and hands over the first created project', async () => {
    const scan: ScanView = { root: '/w', visited: 1, unreadable: 0, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-08T00:00:00Z',
      candidates: [repo({ path: '/w/a', name: 'a', group: '/w/a' })] }
    bridge({ start: { ...bridge().start, scan: vi.fn(async () => scan) } })
    const onSetUp = vi.fn()
    const handlers = { onPath: vi.fn(), onCreated: vi.fn(), onOpenProject: vi.fn(), onHome: vi.fn(), onProjectsChanged: vi.fn(), onSetUp }
    render(<I18nProvider locale="en"><StartScreen path="scan" projects={[] as never} {...handlers} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    fireEvent.click(within((await screen.findByText('a', { selector: 'b' })).closest('label') as HTMLElement).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.import'].replace('{count}', '1') }))
    fireEvent.click(await screen.findByRole('button', { name: en['start.scan.setUpFirst'].replace('{name}', 'a') }))
    expect(onSetUp).toHaveBeenCalledTimes(1)
    expect(typeof onSetUp.mock.calls[0][0]).toBe('string')
    expect(handlers.onCreated, 'setting up is not merely opening').not.toHaveBeenCalled()
  })
})

describe('the four actions of the onboarding (REQ-01, REQ-05, REQ-07)', () => {
  it('the menu is two pairs — Agent: create, adapt; Project: open (one folder or a folder of them), create — and no role agent', () => {
    bridge()
    const h = start('menu')
    const agent = screen.getByRole('region', { name: en['start.pair.agent'] })
    const project = screen.getByRole('region', { name: en['start.pair.project'] })
    expect(within(agent).getAllByRole('button').map((b) => b.textContent)).toEqual([en['start.card.agent.go'], en['start.card.convert.go']])
    expect(within(project).getAllByRole('button').map((b) => b.textContent)).toEqual([en['start.card.open.one'], en['start.card.open.many'], en['start.card.new.go']])
    fireEvent.click(within(project).getByRole('button', { name: en['start.card.open.one'] }))
    fireEvent.click(within(agent).getByRole('button', { name: en['start.card.convert.go'] }))
    expect(h.onPath.mock.calls.map((c) => c[0])).toEqual(['add', 'convert'])
  })
})

describe('create an ecosystem agent (SCN-136, REQ-02)', () => {
  const fill = async (name = 'support-desk', purpose = 'Reads support mail and drafts replies') => {
    fireEvent.change(await screen.findByLabelText(en['start.createAgent.name'], { exact: false }), { target: { value: name } })
    fireEvent.change(screen.getByLabelText(en['start.createAgent.purpose'], { exact: false }), { target: { value: purpose } })
    fireEvent.click(screen.getByRole('button', { name: en['start.createAgent.whereChoose'] }))
    await screen.findByText('/w/' + name)
  }

  it('makes the folder as a git repository, a Project whose purpose is the sentence, and opens the coding agent\'s console with the build instruction', async () => {
    const fabric = bridge({ start: { ...bridge().start, createFolder: vi.fn(async () => ({ ok: true, path: '/w/support-desk' })) } })
    const h = start('agent')
    await fill()
    await ready()
    fireEvent.click(createBtn())
    await waitFor(() => expect(fabric.windows.openSession).toHaveBeenCalledWith('s1'))
    expect(fabric.start.createFolder).toHaveBeenCalledWith({ parent: '/w', name: 'support-desk', git: true })
    expect(fabric.projects.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'support-desk', purpose: 'Reads support mail and drafts replies', repoPaths: ['/w/support-desk'] }))
    const run = fabric.tasks.start.mock.calls[0][0] as { optionId: string; instruction: string; preset: string }
    expect(run.optionId, 'the first available coding agent is chosen').toBe('claude-code')
    expect(run.preset).toBe('create-agent')
    expect(run.instruction).toContain('creating-fabric-agents')
    expect(run.instruction).toContain('Reads support mail and drafts replies')
    expect(h.onCreated).toHaveBeenCalledWith(fabric.projects.create.mock.calls[0][0].id)
  })

  const createBtn = () => screen.getByRole('button', { name: new RegExp('^(' + [en['start.createAgent.create'], en['start.createAgent.retry']].join('|') + ')$') })
  const ready = () => waitFor(() => expect(createBtn().getAttribute('aria-disabled')).toBe('false'))

  it('a retry after a failed launch reuses the folder, the Project id and the task id — never a second of any', async () => {
    const start_ = vi.fn().mockRejectedValueOnce(new Error('spawn failed')).mockResolvedValue({ session: { sessionId: 's2' } })
    const fabric = bridge({ tasks: { start: start_ } })
    start('agent')
    await fill()
    await ready()
    fireEvent.click(createBtn())
    await screen.findByText(/spawn failed/)
    expect(screen.getByText(en['start.createAgent.madeKept'].replace('{path}', '/w/new-thing'))).toBeTruthy()
    expect((screen.getByLabelText(en['start.createAgent.name']) as HTMLInputElement).disabled, 'the made folder fixes the name').toBe(true)
    expect((screen.getByLabelText(en['start.createAgent.purpose']) as HTMLInputElement).disabled, 'the Project and the task hold the sentence').toBe(true)
    expect(createBtn().textContent).toBe(en['start.createAgent.retry'])
    expect((screen.getByLabelText(en['start.builder.label']) as HTMLSelectElement).disabled, 'the task may be recorded with this agent').toBe(true)
    fireEvent.click(createBtn())
    await waitFor(() => expect(fabric.windows.openSession).toHaveBeenCalledWith('s2'))
    expect(fabric.start.createFolder).toHaveBeenCalledTimes(1)
    expect(new Set(fabric.projects.create.mock.calls.map((c) => (c[0] as { id: string }).id)).size).toBe(1)
    const tasks = start_.mock.calls.map((c) => (c[0] as { taskId: string }).taskId)
    expect(tasks).toHaveLength(2)
    expect(typeof tasks[0], 'the caller names the task').toBe('string')
    expect(tasks[0]).toBe(tasks[1])
  })

  it('a console that did not come forward is brought forward again on retry — the task is not started twice', async () => {
    const open = vi.fn().mockRejectedValueOnce(new Error('window refused')).mockResolvedValue(undefined)
    const fabric = bridge({ windows: { openSession: open } })
    start('agent')
    await fill()
    await ready()
    fireEvent.click(createBtn())
    await screen.findByText(/window refused/)
    fireEvent.click(createBtn())
    await waitFor(() => expect(open).toHaveBeenCalledTimes(2))
    expect(fabric.tasks.start).toHaveBeenCalledTimes(1)
    expect(open.mock.calls.map((c) => c[0])).toEqual(['s1', 's1'])
  })

  it('Start over is a new attempt: a new name, a new folder, a new Project id', async () => {
    const fabric = bridge({ tasks: { start: vi.fn().mockRejectedValueOnce(new Error('spawn failed')).mockResolvedValue({ session: { sessionId: 's3' } }) } })
    start('agent')
    await fill()
    await ready()
    fireEvent.click(createBtn())
    await screen.findByText(/spawn failed/)
    fireEvent.click(screen.getByRole('button', { name: en['start.createAgent.startOver'] }))
    expect((screen.getByLabelText(en['start.builder.label']) as HTMLSelectElement).disabled).toBe(false)
    const field = screen.getByLabelText(en['start.createAgent.name']) as HTMLInputElement
    expect(field.disabled).toBe(false)
    fireEvent.change(field, { target: { value: 'support-desk-2' } })
    await ready()
    fireEvent.click(createBtn())
    await waitFor(() => expect(fabric.windows.openSession).toHaveBeenCalledWith('s3'))
    expect(fabric.start.createFolder.mock.calls.map((c) => ((c as unknown[])[0] as { name: string }).name)).toEqual(['support-desk', 'support-desk-2'])
    const ids = fabric.projects.create.mock.calls.map((c) => (c[0] as { id: string }).id)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('an empty or unusable name, and a missing place, are said once Create is pressed; nothing is made', async () => {
    const fabric = bridge()
    start('agent')
    fireEvent.change(await screen.findByLabelText(en['start.createAgent.name']), { target: { value: 'a/b' } })
    expect(screen.getByText(new RegExp('^' + en['start.createAgent.nameInvalid'].split('{detail}')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy()
    fireEvent.click(createBtn())
    expect(await screen.findByText(en['start.createAgent.purposeEmpty'])).toBeTruthy()
    expect(screen.getByText(en['start.createAgent.whereEmpty'])).toBeTruthy()
    expect(fabric.start.createFolder).not.toHaveBeenCalled()
  })

  it('with no coding agent that can start, each one says why', async () => {
    bridge({ start: { ...bridge().start, executors: vi.fn(async () => [
      { id: 'claude-code', label: 'Claude Code', connected: false, state: 'unresponsive', version: null, path: '/bin/claude', install: null },
      { id: 'codex', label: 'Codex', connected: false, state: 'missing', version: null, path: null, install: 'npm install -g @openai/codex' }
    ]) } })
    start('agent')
    expect(await screen.findByText(en['start.builder.noneReady'])).toBeTruthy()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      en['start.builder.unresponsive'].replace('{name}', 'Claude Code'), en['start.builder.missing'].replace('{name}', 'Codex')
    ])
  })

  it('Claude Code does not read the shared folder: skills found only there are missing for it, and the command covers it', async () => {
    const skills = vi.fn(async () => ({ ready: false, where: 'shared', version: '0.8.1', found: { 'creating-fabric-agents': true, 'adapting-projects-to-fabric': true }, command: 'npx @passioncode-ai/passioncode@latest update', launcherCovers: true }))
    bridge({ start: { ...bridge().start, adapterSkills: skills } })
    start('agent')
    await fill()
    expect(await screen.findByText(en['start.skills.missing'].replace('{agent}', 'Claude Code'))).toBeTruthy()
    expect(screen.queryByText(en['start.skills.notCovered'].replace(/\{agent\}/g, 'Claude Code'))).toBeNull()
    expect(createBtn().getAttribute('aria-disabled')).toBe('true')
  })

  it('an agent the install command does not cover is told so', async () => {
    const skills = vi.fn(async () => ({ ready: false, where: 'none', version: null, found: { 'creating-fabric-agents': false, 'adapting-projects-to-fabric': false }, command: 'npx @passioncode-ai/passioncode@latest update', launcherCovers: false }))
    bridge({ start: { ...bridge().start, adapterSkills: skills } })
    start('agent')
    await fill()
    expect(await screen.findByText(en['start.skills.notCovered'].replace(/\{agent\}/g, 'Claude Code'))).toBeTruthy()
  })

  it('without the adapter skills there is nothing to start: the command to copy, and Check again', async () => {
    const skills = vi.fn(async () => ({ ready: false, where: 'none', version: null, found: { 'creating-fabric-agents': false, 'adapting-projects-to-fabric': false }, command: 'npx @passioncode-ai/passioncode@latest update', launcherCovers: true }))
    const fabric = bridge({ start: { ...bridge().start, adapterSkills: skills } })
    start('agent')
    await fill()
    expect(await screen.findByText('npx @passioncode-ai/passioncode@latest update')).toBeTruthy()
    expect(createBtn().getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(createBtn())
    expect(fabric.start.createFolder, 'nothing is made without the skills').not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en['start.skills.checkAgain'] }))
    await waitFor(() => expect(skills.mock.calls.length).toBeGreaterThan(1))
  })
})

describe('0.3.3 verification, iteration 1: the agent paths', () => {
  const fill = async (name = 'support-desk', purpose = 'Reads support mail and drafts replies') => {
    fireEvent.change(await screen.findByLabelText(en['start.createAgent.name'], { exact: false }), { target: { value: name } })
    fireEvent.change(screen.getByLabelText(en['start.createAgent.purpose'], { exact: false }), { target: { value: purpose } })
    fireEvent.click(screen.getByRole('button', { name: en['start.createAgent.whereChoose'] }))
    await screen.findByText('/w/' + name)
  }
  const createBtn = () => screen.getByRole('button', { name: new RegExp('^(' + [en['start.createAgent.create'], en['start.createAgent.retry']].join('|') + ')$') })
  const ready = () => waitFor(() => expect(createBtn().getAttribute('aria-disabled')).toBe('false'))

  it('leaving the screen after the folder was made and coming back continues the same attempt (ER-4, DA-6)', async () => {
    const fabric = bridge({ projects: { create: vi.fn().mockRejectedValueOnce(new Error('stack down')).mockImplementation(async (i: { id: string; name: string }) => ({ id: i.id, name: i.name })) } })
    start('agent')
    await fill()
    await ready()
    fireEvent.click(createBtn())
    await screen.findByText(/stack down/)
    expect(screen.getByText(en['start.createAgent.madeKeptFolder'].replace('{path}', '/w/new-thing')), 'no Project was made: the copy says only the folder').toBeTruthy()
    cleanup()
    start('agent')
    expect(await screen.findByText(/stack down/), 'the failure is still said on return').toBeTruthy()
    expect((screen.getByLabelText(en['start.createAgent.name']) as HTMLInputElement).value).toBe('support-desk')
    await ready()
    fireEvent.click(createBtn())
    await waitFor(() => expect(fabric.windows.openSession).toHaveBeenCalledWith('s1'))
    expect(fabric.start.createFolder, 'never a second folder').toHaveBeenCalledTimes(1)
    const ids = fabric.projects.create.mock.calls.map((c) => (c[0] as { id: string }).id)
    expect(new Set(ids).size).toBe(1)
  })

  it('a coding agent that failed to start can be swapped: a new task in the same Project (ER-3)', async () => {
    const begin = vi.fn().mockRejectedValueOnce(new Error('spawn failed')).mockResolvedValue({ session: { sessionId: 's9' } })
    const fabric = bridge({ tasks: { start: begin } })
    start('agent')
    await fill()
    await ready()
    fireEvent.click(createBtn())
    await screen.findByText(/spawn failed/)
    expect((screen.getByLabelText(en['start.builder.label']) as HTMLSelectElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en['start.builder.another'] }))
    expect((screen.getByLabelText(en['start.builder.label']) as HTMLSelectElement).disabled).toBe(false)
    await ready()
    fireEvent.click(createBtn())
    await waitFor(() => expect(fabric.windows.openSession).toHaveBeenCalledWith('s9'))
    const calls = begin.mock.calls.map((c) => c[0] as { projectId: string; taskId: string })
    expect(calls[0].projectId).toBe(calls[1].projectId)
    expect(calls[0].taskId).not.toBe(calls[1].taskId)
  })

  it('a session that started but whose console did not open is not called "not created" (UX-5)', async () => {
    bridge({ windows: { openSession: vi.fn().mockRejectedValueOnce(new Error('window refused.')).mockResolvedValue(undefined) } })
    start('agent')
    await fill()
    await ready()
    fireEvent.click(createBtn())
    expect(await screen.findByText(en['start.consoleNotOpened'].replace('{reason}', 'window refused'))).toBeTruthy()
    expect(screen.queryByText(/The agent was not created/)).toBeNull()
  })

  it('a press that cannot go says what is missing (UX-3)', async () => {
    const skills = vi.fn(async () => ({ ready: false, where: 'none', version: null, found: { 'creating-fabric-agents': false, 'adapting-projects-to-fabric': false }, command: 'npx @passioncode-ai/passioncode@latest update', launcherCovers: true }))
    bridge({ start: { ...bridge().start, adapterSkills: skills } })
    start('agent')
    await fill()
    await screen.findByText('npx @passioncode-ai/passioncode@latest update')
    fireEvent.click(createBtn())
    expect(await screen.findByText(en['start.blocked.skills'])).toBeTruthy()
  })

  it('a failed read of the coding agents says so in words and can be tried again (UX-4)', async () => {
    const executors = vi.fn().mockRejectedValueOnce(new Error('probe crashed')).mockResolvedValue([{ id: 'claude-code', label: 'Claude Code', connected: true, state: 'found', version: '2', path: '/bin/claude', install: null }])
    bridge({ start: { ...bridge().start, executors } })
    start('agent')
    expect(await screen.findByText(en['start.builder.failed'].replace('{reason}', 'probe crashed'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['start.createAgent.retry'] }))
    expect(await screen.findByLabelText(en['start.builder.label'])).toBeTruthy()
  })

  it('a folder picker that fails is said, not swallowed (ER-8)', async () => {
    bridge({ start: { ...bridge().start, chooseFolder: vi.fn(async () => { throw new Error('dialog busy') }) } })
    start('agent')
    fireEvent.click(await screen.findByRole('button', { name: en['start.createAgent.whereChoose'] }))
    expect(await screen.findByText(en['start.pickFailed'].replace('{reason}', 'dialog busy'))).toBeTruthy()
  })

  it('the hint says how the coding agent was chosen: the fallback order, or the first found (UX-1)', async () => {
    bridge()
    start('agent')
    expect(await screen.findByText(new RegExp(en['start.builder.fromFound'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy()
    cleanup()
    bridge({ settings: { read: vi.fn(async () => ({ runnerFallback: { order: [{ runner: 'claude-code', session: 'new' }] } })) } })
    start('agent')
    expect(await screen.findByText(new RegExp(en['start.builder.fromOrder'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy()
  })
})

describe('adapt an existing agent (SCN-131, REQ-03)', () => {
  it('reads the folder, adapts it in the Project that already holds it, and opens the console with the adapt instruction', async () => {
    const fabric = bridge({ start: { ...bridge().start, inspect: vi.fn(async (): Promise<FolderView> => ({ ...repo({ path: '/w/old-bot', name: 'old-bot' }), importedBy: [{ id: 'p9', name: 'Old bot' }] })) } })
    const h = start('convert')
    fireEvent.click(screen.getByRole('button', { name: en['start.convert.choose'] }))
    await screen.findByText(en['start.convert.already'].replace('{name}', 'Old bot'))
    await waitFor(() => expect(screen.getByRole('button', { name: en['start.convert.start'] }).getAttribute('aria-disabled')).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: en['start.convert.start'] }))
    await waitFor(() => expect(fabric.windows.openSession).toHaveBeenCalledWith('s1'))
    expect(fabric.projects.create, 'no second Project for a folder already held').not.toHaveBeenCalled()
    const run = fabric.tasks.start.mock.calls[0][0] as { projectId: string; instruction: string; preset: string }
    expect([run.projectId, run.preset]).toEqual(['p9', 'adapt-agent'])
    expect(run.instruction).toMatch(/adapting-projects-to-fabric/)
    expect(run.instruction, 'the original state is committed before any change').toMatch(/first commit of the folder as it is/)
    expect(run.instruction, 'secrets stay out of that commit and are named (DA-7)').toMatch(/looks like a secret[\s\S]*\.gitignore/)
    expect(run.instruction, 'the branch comes off the current one, never main by name').toMatch(/from the current branch/)
    expect(run.instruction).not.toMatch(/\bmain\b/)
    expect(h.onCreated).toHaveBeenCalledWith('p9')
  })

  it('Choose another folder is another attempt: another Project id, another task', async () => {
    let n = 0
    const fabric = bridge({
      start: { ...bridge().start, inspect: vi.fn(async (): Promise<FolderView> => ({ ...repo({ path: `/w/bot-${++n}`, name: `bot-${n}` }) })) },
      tasks: { start: vi.fn().mockRejectedValueOnce(new Error('spawn failed')).mockResolvedValue({ session: { sessionId: 's4' } }) }
    })
    start('convert')
    fireEvent.click(screen.getByRole('button', { name: en['start.convert.choose'] }))
    await waitFor(() => expect(screen.getByRole('button', { name: en['start.convert.start'] }).getAttribute('aria-disabled')).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: en['start.convert.start'] }))
    await screen.findByText(/spawn failed/)
    fireEvent.click(screen.getByRole('button', { name: en['start.convert.other'] }))
    await screen.findByText('/w/bot-2')
    await waitFor(() => expect(screen.getByRole('button', { name: en['start.convert.start'] }).getAttribute('aria-disabled')).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: en['start.convert.start'] }))
    await waitFor(() => expect(fabric.windows.openSession).toHaveBeenCalledWith('s4'))
    const ids = fabric.projects.create.mock.calls.map((c) => (c[0] as { id: string }).id)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
    const tasks = fabric.tasks.start.mock.calls.map((c) => (c[0] as { taskId: string }).taskId)
    expect(tasks[0]).not.toBe(tasks[1])
  })

  it('a folder not yet held becomes a Project named after it, with what it says it is as the purpose', async () => {
    const fabric = bridge({ start: { ...bridge().start, inspect: vi.fn(async (): Promise<FolderView> => ({ ...repo({ path: '/w/mail-bot', name: 'mail-bot', summary: 'Sorts mail', summaryFile: 'README.md' }) })) } })
    start('convert')
    fireEvent.click(screen.getByRole('button', { name: en['start.convert.choose'] }))
    await waitFor(() => expect(screen.getByRole('button', { name: en['start.convert.start'] }).getAttribute('aria-disabled')).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: en['start.convert.start'] }))
    await waitFor(() => expect(fabric.projects.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'mail-bot', purpose: 'From README.md: Sorts mail', repoPaths: ['/w/mail-bot'] })))
  })
})

describe('iteration 1 fixes', () => {
  it('a found agent Fabric cannot drive is "installed", never "ready"', async () => {
    bridge({ start: { ...bridge().start, executors: vi.fn(async () => [{ id: 'codex', label: 'Codex', connected: false, state: 'found', version: '0.159.3', path: '/bin/codex', install: null }]) } })
    render(<I18nProvider locale="en"><PersonaProvider><FirstRun onFinish={vi.fn()} /></PersonaProvider></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: en['first.skip'] }))
    await screen.findByText(en['first.exec.unconnected'].replace('{name}', 'Codex'))
    expect(screen.queryByText(en['first.exec.state.found'])).toBeNull()
    expect(screen.getByRole('button', { name: en['first.exec.continueWithout'] }), 'no agent Fabric can drive: the continue says so').toBeTruthy()
  })

  it('"Tick all shown" ticks one Project per product, never a worktree; ticking a part warns', async () => {
    const scan: ScanView = { root: '/w', visited: 3, unreadable: 2, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-03T00:00:00Z', candidates: [
      repo({ path: '/w/a', name: 'a', group: '/w/a' }),
      repo({ path: '/w/_wt/a-fix', name: 'a-fix', kind: 'worktree', parent: '/w/a', group: '/w/a' })
    ] }
    const fabric = bridge({ start: { ...bridge().start, scan: vi.fn(async () => scan) } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    await screen.findByText(en['start.scan.unreadable'].replace('{count}', '2'))
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.selectAll'] }))
    const row = (name: string) => screen.getByText(name, { selector: 'b' }).closest('label') as HTMLElement
    expect((within(row('a')).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    expect((within(row('a-fix')).getByRole('checkbox') as HTMLInputElement).checked, 'a worktree is not ticked by Tick all').toBe(false)
    fireEvent.click(within(row('a-fix')).getByRole('checkbox'))
    expect(screen.getByText(en['start.scan.partWarning'])).toBeTruthy()
    void fabric
  })

  it('Scan again goes through the picker, offering the last folder; the error text loses Electron\'s wrapper', async () => {
    const chooseFolder = vi.fn(async () => '/w')
    const scanFn = vi.fn().mockResolvedValueOnce({ root: '/w', visited: 1, unreadable: 0, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-03T00:00:00Z', candidates: [repo({})] })
      .mockRejectedValueOnce(new Error("Error invoking remote method 'start:scan': Error: that file is outside every folder open in Fabric: /x"))
    bridge({ start: { ...bridge().start, chooseFolder, scan: scanFn } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    fireEvent.click(await screen.findByRole('button', { name: en['start.scan.again'] }))
    await waitFor(() => expect(chooseFolder).toHaveBeenLastCalledWith('scan', '/w'))
    await screen.findByText(en['start.scan.failed'].replace('{reason}', 'that file is outside every folder open in Fabric: /x'))
  })
})

describe('iteration 2 fixes', () => {
  const scanOf = (over: Partial<ScanView>): ScanView => ({ root: '/w', visited: 3, unreadable: 0, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-03T00:00:00Z', candidates: [], ...over })

  it('arriving on a path moves focus to its heading', async () => {
    bridge()
    start('scan')
    expect(document.activeElement?.textContent).toBe(en['start.scan.title'])
  })

  it('folders deeper than the scan goes are said, even when nothing was found', async () => {
    bridge({ start: { ...bridge().start, scan: vi.fn(async () => scanOf({ deep: 7 })) } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    expect(await screen.findByText(en['start.scan.deep'].replace('{count}', '7'))).toBeTruthy()
    expect(screen.getByText(en['start.scan.none'])).toBeTruthy()
  })

  it('Stop leaves "scanning" at once, and a late answer does not come back', async () => {
    let answer!: (v: ScanView) => void
    const cancelScan = vi.fn(async () => undefined)
    bridge({ start: { ...bridge().start, cancelScan, scan: vi.fn(() => new Promise<ScanView>((r) => { answer = r })) } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    fireEvent.click(await screen.findByRole('button', { name: en['start.scan.stop'] }))
    expect(screen.getByText(en['start.scan.stopped'])).toBeTruthy()
    expect(cancelScan).toHaveBeenCalled()
    answer(scanOf({ candidates: [repo({ path: '/w/late', name: 'late', group: '/w/late' })] }))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText('late', { selector: 'b' }), 'the stuck scan answering late does not replace the stopped screen').toBeNull()
  })

  it('a kept list that cannot be read is said, not dropped', async () => {
    bridge({ start: { ...bridge().start, lastScan: vi.fn(async () => { throw new Error("Error invoking remote method 'start:lastScan': Error: unreadable") }) } })
    start('scan')
    expect((await screen.findByRole('alert')).textContent).toContain('The last scan could not be read: unreadable')
  })

  it('the menu counts products not yet added, never their worktrees or nested parts', async () => {
    bridge({ start: { ...bridge().start, lastScan: vi.fn(async () => scanOf({ candidates: [
      repo({ path: '/w/a', name: 'a', group: '/w/a' }),
      repo({ path: '/w/_wt/a-fix', name: 'a-fix', kind: 'worktree', parent: '/w/a', group: '/w/a' }),
      repo({ path: '/w/a/packages/t', name: 't', group: '/w/a' })
    ] })) } })
    start('menu')
    expect(await screen.findByRole('button', { name: en['start.card.open.manyPending'].replace('{count}', '1') })).toBeTruthy()
  })

  it('a refused clipboard says so on the button', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
    bridge({ start: { ...bridge().start, adapterSkills: vi.fn(async () => ({ ready: false, where: 'none', version: null, found: { 'creating-fabric-agents': false, 'adapting-projects-to-fabric': false }, command: 'npx @passioncode-ai/passioncode@latest update' })) } })
    start('agent')
    fireEvent.click(await screen.findByRole('button', { name: en['first.exec.copy'] }))
    expect(await screen.findByRole('button', { name: en['first.exec.copyFailed'] })).toBeTruthy()
  })
})

describe('iteration 2 fixes, after the boundary branch', () => {
  it('linked folders the scan did not follow are counted and said', async () => {
    bridge({ start: { ...bridge().start, scan: vi.fn(async (): Promise<ScanView> => ({ root: '/w', visited: 3, unreadable: 0, deep: 0, symlinks: 2, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-03T00:00:00Z', candidates: [] })) } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    expect(await screen.findByText(en['start.scan.symlinks'].replace('{count}', '2'))).toBeTruthy()
  })

  it('a repository path main refused as not chosen in this window reads as a sentence, not a code', async () => {
    bridge({ projects: { create: vi.fn(async () => { throw new Error("Error invoking remote method 'projects:create': RepoPathRefused: repo-path-refused:not-chosen: /w/alpha") }) } })
    start('add')
    fireEvent.click(screen.getByRole('button', { name: en['start.add.choose'] }))
    fireEvent.click(await screen.findByRole('button', { name: en['start.add.create'] }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(en['start.repoRefused.not-chosen'].replace('{path}', '/w/alpha'))
    expect(alert.textContent).not.toContain('repo-path-refused')
  })
})

describe('iteration 3 fixes', () => {
  const scanOf = (over: Partial<ScanView>): ScanView => ({ root: '/w', visited: 3, unreadable: 0, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-03T00:00:00Z', candidates: [], ...over })

  it('a search with no match says so; the summary names parts only when there are some', async () => {
    bridge({ start: { ...bridge().start, scan: vi.fn(async () => scanOf({ candidates: [repo({ path: '/w/a', name: 'a', group: '/w/a' })] })) } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    expect(await screen.findByText(en['start.scan.summary'].replace('{count}', '1').replace('{folder}', '/w'), { exact: false })).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(en['start.scan.filter']), { target: { value: 'zzz' } })
    expect(screen.getByText(en['start.scan.noMatch'])).toBeTruthy()
  })

  it('an empty project name says why Add is greyed out, bound to the field', async () => {
    bridge()
    start('add')
    fireEvent.click(screen.getByRole('button', { name: en['start.add.choose'] }))
    const input = await screen.findByLabelText(en['start.name.label'])
    fireEvent.change(input, { target: { value: '  ' } })
    const problem = screen.getByText(en['start.name.empty'])
    expect(problem.className).toBe('field-problem')
    expect(input.getAttribute('aria-describedby')).toBe(problem.id)
  })

  it('Back waits while an import runs', async () => {
    let finish!: () => void
    bridge({
      start: { ...bridge().start, scan: vi.fn(async () => scanOf({ candidates: [repo({ path: '/w/a', name: 'a', group: '/w/a' })] })) },
      projects: { create: vi.fn(() => new Promise((r) => { finish = () => r({ id: 'p', name: 'a' }) })) }
    })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    fireEvent.click(await screen.findByRole('button', { name: en['start.scan.selectAll'] }))
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.import'].replace('{count}', '1') }))
    expect((await screen.findByRole('button', { name: en['start.back'] }) as HTMLButtonElement).disabled).toBe(true)
    finish()
    await waitFor(() => expect((screen.getByRole('button', { name: en['start.back'] }) as HTMLButtonElement).disabled).toBe(false))
  })
})

describe('iteration 3: every refusal main sends as a code is said in the window language', () => {
  const tr = ((k: string, v?: Record<string, string | number>) => Object.entries(v ?? {}).reduce((s, [a, b]) => s.replace(`{${a}}`, String(b)), (en as Record<string, string>)[k] ?? k)) as Parameters<typeof explainError>[1]
  it.each([
    ["Error invoking remote method 'start:inspect': FolderRefused: folder-refused:missing: /w/gone", en['start.folderRefused.missing'].replace('{path}', '/w/gone')],
    ["Error invoking remote method 'projects:create': Error: repo-path-refused:held-by-other: /w/a", en['start.repoRefused.held-by-other'].replace('{path}', '/w/a')],
    ["Error invoking remote method 'projects:create': Error: repo-path-refused:too-broad: /", en['start.repoRefused.too-broad'].replace('{path}', '/')],
    ["Error invoking remote method 'projects:create': Error: project-name-refused:text-direction", en['start.projectNameRefused.text-direction']],
    ["Error invoking remote method 'agents:create': Error: agent-name-refused:taken: Scout", en['agents.nameTaken'].replace('{name}', 'Scout')]
  ])('%s', (raw, said) => {
    expect(explainError(new Error(raw), tr)).toBe(said)
  })

  it('a scan that was not kept says so, and the import does not switch to another folder\'s list', async () => {
    const other = { root: '/elsewhere', visited: 1, unreadable: 0, deep: 0, symlinks: 0, kept: true, truncated: false, cancelled: false, scannedAt: '2026-10-02T00:00:00Z', candidates: [repo({ path: '/elsewhere/z', name: 'zzz', group: '/elsewhere/z' })] }
    bridge({ start: { ...bridge().start,
      lastScan: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(other),
      scan: vi.fn(async (): Promise<ScanView> => ({ root: '/w', visited: 1, unreadable: 0, deep: 0, symlinks: 0, kept: false, truncated: false, cancelled: false, scannedAt: '2026-10-03T00:00:00Z', candidates: [repo({ path: '/w/a', name: 'a', group: '/w/a' })] })) } })
    start('scan')
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.choose'] }))
    expect(await screen.findByText(en['start.scan.notKept'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.selectAll'] }))
    fireEvent.click(screen.getByRole('button', { name: en['start.scan.import'].replace('{count}', '1') }))
    await screen.findByText(en['start.scan.importedAll'].replace('{ok}', '1'))
    expect(screen.queryByText('zzz', { selector: 'b' }), 'another folder\'s kept list never replaces this scan').toBeNull()
  })
})
