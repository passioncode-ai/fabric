// The home's header (docs/evidence/specs/2026-11-20-ceo-persona.md §2): the CEO's face and line, numbers that speak, an
// alarm only after two hot readings, an unread reading said as unread, and each number opening where it is counted.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { CeoHeader } from './CeoHeader'
import type { HomeReading } from './HomeWork'

const now = Date.now()
const ago = (d: number): string => new Date(now - d * 86_400_000).toISOString()
const item = (n: number) => ({ taskId: `t${n}`, projectId: 'p1', projectName: 'dissy', summary: 's', agent: null, sessionId: null, console: false, since: ago(0), doing: null, live: false })
const hotView = (readAt: string) => ({
  live: [], inWork: [], abandoned: [item(1), item(2)], done: [], readAt,
  review: [{ taskId: 'r', projectId: 'p1', projectName: 'dissy', summary: 's', since: ago(5) }],
  projects: [{ projectId: 'p1', now: null, live: 1, inWork: 0, review: 1, lastActivityAt: ago(0) }], reviewOld: 1
})
const handlers = () => ({ onAgents: vi.fn(), onBoard: vi.fn(), onReview: vi.fn(), onAbandoned: vi.fn(), onWaiting: vi.fn(), onProject: vi.fn() })
const show = (home: HomeReading, h = handlers(), waiting: number | null = 0) =>
  render(<I18nProvider locale="ru"><CeoHeader home={home} waiting={waiting} {...h} /></I18nProvider>)

afterEach(cleanup)

describe('CeoHeader', () => {
  it('says a fire only after the second hot reading, names the project and opens it', () => {
    const h = handlers()
    const { rerender } = show({ view: hotView(ago(0.01)) as never, problem: null }, h)
    expect(screen.getByRole('status').textContent).not.toMatch(/dissy/)
    rerender(<I18nProvider locale="ru"><CeoHeader home={{ view: hotView(ago(0)) as never, problem: null }} waiting={0} {...h} /></I18nProvider>)
    const line = screen.getByRole('status')
    expect(line.textContent).toMatch(/dissy/)
    fireEvent.click(line)
    expect(h.onProject).toHaveBeenCalledWith('p1')
  })

  it('numbers speak and open where they are counted; an unread reading is said, never calm', () => {
    const h = handlers()
    show({ view: hotView(ago(0)) as never, problem: null }, h)
    expect(screen.getByText(/1 ждут дольше трёх дней/)).toBeTruthy()
    expect(screen.getByText(/чаще всего в dissy/)).toBeTruthy()
    fireEvent.click(screen.getByText('брошено'))
    expect(h.onAbandoned).toHaveBeenCalled()
  })

  it('an unread home says it cannot see, and its numbers are «—»', () => {
    show({ view: null, problem: 'down' }, handlers(), null)
    expect(screen.getByRole('status').textContent).toMatch(/Не вижу/)
    expect(screen.getAllByText('—').length).toBe(4)
  })
})
