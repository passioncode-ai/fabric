// A number nobody read is never shown as a number (M199.ui, SCR-62).
//
// The card's failure cases are this file: unknown usage and an unsupported
// resume must not look like success, the receipt must say auto or manual, a
// keyboard-only path must work, 375px must not hide anything, and no secret
// may reach the renderer.
//
// THE DEFECT THIS VIEW IS SHAPED AGAINST is one line long and looks harmless:
// `usedPct ?? 0` renders a full tank for an account nobody asked about. So
// `ShownHeadroom` is a union rather than a nullable number, and there is
// nothing here for a component to default. That is checked by rendering the
// absence and asserting what appears — not by reading the type.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProviderAccounts } from './ProviderAccounts'
import {
  autoStateOf,
  limitationOf,
  shownHeadroom,
  viewProblems,
  type AccountListView,
  type AutoPolicyView,
  type ConversationAccountView
} from '../../shared/providerAccountViews'
import { CAPABILITY_MATRIX } from '../../shared/providerCapabilityMatrix'
import type { Exclusion } from '../../shared/autoPolicy'

afterEach(cleanup)

const NOW = 1_757_000_000_000

const reading = (usedPct: number, over: Record<string, unknown> = {}) =>
  ({
    contextIdentity: {
      provider: 'codex-cli',
      subject: null,
      org: 'org-1',
      accountId: 'acct-A',
      runtime: 'host',
      authRevision: 1
    },
    authRevision: 1,
    windows: [{ id: 'five-hour', kind: 'five-hour', usedPct, resetAt: null }],
    sampledAt: new Date(NOW - 30_000).toISOString(),
    source: 'oauth usage endpoint',
    status: 'fresh',
    reason: 'read',
    nextProbeAt: new Date(NOW + 90_000).toISOString(),
    ...over
  }) as never

const accounts = (over: Partial<AccountListView> = {}): AccountListView => ({
  rows: [
    {
      account: {
        accountId: 'acct-A',
        provider: 'codex-cli',
        org: 'org-1',
        email: 'someone@example.com',
        runtime: 'host',
        confidence: 'subject',
        label: 'work',
        addedAt: '2026-09-10T00:00:00.000Z',
        isDefault: true
      },
      headroom: shownHeadroom(reading(30), 'five-hour', NOW),
      blockers: [],
      removable: { allowed: false, blockedBy: ['1 conversation is bound to it'] }
    },
    {
      account: {
        accountId: 'acct-B',
        provider: 'codex-cli',
        org: 'org-1',
        email: null,
        runtime: 'host',
        confidence: 'org-only',
        label: 'spare',
        addedAt: '2026-09-10T00:00:00.000Z',
        isDefault: false
      },
      // NOBODY READ IT. This row is the whole reason the union exists.
      headroom: shownHeadroom(null, 'five-hour', NOW),
      blockers: ['this build cannot confirm a resumed conversation'],
      removable: { allowed: true, blockedBy: [] }
    }
  ],
  systemDefault: { present: true, says: 'the login the provider already had' },
  limitation: limitationOf({ resumeAckSupported: false, provider: 'codex-cli', cliBuild: '0.152.1' }),
  ...over
})

const auto = (over: Partial<AutoPolicyView> = {}): AutoPolicyView => ({
  state: 'held',
  reason: '95% of five-hour is used and no account is eligible (acct-B: resume-unverified)',
  nextCheckAt: new Date(NOW + 60_000).toISOString(),
  eligible: [],
  excluded: [{ accountId: 'acct-B', why: 'resume-unverified' }],
  affectedConversations: ['conv-A', 'conv-C'],
  limitation: limitationOf({ resumeAckSupported: false, provider: 'codex-cli', cliBuild: '0.152.1' }),
  policyRevision: 1,
  ...over
})

const conversation = (over: Partial<ConversationAccountView> = {}): ConversationAccountView => ({
  conversationId: 'conv-A',
  accountId: 'acct-A',
  label: 'work',
  pin: { strength: 'drifting', reason: 'one keychain item per operating-system user is not ours to own' },
  headroom: shownHeadroom(reading(95), 'five-hour', NOW),
  manuallyPinned: false,
  enrolled: false,
  ...over
})

const view = (over: Record<string, unknown> = {}) =>
  render(
    <ProviderAccounts
      accounts={accounts()}
      conversation={conversation()}
      auto={auto()}
      receipt={null}
      onForget={vi.fn()}
      onSetDefault={vi.fn()}
      onEnrol={vi.fn()}
      expectedRevision="rev-1"
      {...over}
    />
  )

