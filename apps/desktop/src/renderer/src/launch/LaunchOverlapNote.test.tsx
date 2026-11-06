// CO-522 wave A: what a start would run into is said before it starts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { checkLaunch, LaunchOverlapNote } from './LaunchOverlapNote'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const hit = (over: Record<string, unknown>) => ({ claimId: 'c1', taskId: 't1', taskTitle: 'Fix the login', heldBy: 's-1', agent: 'claude-code', since: new Date(Date.now() - 600_000).toISOString(), why: [], ...over })

describe('checkLaunch', () => {
  it('is clear when nobody works in the project, found otherwise, and unread when the read fails', async () => {
    const launchCheck = vi.fn()
      .mockResolvedValueOnce({ overlaps: [], alsoWorking: [], console: [] })
      .mockResolvedValueOnce({ overlaps: [hit({})], alsoWorking: [], console: [] })
      .mockRejectedValueOnce(new Error('the claims could not be read'))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { launchCheck } } }))
    expect(await checkLaunch('p1', 'x')).toEqual({ at: 'clear' })
    expect((await checkLaunch('p1', 'x', 't9')).at).toBe('found')
    expect(launchCheck).toHaveBeenLastCalledWith({ projectId: 'p1', taskId: 't9', text: 'x' })
    expect(await checkLaunch('p1', 'x')).toEqual({ at: 'unread', reason: 'the claims could not be read' })
  })
})

describe('LaunchOverlapNote', () => {
  it('names the overlapping session with why, the others in the project apart, and starts or waits as pressed', () => {
    const onStart = vi.fn(), onWait = vi.fn()
    render(<I18nProvider locale="en"><LaunchOverlapNote onStart={onStart} onWait={onWait} check={{ at: 'found', found: {
      overlaps: [hit({ why: [{ kind: 'overlap', mine: 'src/main/hub.ts', theirs: 'src/main' }] })],
      alsoWorking: [hit({ claimId: 'c2', taskTitle: 'Write the docs', heldBy: 's-2' })],
      console: ['s-1'] } }} /></I18nProvider>)
    expect(screen.getByText(en['launchCheck.title'])).toBeTruthy()
    expect(screen.getByText(en['launchCheck.alsoTitle'])).toBeTruthy()
    expect(screen.getByText(/both touch src\/main\/hub\.ts/)).toBeTruthy()
    expect(screen.getByText(/Write the docs/)).toBeTruthy()
    // Only a session Fabric holds a console for can be opened.
    expect(screen.getAllByRole('button', { name: en['launchCheck.open'] })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: en['launchCheck.start'] }))
    fireEvent.click(screen.getByRole('button', { name: en['launchCheck.wait'] }))
    expect(onStart).toHaveBeenCalledOnce()
    expect(onWait).toHaveBeenCalledOnce()
  })

  it('a check that could not be read is said, and starting stays possible', () => {
    const onStart = vi.fn()
    render(<I18nProvider locale="en"><LaunchOverlapNote onStart={onStart} onWait={() => {}} check={{ at: 'unread', reason: 'down' }} /></I18nProvider>)
    expect(screen.getByText(/Could not check who else works in this project: down/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['launchCheck.start'] }))
    expect(onStart).toHaveBeenCalledOnce()
  })
})
