import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GuideScreen, HelpScreen } from './HelpScreens'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import type { ProjectRow } from '../../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const atlas = { id: 'p1', name: 'Atlas', purpose: 'Team access without losing context', status: 'active' } as unknown as ProjectRow
const wrap = (node: React.ReactNode) => render(<I18nProvider locale="en">{node}</I18nProvider>)

describe('help (SCR-44)', () => {
  it('an example opens the conversation with its words in the composer, and nothing else', () => {
    const on = { onChat: vi.fn(), onGuide: vi.fn(), onBack: vi.fn(), onGo: vi.fn() }
    wrap(<HelpScreen projects={[atlas]} {...on} />)
    fireEvent.click(screen.getByRole('button', { name: en['launch.help.example.board'] }))
    expect(on.onChat).toHaveBeenCalledWith(en['launch.help.example.board'])
    fireEvent.click(screen.getByRole('button', { name: en['launch.help.example.find'].replace('{project}', 'Atlas') }))
    expect(on.onChat).toHaveBeenLastCalledWith('Find the project Atlas')
    fireEvent.click(screen.getByRole('button', { name: en['launch.help.continueGuide'].replace('{project}', 'Atlas') }))
    expect(on.onGuide).toHaveBeenCalledWith('p1')
    expect(document.body.textContent, 'a raw registry key reached the screen').not.toMatch(/launch\.help\./)
  })
})

describe('the first useful result (the launch guide)', () => {
  const mount = ({ tasks = [] as unknown[], agents = [] as unknown[], resolved = [] as unknown[], fileIdea = vi.fn(async () => ({})) } = {}) => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: {
      tasks: { list: vi.fn(async () => ({ tasks, closed: { truncated: false, says: '' } })), fileIdea },
      agents: { list: vi.fn(async () => agents) },
      board: { resolved: vi.fn(async () => ({ data: resolved })) }
    } }))
    wrap(<GuideScreen project={atlas} onChat={vi.fn()} onProject={vi.fn()} onDone={vi.fn()} />)
    return { fileIdea }
  }

  it('counts the path from what the estate holds', async () => {
    mount({ tasks: [{ id: 't', status: 'done' }], agents: [], resolved: [{ ref: 'q' }] })
    await waitFor(() => expect(screen.getByText(en['launch.guide.path'].replace('{done}', '3').replace('{total}', '4'))).toBeTruthy())
    expect(screen.queryByText(en['launch.guide.firstTask']), 'the first-task step was offered to a project that has one').toBeNull()
  })

  it('records the first task in the backlog, starting nothing, then counts it', async () => {
    const { fileIdea } = mount()
    await waitFor(() => expect(screen.getByText(en['launch.guide.path'].replace('{done}', '0').replace('{total}', '4'))).toBeTruthy())
    expect((screen.getByLabelText(en['launch.guide.instruction']) as HTMLTextAreaElement).value, 'the goal was not offered as the first instruction').toBe(atlas.purpose)
    fireEvent.click(screen.getByRole('button', { name: en['launch.guide.file'] }))
    await waitFor(() => expect(fileIdea).toHaveBeenCalledWith('p1', atlas.purpose))
    await waitFor(() => expect(screen.getByText(en['launch.guide.filed'])).toBeTruthy())
  })

  it('a task that could not be recorded says why and keeps the words', async () => {
    mount({ fileIdea: vi.fn(async () => { throw new Error('the estate refused it') }) })
    await waitFor(() => expect(screen.getByRole('button', { name: en['launch.guide.file'] })).toBeTruthy())
    fireEvent.change(screen.getByLabelText(en['launch.guide.instruction']), { target: { value: 'Ship the invite flow' } })
    fireEvent.click(screen.getByRole('button', { name: en['launch.guide.file'] }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/refused it/))
    expect((screen.getByLabelText(en['launch.guide.instruction']) as HTMLTextAreaElement).value).toBe('Ship the invite flow')
  })
})