describe('a number nobody read is never shown as a number', () => {
  it('shows the absence with its reason, not a percentage', () => {
    view()
    const unknown = screen.getAllByText(/not read/i)
    expect(unknown.length).toBeGreaterThan(0)
    // And there is no 0% anywhere: the defect this view is shaped against
    // renders a full tank for an account nobody asked about.
    expect(screen.queryByText(/^0%/)).toBeNull()
  })

  it('shows the AGE beside every number it does show', () => {
    view()
    // 30 seconds old, from the fixture's sampledAt.
    expect(screen.getAllByText(/read 30s ago/i).length).toBeGreaterThan(0)
  })

  it('marks a known and an unknown headroom differently in the DOM', () => {
    const { container } = view()
    expect(container.querySelectorAll('[data-known="true"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-known="false"]').length).toBeGreaterThan(0)
  })
})

describe('what this build cannot do, where somebody reaches for it', () => {
  it('states the limitation before any control', () => {
    view()
    const note = screen.getByTestId('limitation')
    expect(note.textContent).toMatch(/will not move a running conversation/i)
    expect(note.textContent).toMatch(/never as a continuation/i)
  })

  it('and the limitation comes from the measured matrix rather than a literal', () => {
    // Both pinned builds are non-supported for the acknowledgement, so a view
    // built from the matrix always carries a limitation.
    const acked = CAPABILITY_MATRIX.filter((r) => r.capability === 'native-resume-ack')
    expect(acked.every((r) => r.status !== 'supported')).toBe(true)
    expect(limitationOf({ resumeAckSupported: false, provider: 'p', cliBuild: 'b' })).not.toBeNull()
    expect(limitationOf({ resumeAckSupported: true, provider: 'p', cliBuild: 'b' })).toBeNull()
  })

  it('names every account that cannot take over, with the reason', () => {
    view()
    expect(screen.getByTestId('excluded').textContent).toMatch(/acct-B — resume-unverified/)
  })

  it('shows which conversations enabling this would affect', () => {
    view()
    expect(screen.getByTestId('affected').textContent).toMatch(/conv-A, conv-C/)
  })
})

describe('the receipt says auto or manual, and which conversation', () => {
  it('says nothing has been switched when nothing has', () => {
    view()
    expect(screen.getByTestId('receipt').textContent).toMatch(/nothing has been switched/i)
  })

  it('names the trigger, the conversation, the accounts and the phase', () => {
    view({
      receipt: {
        trigger: 'auto',
        conversationId: 'conv-A',
        from: 'acct-A',
        to: 'acct-B',
        reason: 'held: the provider acknowledged nothing',
        at: '2026-09-10T00:00:00.000Z',
        phase: 'needs_reconciliation'
      }
    })
    const receipt = screen.getByTestId('receipt').textContent ?? ''
    expect(receipt).toMatch(/switched automatically/i)
    expect(receipt).toMatch(/conv-A/)
    expect(receipt).toMatch(/acct-A → acct-B/)
    expect(receipt).toMatch(/needs_reconciliation/)
  })

  it('and distinguishes a manual switch from an automatic one', () => {
    view({
      receipt: {
        trigger: 'manual',
        conversationId: 'conv-A',
        from: null,
        to: 'acct-B',
        reason: 'the operator chose it',
        at: '2026-09-10T00:00:00.000Z',
        phase: 'committed'
      }
    })
    expect(screen.getByTestId('receipt').textContent).toMatch(/switched by hand/i)
  })
})

describe('the renderer submits intent only', () => {
  it('carries the revision it read back with every write', () => {
    const onSetDefault = vi.fn()
    view({ onSetDefault })
    // acct-B is not the default, so it has the button.
    fireEvent.click(screen.getByText(/the login the provider already had/i))
    expect(onSetDefault).toHaveBeenCalledWith({ accountId: 'acct-B', expectedRevision: 'rev-1' })
  })

  it('cannot submit a removal the view says is blocked', () => {
    const onForget = vi.fn()
    view({ onForget })
    const blocked = screen.getByText(/cannot be forgotten yet/i) as HTMLButtonElement
    expect(blocked.disabled).toBe(true)
    fireEvent.click(blocked)
    expect(onForget).not.toHaveBeenCalled()
  })

  it('puts the reason ON the disabled control rather than in a banner', () => {
    view()
    const blocked = screen.getByText(/cannot be forgotten yet/i)
    expect(blocked.getAttribute('title')).toMatch(/conversation is bound to it/i)
  })

  it('submits enrolment for the conversation it was shown', () => {
    const onEnrol = vi.fn()
    view({ onEnrol })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onEnrol).toHaveBeenCalledWith({ conversationId: 'conv-A', enrolled: true })
  })
})

