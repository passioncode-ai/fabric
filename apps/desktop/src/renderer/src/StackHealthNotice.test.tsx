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

const up: StackHealthView = { stack: 'up', why: null, since: '2026-10-21T00:00:00Z', nextTryInS: null, trying: false, attempt: null, hold: null, platform: 'darwin', runtime: null, diskLow: false, diskSoon: false, freeDiskBytes: 50e9, diskLikelyCause: false, diskStopped: false, diskMarkBytes: null, diskStopFailed: false }

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
    expect(screen.getByTestId('stack-next-try').textContent).toBe('Next try in 20 s.')
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

  // CO-492: a Mac whose Docker is Colima is told about Colima, never «open OrbStack or Docker Desktop».
  it('names Colima on a Mac whose Docker is Colima', async () => {
    mount({ ...up, stack: 'down', why: 'docker', nextTryInS: 40, runtime: 'Colima' }, 'ru')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(ru['stack.health.docker.colima']!)
    expect(alert.textContent).not.toContain('OrbStack')
  })

  it('warns about a low disk while the stack is up, and speaks Russian', async () => {
    mount({ ...up, diskLow: true, freeDiskBytes: 2.5e9 }, 'ru')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(ru['stack.health.diskTitle']!)
    expect(alert.textContent).toContain('2,5 ГБ')
  })

  // 0.3.9 review UX-2: a try that runs past its due time read «Next try in 0 s» for minutes; an external stack was
  // promised a recovery that never comes.
  it('while a try runs, says it is trying now and which try, never a countdown at 0', async () => {
    mount({ ...up, stack: 'down', why: 'docker', nextTryInS: null, trying: true, attempt: 3 })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Trying now (try 3).')
    expect(alert.textContent).not.toMatch(/Next try in/)
  })

  it('for a stack Fabric does not bring back, says Fabric waits for it, never that it is bringing it back', async () => {
    mount({ ...up, stack: 'down', why: 'database', hold: 'external' })
    const external = (await screen.findByRole('alert')).textContent ?? ''
    expect(external).toContain(en['stack.health.external'])
    expect(external).not.toMatch(/bringing it back|Next try/)
    cleanup()
    mount({ ...up, stack: 'down', why: 'database', hold: 'stopped' }, 'ru')
    const stopped = (await screen.findByRole('alert')).textContent ?? ''
    expect(stopped).toContain(ru['stack.health.stopped']!)
    expect(stopped).not.toMatch(/поднимает её снова/)
    cleanup()
    mount({ ...up, stack: 'down', why: 'database', hold: 'running' })
    expect((await screen.findByRole('alert')).textContent).toContain(en['stack.health.waitingContainers'])
    cleanup()
    // CO-594: a database Fabric stopped for the disk is said as stopped to keep it whole, never as being brought back;
    // 0.3.23 review, iteration 1 (UX-1, UX-3, UX-9): only a stop Fabric saw end, under its own title, with no Docker cause
    // beside it, and with the mark the watch gives.
    mount({ ...up, stack: 'down', why: 'database', hold: 'disk', diskStopped: true, diskMarkBytes: 3.5e9, diskLow: true, freeDiskBytes: 0.8e9, diskLikelyCause: true }, 'ru')
    const disk = (await screen.findByRole('alert')).textContent ?? ''
    expect(disk).toContain(ru['stack.health.diskStoppedTitle']!)
    expect(disk).toContain(ru['stack.health.diskHold']!.replace('{mark}', '3,5'))
    expect(disk).not.toMatch(/поднимает её снова|не отвечает|Docker останавливается/)
  })

  // 0.3.23 review, iteration 2, UX-10: after the last failed stop the database still writes on a nearly full disk, and
  // the person is told in plain words, not only the ordinary low-disk warning.
  it('says that Fabric could not stop its database once its last stop for the disk failed', async () => {
    mount({ ...up, diskLow: true, freeDiskBytes: 0.8e9, diskStopFailed: true })
    const failed = (await screen.findByRole('alert')).textContent ?? ''
    expect(failed).toContain(en['stack.health.diskStopFailed'])
    expect(failed).toContain('This disk has 0.8 GB free.')
    cleanup()
    mount({ ...up, diskLow: true, freeDiskBytes: 0.8e9, diskStopFailed: true }, 'ru')
    expect((await screen.findByRole('alert')).textContent).toContain(ru['stack.health.diskStopFailed']!)
    cleanup()
    mount({ ...up, diskLow: true, freeDiskBytes: 0.8e9 })
    expect((await screen.findByRole('alert')).textContent).not.toContain(en['stack.health.diskStopFailed'])
  })

  it('says a database that went down by itself on a nearly full disk as down, not as Fabric\'s stop (UX-1)', async () => {
    mount({ ...up, stack: 'down', why: 'database', hold: 'disk', diskStopped: false, diskMarkBytes: 1e9, diskLow: true, freeDiskBytes: 0.6e9, diskLikelyCause: true })
    const self = (await screen.findByRole('alert')).textContent ?? ''
    expect(self).toContain(en['stack.health.title'])
    expect(self).toContain(en['stack.health.diskDown'].replace('{mark}', '1.0'))
    expect(self).toContain('This disk has 0.6 GB free.')
    expect(self).not.toMatch(/stopped its|data is kept|3\.5/)
    cleanup()
    mount({ ...up, stack: 'down', why: 'docker', hold: 'disk', diskStopped: false, diskMarkBytes: 1e9, diskLow: true, freeDiskBytes: 0.6e9, diskLikelyCause: true }, 'ru')
    const docker = (await screen.findByRole('alert')).textContent ?? ''
    expect(docker).toContain(ru['stack.health.diskDownDocker']!.replace('{mark}', '1,0'))
    expect(docker).not.toMatch(/данные сохранены/i)
  })

  // 0.3.9 review UX-4: each OS names its own Docker.
  it('names Docker Desktop on Windows and Docker Engine on Linux, never OrbStack there', async () => {
    mount({ ...up, stack: 'down', why: 'docker', nextTryInS: 20, platform: 'win32' })
    const win = (await screen.findByRole('alert')).textContent ?? ''
    expect(win).toContain(en['stack.health.docker.win32'])
    expect(win).not.toMatch(/OrbStack/)
    cleanup()
    mount({ ...up, stack: 'down', why: 'docker', nextTryInS: 20, platform: 'linux' }, 'ru')
    const linux = (await screen.findByRole('alert')).textContent ?? ''
    expect(linux).toContain(ru['stack.health.docker.linux']!)
    expect(linux).not.toMatch(/OrbStack/)
  })

  it('reads nothing when the bridge has no health (an older preload)', async () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { stack: {} } }))
    render(<I18nProvider locale="en"><StackHealthNotice /></I18nProvider>)
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
// #endregion stack-health-notice

