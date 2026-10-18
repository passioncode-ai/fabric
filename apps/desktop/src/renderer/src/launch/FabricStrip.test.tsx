// The Fabric strip (0.3.3 UI pass). The prototype draws the strip
// on every launch view but Home and "Your Fabric", and "Discuss with Fabric" on every view but Home, the start
// paths and Help (scripts/product/launch.mjs, controller.js); the app had both on the board alone.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import type { FeedEvent } from '../../../shared/types'
import { FeedStrip, lastEventAt } from './FabricStrip'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const ev = (seq: number, project: string | null, at: string): FeedEvent =>
  ({ estate_id: 'e', seq, type: 'task.created@1', actor: { kind: 'person', id: 'o' }, project_id: project, occurred_at: at, payload: {} })

describe('how fresh a screen is', () => {
  const feed = [ev(1, 'p1', '2026-10-08T01:00:00Z'), ev(2, 'p2', '2026-10-08T03:00:00Z'), ev(3, 'p1', '2026-10-08T02:00:00Z')]

  it('is the newest event in the scope — the whole estate, or one project', () => {
    expect(lastEventAt(feed, null)).toBe('2026-10-08T03:00:00Z')
    expect(lastEventAt(feed, 'p1')).toBe('2026-10-08T02:00:00Z')
    expect(lastEventAt(feed, 'p3')).toBeNull()
  })

  const strip = (props: Parameters<typeof FeedStrip>[0]) =>
    render(<I18nProvider locale="en"><FeedStrip {...props} /></I18nProvider>).getByTestId('fabric-strip').textContent ?? ''

  it('says it is still reading before the journal has answered, and never calls that "nothing yet"', () => {
    expect(strip({ feed: null, projectId: null, projectName: null })).toContain(en['launch.strip.reading'])
  })

  it('an estate with an empty journal says so, by scope', () => {
    expect(strip({ feed: [], projectId: null, projectName: null })).toContain(en['launch.strip.estateNone'])
    cleanup()
    expect(strip({ feed: [], projectId: 'p1', projectName: 'Atlas' })).toContain('Atlas')
  })

  it('names all projects, or the project, beside the time', () => {
    expect(strip({ feed, projectId: null, projectName: null })).toMatch(/all projects/)
    cleanup()
    expect(strip({ feed, projectId: 'p1', projectName: 'Atlas' })).toMatch(/Atlas/)
  })

  it('offers Pulse only where the caller gives a way there', () => {
    render(<I18nProvider locale="en"><FeedStrip feed={feed} projectId={null} projectName={null} /></I18nProvider>)
    expect(screen.queryByRole('button', { name: en['launch.pulse.open'] })).toBeNull()
    cleanup()
    const onPulse = vi.fn()
    render(<I18nProvider locale="en"><FeedStrip feed={feed} projectId={null} projectName={null} onPulse={onPulse} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: en['launch.pulse.open'] }))
    expect(onPulse).toHaveBeenCalledOnce()
  })
})

// The scope bar (Profile beside Search, the Comms badge, «Discuss with Fabric») left with 0.3.7 wave 3: the rail is the
// whole of the navigation and is probed in Rail.test.tsx.