describe('no secret reaches the renderer', () => {
  it('is clean for every view this component is given', () => {
    for (const [name, value] of [
      ['accounts', accounts()],
      ['auto', auto()],
      ['conversation', conversation()]
    ] as const)
      expect(viewProblems(value), name).toEqual([])
  })

  it('and the check itself catches a view that leaks', () => {
    // An assertion that something is absent is worthless until the detector is
    // shown able to see it present.
    expect(viewProblems({ secretRef: 'codex-cli:/Users/example/.codex' })).not.toEqual([])
    expect(viewProblems({ subject: 'sub-1' })).not.toEqual([])
    expect(viewProblems({ freePct: 40 })).toEqual([
      'a view shows a headroom number with no age beside it'
    ])
  })
})

describe('keyboard and a narrow window', () => {
  it('reaches every control by tab order alone', () => {
    const { container } = view()
    const focusable = container.querySelectorAll('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')
    expect(focusable.length).toBeGreaterThan(1)
    for (const el of focusable) {
      ;(el as HTMLElement).focus()
      expect(document.activeElement).toBe(el)
    }
  })

  it('names the section for a screen reader', () => {
    view()
    expect(screen.getByLabelText(/AI accounts/i)).toBeTruthy()
  })

  it('hides nothing behind a width', () => {
    // The component sets no width and no media query: at 375px the same nodes
    // are present, which is what a probe in jsdom can honestly assert. Layout
    // at that width is `sheleg-design`'s and is not claimed here.
    const { container } = view()
    expect(container.querySelector('[style*="width"]')).toBeNull()
    expect(screen.getByTestId('auto-state')).toBeTruthy()
    expect(screen.getByTestId('receipt')).toBeTruthy()
  })
})

describe('the state is computed, never stored', () => {
  it('is off when the policy is off, whatever the decision says', () => {
    expect(autoStateOf({ enabled: false, paused: false, decision: null, phase: null })).toBe('off')
  })

  it('is paused before anything else', () => {
    expect(autoStateOf({ enabled: true, paused: true, decision: null, phase: 'stopping' })).toBe('paused')
  })

  it('follows the coordinator while a switch is in flight', () => {
    expect(autoStateOf({ enabled: true, paused: false, decision: null, phase: 'waiting_boundary' })).toBe(
      'waiting-boundary'
    )
    expect(autoStateOf({ enabled: true, paused: false, decision: null, phase: 'resuming' })).toBe('switching')
  })

  it('tells cooling-down from exhausted from held, because they are different questions', () => {
    const hold = (reason: string, excluded: { accountId: string; why: Exclusion }[] = []) => ({
      kind: 'hold' as const,
      reason,
      from: null,
      observationRefs: [],
      policyRevision: 1,
      nextCheckAt: '',
      eligible: [],
      excluded
    })
    expect(autoStateOf({ enabled: true, paused: false, decision: hold('60s since the last switch and the cooldown is 300s'), phase: null })).toBe('cooling-down')
    expect(
      autoStateOf({
        enabled: true,
        paused: false,
        decision: hold('no account is eligible', [{ accountId: 'b', why: 'exhausted' }]),
        phase: null
      })
    ).toBe('exhausted')
    expect(autoStateOf({ enabled: true, paused: false, decision: hold('the policy is not usable'), phase: null })).toBe('held')
  })

  it('is monitoring when the decision is to stay', () => {
    expect(
      autoStateOf({
        enabled: true,
        paused: false,
        decision: {
          kind: 'stay',
          reason: '40% used',
          from: null,
          observationRefs: [],
          policyRevision: 1,
          nextCheckAt: '',
          eligible: [],
          excluded: []
        },
        phase: null
      })
    ).toBe('monitoring')
  })
})

describe('a stale reading is not a current one', () => {
  it('carries the age, so an hour-old number cannot read as now', () => {
    const old = shownHeadroom(reading(30, { sampledAt: new Date(NOW - 3_600_000).toISOString() }), 'five-hour', NOW)
    expect(old.known && old.ageSeconds).toBe(3600)
  })

  it('and a status that is not a reading has NO known headroom at all', () => {
    // This is why `isStaleForDisplay` was removed rather than tested: the
    // producer already refuses here, so a helper combining an age limit with a
    // status check had a branch no caller could reach.
    const stale = shownHeadroom(reading(30, { status: 'stale' }), 'five-hour', NOW)
    expect(stale.known).toBe(false)
    expect(stale.known === false && stale.status).toBe('stale')
  })

  it('and an unparseable timestamp gives an age of zero rather than NaN', () => {
    const broken = shownHeadroom(reading(30, { sampledAt: 'not a date' }), 'five-hour', NOW)
    expect(broken.known && broken.ageSeconds).toBe(0)
  })
})