describe('the countdown runs on its own (CO-374)', () => {
  it('counts the next try down each second between the watch\'s reads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    try {
      const { push } = mount(up)
      await act(async () => { await vi.advanceTimersByTimeAsync(10) })
      push({ ...up, stack: 'down', why: 'docker', nextTryInS: 20 })
      expect(screen.getByTestId('stack-next-try').textContent).toBe('Next try in 20 s.')
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(screen.getByTestId('stack-next-try').textContent).toBe('Next try in 17 s.')
    } finally { vi.useRealTimers() }
  })
  // 0.3.12 review UX-5: the countdown changed the alert's text every second, so a screen reader announced the whole
  // notice again each second. What the alert says (everything not hidden from assistive technology) stays as the reading
  // said it; only the shown countdown ticks.
  it('ticks on screen without changing what the alert announces', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    try {
      const { push } = mount(up)
      await act(async () => { await vi.advanceTimersByTimeAsync(10) })
      push({ ...up, stack: 'down', why: 'docker', nextTryInS: 20 })
      const alert = screen.getByRole('alert')
      const walk = (n: Node): string => n.nodeType === 3 ? (n.textContent ?? '')
        : (n as Element).getAttribute('aria-hidden') === 'true' ? '' : [...n.childNodes].map(walk).join('')
      const before = walk(alert)
      // 0.3.12 review, iteration 2, UX-6: the hidden line carried the seconds of the reading, stale a moment later; it names
      // the moment of the next try instead, which stays true however late the notice is read.
      expect(before).toMatch(/Next try at \d{1,2}:\d{2}/)
      expect(before, 'what a screen reader reads holds no count of seconds that goes stale').not.toMatch(/in \d+ s/)
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(screen.getByTestId('stack-next-try').textContent).toBe('Next try in 17 s.')
      expect(walk(alert), 'the alert said something new on a tick').toBe(before)
    } finally { vi.useRealTimers() }
  })

  // 2026-11-20, the operator: «заранее предупреждать о диске (<15 ГБ) в окне».
  it('says the disk is filling under 15 GB, quietly, before anything stops; put away, it comes back two gigabytes later', async () => {
    const { push } = mount({ ...up, diskSoon: true, freeDiskBytes: 5.2e9 }, 'ru')
    const line = await screen.findByTestId('stack-disk-soon')
    expect(line.getAttribute('role')).toBe('status')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(line.textContent).toContain('осталось 5,2 ГБ')
    expect(line.textContent).toContain('1,0 ГБ')
    act(() => { (line.querySelector('button') as HTMLButtonElement).click() })
    expect(screen.queryByTestId('stack-disk-soon')).toBeNull()
    push({ ...up, diskSoon: true, freeDiskBytes: 4.1e9 })
    expect(screen.queryByTestId('stack-disk-soon')).toBeNull()
    push({ ...up, diskSoon: true, freeDiskBytes: 3.6e9 })
    expect(screen.getByTestId('stack-disk-soon').textContent).toContain('3,6 ГБ')
    push({ ...up, diskSoon: false, freeDiskBytes: 40e9 })
    expect(screen.queryByTestId('stack-disk-soon')).toBeNull()
  })
})
