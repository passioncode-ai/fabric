// «Создать» (SCN-171, SCR-90; 0.3.7 wave 3): opened from «＋ Создать» on the rail, in the main area rather than as a
// menu over the page, with three choices and one line each of what you get, «Открыть папку с проектами» first.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { StartScreen } from './StartPaths'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function create(locale: 'en' | 'ru' = 'en') {
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { start: { lastScan: vi.fn(async () => null) } } }))
  const onPath = vi.fn()
  render(<I18nProvider locale={locale}><StartScreen path="menu" projects={[]} onPath={onPath} onCreated={vi.fn()} onOpenProject={vi.fn()} onHome={vi.fn()} onProjectsChanged={vi.fn()} /></I18nProvider>)
  return onPath
}

describe('«Создать»', () => {
  it('offers three choices, the projects folder first and primary, each with what you get', () => {
    create()
    expect(screen.getByRole('heading', { name: en['create.title'] })).toBeTruthy()
    const choices = screen.getAllByRole('button', { name: /./ }).filter((b) => b.classList.contains('cr-choice'))
    expect(choices.map((b) => b.querySelector('b')?.textContent)).toEqual([en['create.folder.title'], en['create.project.title'], en['create.agent.title']])
    expect(choices[0].classList.contains('primary')).toBe(true)
    expect(choices[0].textContent).toContain(en['create.folder.body'])
  })

  it('each choice goes to its path: the folder scan, a new project, a new agent', () => {
    const onPath = create()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['create.folder.title']) }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['create.project.title']) }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['create.agent.title']) }))
    expect(onPath.mock.calls.map((c) => c[0])).toEqual(['scan', 'new', 'agent'])
  })

  it('keeps one folder or several as one project, and an agent built elsewhere, one line beneath', () => {
    const onPath = create()
    fireEvent.click(screen.getByRole('button', { name: en['create.one'] }))
    fireEvent.click(screen.getByRole('button', { name: en['create.convert'] }))
    expect(onPath.mock.calls.map((c) => c[0])).toEqual(['add', 'convert'])
  })

  it('has no Back to Home of its own: the rail is the way out', () => {
    create()
    expect(screen.queryByRole('button', { name: en['start.home'] })).toBeNull()
  })

  it('speaks Russian', () => {
    create('ru')
    expect(screen.getByRole('heading', { name: 'Создать' })).toBeTruthy()
    expect(screen.getByRole('button', { name: new RegExp(ru['create.folder.title'] ?? '') })).toBeTruthy()
    expect(ru['create.folder.title']).toBe('Открыть папку с проектами')
  })
})
