// The seam between the preset rule and the screen (M121).
//
// `presets.test.ts` proves the rule: a data-backed preset with nothing behind it
// is not offered, and a truncated list says so. This suite proves the other
// half — that the rule reaches the operator — because a resolver nothing renders
// is a resolver that cannot be wrong in any way anybody notices.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { Tasks } from './Tasks'
import type { ProjectRow, TaskRow } from '../../shared/types'

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
