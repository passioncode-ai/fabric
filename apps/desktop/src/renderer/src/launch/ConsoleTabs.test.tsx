// The console tabs along the top of the main window (OF-03, SCN-172): one tab per open console, each with the console
// sign, its project's name and its coding agent; the one on screen is marked; × takes the tab away and nothing else.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ConsoleTabs, type ConsoleTab } from './ConsoleTabs'

afterEach(cleanup)

const tabs: ConsoleTab[] = [
  { sessionId: 's1', title: 'fabric-dashboards', runner: 'Claude Code' },
  { sessionId: 's2', title: 'Nicegram', runner: 'Codex' }
]

function mount(over: Partial<React.ComponentProps<typeof ConsoleTabs>> = {}) {
  const props = { tabs, activeId: 's2', onSelect: vi.fn(), onClose: vi.fn(), ...over }
  const view = render(<I18nProvider locale="en"><ConsoleTabs {...props} /></I18nProvider>)
  return { props, view }
}

describe('the console tabs', () => {
  it('shows one tab per open console with the console sign, the project and the coding agent', () => {
    mount()
    const strip = screen.getByRole('navigation', { name: en['consoles.label'] })
    const items = within(strip).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    // The mockup parity (rail gap 22): one line «› {project} · {runner}».
    expect(items[0].textContent).toContain(en['glyph.consoleTab'])
    expect(items[0].querySelector('.fab-console-name')?.textContent).toBe('fabric-dashboards · Claude Code')
    expect(items[1].textContent).toContain('Nicegram')
  })

  it('marks the console on screen, and only that one', () => {
    mount({ activeId: 's1' })
    const open = screen.getByRole('button', { name: /^fabric-dashboards/ })
    expect(open.getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: /^Nicegram/ }).getAttribute('aria-current')).toBeNull()
  })

  it('switches to a console when its tab is pressed', () => {
    const { props } = mount()
    fireEvent.click(screen.getByRole('button', { name: /^fabric-dashboards/ }))
    expect(props.onSelect).toHaveBeenCalledWith('s1')
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('× closes that tab only: it asks nothing and does not select it', () => {
    const { props } = mount()
    fireEvent.click(screen.getByRole('button', { name: en['consoles.close'].replace('{name}', 'Nicegram') }))
    expect(props.onClose).toHaveBeenCalledWith('s2')
    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it('says it is reading when the session has not been read yet', () => {
    mount({ tabs: [{ sessionId: 's9', title: null, runner: null }], activeId: null })
    expect(screen.getByRole('button', { name: new RegExp('^' + en['consoles.reading']) })).toBeTruthy()
  })

  it('is not there at all while no console is open', () => {
    const { view } = mount({ tabs: [], activeId: null })
    expect(view.container.textContent).toBe('')
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
