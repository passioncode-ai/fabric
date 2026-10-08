// The Fabric strip and the scope bar's two prototype buttons (0.3.3 UI pass). The prototype draws the strip
// on every launch view but Home and "Your Fabric", and "Discuss with Fabric" on every view but Home, the start
// paths and Help (scripts/product/launch.mjs, controller.js); the app had both on the board alone.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import type { FeedEvent } from '../../../shared/types'
import { FeedStrip, lastEventAt } from './FabricStrip'
import { LaunchShell, launchDiscuss, type LaunchShellProps } from './LaunchShell'

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

describe('the scope bar', () => {
  const shell = (over: Partial<LaunchShellProps> = {}) => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { ceo: { status: vi.fn(async () => ({ active: true })) }, stack: { exposure: vi.fn(async () => null) } } }))
    const props: LaunchShellProps = {
      estateName: 'Mine', projects: [], at: { kind: 'board' },
      onHome: vi.fn(), onBoard: vi.fn(), onPlan: vi.fn(), onHelp: vi.fn(), onQuota: vi.fn(), onNewProject: vi.fn(), onProject: vi.fn(),
      onAgents: vi.fn(), onSettings: vi.fn(), onHistory: vi.fn(), onSearch: vi.fn(), searchOpen: false,
      onProfile: vi.fn(), profileOpen: false, onDiscuss: vi.fn(), onChat: vi.fn(), chatOpen: false,
      children: null, ...over
    }
    render(<I18nProvider locale="en"><LaunchShell {...props} /></I18nProvider>)
    return props
  }

  it('carries Profile beside Search, and it opens "Your Fabric"', () => {
    const props = shell()
    fireEvent.click(screen.getByRole('button', { name: en['launch.profile'] }))
    expect(props.onProfile).toHaveBeenCalledOnce()
  })

  it('marks Profile as the current page while "Your Fabric" is open', () => {
    shell({ profileOpen: true })
    expect(screen.getByRole('button', { name: en['launch.profile'] }).getAttribute('aria-current')).toBe('page')
  })

  it('offers "Discuss with Fabric" where the screen gives one, and nowhere it does not', () => {
    const props = shell()
    fireEvent.click(screen.getByRole('button', { name: en['launch.board.discuss'] }))
    expect(props.onDiscuss).toHaveBeenCalledOnce()
    cleanup()
    shell({ onDiscuss: null })
    expect(screen.queryByRole('button', { name: en['launch.board.discuss'] })).toBeNull()
  })
})

describe('where the scope bar offers to discuss the screen (docs/ux/screens.md#launch-chrome)', () => {
  it('everywhere but the conversation\u2019s own starts, the guide that carries its own, settings and a draft', () => {
    for (const kind of ['board', 'pulse', 'releases', 'plan', 'project', 'persona', 'agents', 'quota']) expect(launchDiscuss(kind), kind).toBe(true)
    for (const kind of ['home', 'start', 'welcome', 'help', 'guide', 'draft', 'settings']) expect(launchDiscuss(kind), kind).toBe(false)
  })
})
