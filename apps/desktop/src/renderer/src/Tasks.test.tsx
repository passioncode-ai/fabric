// The seam between the preset rule and the screen (M121).
//
// `presets.test.ts` proves the rule: a data-backed preset with nothing behind it
// is not offered, and a truncated list says so. This suite proves the other
// half — that the rule reaches the operator — because a resolver nothing renders
// is a resolver that cannot be wrong in any way anybody notices.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Tasks } from './Tasks'
import type { ProjectRow, TaskRow } from '../../shared/types'
import type { TaskDraft } from '../../shared/taskDraft.ts'

afterEach(cleanup)

const project = { id: 'p1', name: 'Fabric', default_agent: 'claude-code' } as ProjectRow

const task = (over: Partial<TaskRow>): TaskRow =>
  ({ id: 't', project_id: 'p1', instruction: 'do it', title: 'Do it', status: 'backlog', task_type: null, ...over }) as TaskRow

const mount = (rows: TaskRow[], options: unknown[] = [{ id: 'claude-code', label: 'Claude Code', available: true, connectsToSurface: true, permissionModes: [] }], p: ProjectRow = project): void => {
  ;(window as unknown as { fabric: unknown }).fabric = {
    // M190 — the list now carries whether its finished half was cut short. The
    // stub mirrors the real shape rather than the old array, so a screen that
    // forgot to read the coverage would fail here rather than in production.
    tasks: { list: vi.fn().mockResolvedValue({ tasks: rows, closed: { truncated: false, says: 'all 0' } }) },
    // M125 — the form offers created agents beside the runners, so it reads
    // them. Added here because the suite failed loudly when it could not, which
    // is what a mock that mirrors a real dependency is for.
    agents: { list: vi.fn().mockResolvedValue([]) },
    terminal: {
      options: vi
        .fn()
        .mockResolvedValue(options)
    }
  }
  render(<Tasks project={p} onStarted={() => {}} onError={() => {}} feedMark={0} />)
}

describe('the shortcuts beside the blank field', () => {
  it('offers the constant presets whatever the project holds', async () => {
    mount([])
    await waitFor(() => expect(screen.getByText('Audit this project')).toBeTruthy())
  })

  it('does not offer "continue from the backlog" when the backlog is empty', async () => {
    mount([task({ status: 'done' })])
    // Wait for a preset that DOES depend on the read having happened, or this
    // asserts an absence against a screen that has not loaded yet and passes
    // for the wrong reason.
    await waitFor(() => expect(screen.getByText('Audit this project')).toBeTruthy())
    expect(screen.queryByText(/Continue from the backlog/)).toBeNull()
  })

  it('offers it WITH ITS COUNT when the backlog has something in it', async () => {
    mount([task({ id: 'a' }), task({ id: 'b' })])
    await waitFor(() => expect(screen.getByText('Continue from the backlog (2)')).toBeTruthy())
  })

  it('counts only what is open — a cancelled bug is not a known bug', async () => {
    mount([
      task({ id: 'x', task_type: 'bug', status: 'running' }),
      task({ id: 'y', task_type: 'bug', status: 'cancelled' })
    ])
    await waitFor(() => expect(screen.getByText('Known bugs (1)')).toBeTruthy())
  })
})

