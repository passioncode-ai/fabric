// #region stack-health-notice — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// ST-2 and ST-1 of the 0.3.9 stability audit: when the database stops answering while Fabric runs, the person is told,
// on every screen, what is down, that Fabric is bringing it back and when it tries next; a low disk is named, first,
// as the likely cause. Nothing is shown while the stack is up and the disk has room.
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StackHealthNotice } from './StackHealthNotice'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import type { StackHealthView } from '../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const up: StackHealthView = { stack: 'up', why: null, since: '2026-10-21T00:00:00Z', nextTryInS: null, diskLow: false, freeDiskBytes: 50e9, diskLikelyCause: false }

function mount(view: StackHealthView | null, locale: 'en' | 'ru' = 'en'): { push: (v: StackHealthView) => void } {
  let listener: ((v: StackHealthView) => void) | null = null
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
    fabric: { stack: { health: vi.fn().mockResolvedValue(view), onHealth: (cb: (v: StackHealthView) => void) => { listener = cb; return () => { listener = null } } } }
  }))
  render(<I18nProvider locale={locale}><StackHealthNotice /></I18nProvider>)
  return { push: (v) => act(() => listener?.(v)) }
}

describe('the stack health notice', () => {
  it('is absent while the stack is up and the disk has room', async () => {
    mount(up)
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says the database is down, that Fabric is bringing it back, and when it tries next', async () => {
    const { push } = mount(up)
    await new Promise((r) => setTimeout(r, 10))
    push({ ...up, stack: 'down', why: 'docker', nextTryInS: 20 })
    expect(screen.getByRole('alert').textContent).toContain(en['stack.health.title'])
    expect(screen.getByText(en['stack.health.docker'])).toBeTruthy()
    expect(screen.getByText('Next try in 20 s.')).toBeTruthy()
    push(up)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('names a low disk first, as the likely cause, when the stack is down on it', async () => {
    mount({ ...up, stack: 'down', why: 'docker', nextTryInS: 40, diskLow: true, freeDiskBytes: 0.74e9, diskLikelyCause: true })
    const alert = await screen.findByRole('alert')
    const text = alert.textContent ?? ''
    expect(text).toContain('This disk has 0.7 GB free.')
    expect(text.indexOf('0.7 GB free')).toBeLessThan(text.indexOf(en['stack.health.docker']))
  })

  it('warns about a low disk while the stack is up, and speaks Russian', async () => {
    mount({ ...up, diskLow: true, freeDiskBytes: 2.5e9 }, 'ru')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(ru['stack.health.diskTitle']!)
    expect(alert.textContent).toContain('2,5 ГБ')
  })

  it('reads nothing when the bridge has no health (an older preload)', async () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { stack: {} } }))
    render(<I18nProvider locale="en"><StackHealthNotice /></I18nProvider>)
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
// #endregion stack-health-notice
