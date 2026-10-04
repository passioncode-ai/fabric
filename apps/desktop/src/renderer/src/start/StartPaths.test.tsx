// The first run and the start paths (ADR-0100), driven through the real components with the bridge
// stubbed at its edge. Each case asserts what reaches the bridge — the act — not only what is drawn.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { PersonaProvider } from '../launch/persona'
import { FirstRun, firstRunDue } from './FirstRun'
import { StartScreen, explainError, type StartPath } from './StartPaths'
import type { CandidateView, ExecutorRow, FolderView, ScanView } from '../../../shared/startPaths.ts'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

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
      executors: vi.fn(async () => [
        { id: 'claude-code', label: 'Claude Code', connected: true, state: 'found', version: '2.1.288', path: '/bin/claude', install: null },
        { id: 'codex', label: 'Codex', connected: false, state: 'missing', version: null, path: null, install: 'npm install -g @openai/codex' }
      ])
    },
    projects: { create: vi.fn(async (input: { id: string; name: string; repoPaths?: string[] }) => ({ id: input.id, name: input.name })) },
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
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['start.card.scan.title']) }))
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

describe('agent paths (SCN-130, SCN-131)', () => {
  it('a new agent opens the chosen project\'s team, and with no project offers to make one', () => {
    bridge()
    const h = start('agent', [{ id: 'p1', name: 'One' }])
    fireEvent.click(screen.getByRole('button', { name: 'One' }))
    expect(h.onOpenProject).toHaveBeenCalledWith('p1', 'team')
    cleanup()
    start('agent', [])
    expect(screen.getByText(en['start.agent.noProject'])).toBeTruthy()
  })

  it('converting is shown as planned and offers no action that pretends to run', () => {
    bridge()
    start('convert')
    expect(screen.getByText(en['start.planned'])).toBeTruthy()
    // Back, and Copy for today's manual command — nothing that claims to convert.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([en['start.back'], en['first.exec.copy']])
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
    expect(await screen.findByText(en['start.card.scan.pending'].replace('{count}', '1'), { exact: false })).toBeTruthy()
  })

  it('a refused clipboard says so on the button', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
    bridge()
    start('convert')
    fireEvent.click(screen.getByRole('button', { name: en['first.exec.copy'] }))
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