// Plan R3a (0.3.3 onboarding): setting a project up is a session the agent runs with tools it already holds.
describe('setting a project up with the agent', () => {
  it('is offered first, and its instruction asks the agent to record, ask and file — and to change no file', async () => {
    mount([])
    await waitFor(() => expect(screen.getByText('Set up this project with the agent')).toBeTruthy())
    const labels = [...document.querySelectorAll('button')].map((b) => b.textContent ?? '')
    expect(labels.indexOf('Set up this project with the agent')).toBeLessThan(labels.indexOf('Collect context'))
    const { en } = await import('./i18n/en')
    const text = en['tasks.presetSetupText']
    for (const tool of ['fabric_memory_remember', 'fabric_question_ask', 'fabric_task_create']) expect(text).toContain(tool)
    expect(text).toMatch(/Do not change any file/)
    // Every tool the instruction names is one a session is actually given.
    const { SURFACE_TOOLS } = await import('../../shared/surfaceTools')
    for (const tool of text.match(/fabric_[a-z_]+/g) ?? []) expect(SURFACE_TOOLS.map((x) => x.name), tool).toContain(tool)
    expect((screen.getByText('Set up this project with the agent').closest('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('is not offered to an agent that does not connect to Fabric\'s tools: it could record nothing (0.3.3 DA-3)', async () => {
    mount([], [{ id: 'codex', label: 'Codex', available: true, connectsToSurface: false, permissionModes: [] }], { ...project, default_agent: 'codex' })
    const button = (await screen.findByText('Set up this project with the agent')).closest('button') as HTMLButtonElement
    await waitFor(() => expect(button.disabled).toBe(true))
    expect(button.title).toMatch(/Codex has no connection to the tools of Fabric/)
  })
})

// CO-234 (ADR-0125 amendment 1): the fallback order's label previews the walk the launch will take. With the setup
// preset loaded the launch needs Fabric's tools and passes over Codex, so the label must not say «→ Codex».
describe('the fallback order with the setup preset', () => {
  it('names the agent the launch would choose, with the preset\'s needs', async () => {
    const options = [
      { id: 'codex', label: 'Codex', available: true, connectsToSurface: false, permissionModes: [] },
      { id: 'claude-code', label: 'Claude Code', available: true, connectsToSurface: true, permissionModes: [] }
    ]
    const selected = (runner: string, index: number) => ({ configured: true, walk: { state: 'selected', index, runner, session: 'spawned', sessionId: null, permissionMode: null, passedOver: [] } })
    // The machine side: Codex first in the order; a walk that needs the surface passes over it.
    let answerSetup!: () => void
    const setupRead = new Promise<void>((resolve) => { answerSetup = resolve })
    const fallback = vi.fn(async (_p: string, _k: string, _m: unknown, preset?: string | null) =>
      preset === 'setup' ? setupRead.then(() => selected('claude-code', 1)) : selected('codex', 0))
    ;(window as unknown as { fabric: unknown }).fabric = {
      tasks: { list: vi.fn().mockResolvedValue({ tasks: [], closed: { truncated: false, says: 'all 0' } }) },
      agents: { list: vi.fn().mockResolvedValue([]) },
      settings: { read: vi.fn().mockResolvedValue({ runnerFallback: { order: [{ runner: 'codex' }, { runner: 'claude-code' }] } }) },
      terminal: { options: vi.fn().mockResolvedValue(options), fallback }
    }
    const { useState } = await import('react')
    const { en } = await import('./i18n/en')
    const label = (agent: string) => en['agents.fallback.option'].replace('{agent}', agent)
    function Owner(): React.JSX.Element {
      const [draft, setDraft] = useState<TaskDraft | null>(null)
      return <Tasks project={project} draft={draft} onDraftChange={(patch) => setDraft((d) => ({ ...(d ?? {}), ...patch }) as TaskDraft)}
        onStarted={() => {}} onError={() => {}} feedMark={0} />
    }
    render(<Owner />)
    await waitFor(() => expect(screen.getByRole('option', { name: label('Codex') })).toBeTruthy())
    fireEvent.click(await screen.findByText('Set up this project with the agent'))
    // While the setup's walk is read, the label is pending — the reading for the preset-less launch is not shown for it.
    await waitFor(() => expect(screen.getByRole('option', { name: en['agents.fallback.optionPending'] })).toBeTruthy())
    expect(screen.queryByRole('option', { name: label('Codex') })).toBeNull()
    answerSetup()
    await waitFor(() => expect(screen.getByRole('option', { name: label('Claude Code') })).toBeTruthy())
    expect(screen.queryByRole('option', { name: label('Codex') })).toBeNull()
    expect(fallback).toHaveBeenLastCalledWith('p1', 'task', null, 'setup')
  })
})

// ADR-0160 §1 (0.3.7 wave 3): a shortcut pressed while the field holds the person's own words replaces them at once,
// no «replace?» banner, and one quiet line beneath offers the words back.
describe('a shortcut over the person’s own words', () => {
  it('replaces at once and offers the old words back', async () => {
    ;(window as unknown as { fabric: unknown }).fabric = {
      tasks: { list: vi.fn().mockResolvedValue({ tasks: [], closed: { truncated: false, says: 'all 0' } }) },
      agents: { list: vi.fn().mockResolvedValue([]) },
      terminal: { options: vi.fn().mockResolvedValue([{ id: 'claude-code', label: 'Claude Code', available: true, connectsToSurface: true, permissionModes: [] }]) }
    }
    const { useState } = await import('react')
    function Host(): React.JSX.Element {
      const [draft, setDraft] = useState<TaskDraft>({ instruction: 'my own careful words', preset: null, presetText: null })
      return <Tasks project={project} onStarted={() => {}} onError={() => {}} feedMark={0} draft={draft} onDraftChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
    }
    render(<Host />)
    await waitFor(() => expect(screen.getByText('Audit this project')).toBeTruthy())
    fireEvent.click(screen.getByText('Audit this project'))
    expect(screen.queryByText('Replace what you have written with this preset?')).toBeNull()
    expect(screen.queryByDisplayValue('my own careful words'), 'the shortcut replaced the words at once').toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Put my words back' }))
    expect(screen.getByDisplayValue('my own careful words')).toBeTruthy()
  })

  it('drops the offer once the person edits the loaded text, so a press cannot throw the edit away (CO-352)', async () => {
    ;(window as unknown as { fabric: unknown }).fabric = {
      tasks: { list: vi.fn().mockResolvedValue({ tasks: [], closed: { truncated: false, says: 'all 0' } }) },
      agents: { list: vi.fn().mockResolvedValue([]) },
      terminal: { options: vi.fn().mockResolvedValue([{ id: 'claude-code', label: 'Claude Code', available: true, connectsToSurface: true, permissionModes: [] }]) }
    }
    const { useState } = await import('react')
    function Host(): React.JSX.Element {
      const [draft, setDraft] = useState<TaskDraft>({ instruction: 'my own careful words', preset: null, presetText: null })
      return <Tasks project={project} onStarted={() => {}} onError={() => {}} feedMark={0} draft={draft} onDraftChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
    }
    const { container } = render(<Host />)
    await waitFor(() => expect(screen.getByText('Audit this project')).toBeTruthy())
    fireEvent.click(screen.getByText('Audit this project'))
    expect(screen.getByRole('button', { name: 'Put my words back' })).toBeTruthy()
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'the preset, now edited' } })
    expect(screen.queryByRole('button', { name: 'Put my words back' })).toBeNull()
    expect(screen.getByDisplayValue('the preset, now edited')).toBeTruthy()
  })
})
