// W2 S4b (OF-39): how the work goes in one project.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ProjectAnalytics } from './ProjectAnalytics'

const install = (analytics: () => Promise<unknown>) => vi.stubGlobal('window', Object.assign(window, { fabric: { projects: { analytics: vi.fn(analytics) } } }))
const show = () => render(<I18nProvider locale="en"><ProjectAnalytics projectId="p1" feedMark={0} /></I18nProvider>)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('how the work goes (OF-39)', () => {
  it('shows tasks done, the medians in hours or days, the share sent back and the questions waiting', async () => {
    install(async () => ({ donePerWeek: [0, 1, 0, 0, 2, 0, 0, 3], leadHours: 30, reviewHours: 72, reopenedShare: 0.25, questionsWaiting: 2, oldestQuestionAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), weeks: 8 }))
    const { container } = show()
    await waitFor(() => expect(screen.getByText(en['launch.analytics.done'].replace('{weeks}', '8'))).toBeTruthy())
    const text = container.textContent ?? ''
    expect(text).toContain('6')
    expect(text).toContain('30 h')
    expect(text).toContain('3 d')
    expect(text).toContain('25%')
    expect(container.querySelectorAll('.lp-analytics-bars span')).toHaveLength(8)
  })

  it('says «not known yet» for what Fabric cannot know, and a read that failed', async () => {
    install(async () => ({ donePerWeek: [0, 0, 0, 0, 0, 0, 0, 0], leadHours: null, reviewHours: null, reopenedShare: null, questionsWaiting: 0, oldestQuestionAt: null, weeks: 8 }))
    const { container } = show()
    await waitFor(() => expect(screen.getByText(en['launch.analytics.lead'])).toBeTruthy())
    expect((container.textContent ?? '').match(/not known yet/g)?.length).toBe(3)
    cleanup()
    install(async () => { throw new Error('journal unreadable') })
    show()
    await waitFor(() => expect(screen.getByText(en['launch.analytics.unreadable'])).toBeTruthy())
  })
})
