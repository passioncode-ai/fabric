// Opening a console inside Fabric (OF-03, SCN-172): the list of open consoles, and the context every "open the
// console" control asks. Inside the shell the console opens as a tab; outside it, in the separate window as before.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ProjectRow, TerminalSession } from '../../shared/types'
import {
  OpenConsoleContext,
  consoleTitleOf,
  neighbourOf,
  prunedConsoles,
  readOpenConsoles,
  useOpenConsole,
  withConsole,
  withoutConsole,
  writeOpenConsoles
} from './consoles'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear() })

const session = (sessionId: string, projectId = 'p1', cwd = '/Users/me/DATA/fabric-dashboards'): TerminalSession => ({
  sessionId, projectId, cwd, program: 'claude', optionId: 'claude-code', permissionMode: null, excerpt: '', written: 0,
  running: true, state: 'running', startedAt: '2026-10-19T10:00:00Z', lastActivityAt: '2026-10-19T10:00:00Z', tail: '', exitCode: null
} as TerminalSession)

describe('the list of open consoles', () => {
  it('keeps the order they were opened in, and never holds one twice', () => {
    let open: string[] = []
    open = withConsole(open, 's1')
    open = withConsole(open, 's2')
    open = withConsole(open, 's1')
    expect(open).toEqual(['s1', 's2'])
  })

  it('closing a tab takes that tab away and nothing else', () => {
    expect(withoutConsole(['s1', 's2', 's3'], 's2')).toEqual(['s1', 's3'])
  })

  it('after closing the console on screen, the tab beside it comes forward, else none', () => {
    expect(neighbourOf(['s1', 's2', 's3'], 's2')).toBe('s3')
    expect(neighbourOf(['s1', 's2', 's3'], 's3')).toBe('s2')
    expect(neighbourOf(['s1'], 's1')).toBeNull()
  })

  it('drops a tab whose session is gone only once that session had been seen', () => {
    const seen = new Set(['s1'])
    // s1 was seen and is no longer held: dismissed. s2 was opened before any list held it: kept.
    expect(prunedConsoles(['s1', 's2'], [session('s3')], seen)).toEqual(['s2'])
    // an unread list says nothing about any tab
    expect(prunedConsoles(['s1', 's2'], null, seen)).toEqual(['s1', 's2'])
  })

  it('names a tab by its project, else by its folder', () => {
    const projects = [{ id: 'p1', name: 'fabric-dashboards' }] as ProjectRow[]
    expect(consoleTitleOf(session('s1'), projects)).toBe('fabric-dashboards')
    expect(consoleTitleOf(session('s1', 'gone', '/w/site/'), projects)).toBe('site')
    expect(consoleTitleOf(undefined, projects)).toBeNull()
  })

  it('outlives a reload of the window, and a store that cannot be read is an empty list', () => {
    writeOpenConsoles(['s1', 's2'])
    expect(readOpenConsoles()).toEqual(['s1', 's2'])
    window.sessionStorage.setItem('fabric.consoles.v1', '{not json')
    expect(readOpenConsoles()).toEqual([])
  })
})

function Opener({ id }: { id: string }) {
  const open = useOpenConsole()
  return <button type="button" onClick={() => void open(id)}>open</button>
}

describe('every "open the console" control asks the shell', () => {
  it('inside the shell the console opens there, not in a window of its own', () => {
    const openSession = vi.fn(async () => {})
    vi.stubGlobal('window', Object.assign(window, { fabric: { windows: { openSession } } }))
    const shell = vi.fn(async () => {})
    render(<OpenConsoleContext.Provider value={shell}><Opener id="s1" /></OpenConsoleContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(shell).toHaveBeenCalledWith('s1')
    expect(openSession).not.toHaveBeenCalled()
  })

  it('outside the shell it falls back to the separate window', () => {
    const openSession = vi.fn(async () => {})
    vi.stubGlobal('window', Object.assign(window, { fabric: { windows: { openSession } } }))
    render(<Opener id="s2" />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(openSession).toHaveBeenCalledWith('s2')
  })
})
