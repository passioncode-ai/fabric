// "Not signed in" was the answer to three different questions (AX-14).
//
// MEASURED at `8652799`. The estate's quota panel renders one sentence when
// `quota` is null — "No quota to show — Claude Code is not signed in on this
// machine." — inside an `EmptyState read`, which is this codebase's marker for
// A MEASUREMENT. Null arrives from three places:
//
//   1. the reader genuinely had nothing to say (not signed in) — true;
//   2. the IPC read FAILED and `App.tsx` catches it with `setQuota(null)` —
//      so the product diagnoses the operator's account when it could not ask;
//   3. nothing has been read yet, because `useState<Quota | null>(null)` is the
//      initial value — so the FIRST PAINT says it, before anyone looked.
//
// The third is M108's own rule, which this codebase applies to `projects`,
// `sessions` and `feed` in as many words — "null until it has been read; the
// empty array is a MEASUREMENT" — not applied to quota.
//
// AND THE SIX REASONS COLLAPSE TOO. `Quota.problem` is one of `no-credential`,
// `unreachable`, `rejected`, `empty`, `throttled` or null, and the panel renders
// every one of them as "last read {age} ago". Throttled is not stale. Rejected
// is not stale. The reader models the causes carefully and the operator is told
// about age.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QuotaPanel } from './launch/QuotaPanel'
import { I18nProvider } from './i18n'
import { NO_MARKS } from '../../shared/feedMarks'
import type { Quota } from '../../shared/types'
import { whole } from '../../../test/envelopes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const quota = (over: Partial<Quota> = {}): Quota => ({
  fiveHour: { utilization: 42, resetsAt: null },
  sevenDay: null,
  byModel: {},
  readAt: '2026-09-11T00:00:00Z',
  ageSeconds: 30,
  problem: null,
  account: 'acct',
  ...over
})

function stub() {
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window ?? {}, {
      fabric: {
        workspace: { state: vi.fn(async () => ({ path: null, git: 'yes' })) },
        favourites: { list: async () => [] },
        board: { query: async () => ({ rows: [], total: 0 }) },
        attention: { list: async () => whole([]) },
        estate: { summary: async () => null, profile: async () => null },
        memory: { overview: async () => null }
      }
    })
  )
}

const show = (q: Parameters<typeof QuotaPanel>[0]['quota']) =>
  render(
    <I18nProvider locale="en">
      <QuotaPanel quota={q} />
    </I18nProvider>
  )

describe('the quota panel says which question it is answering', () => {
  it('does not diagnose the account before anything has been read', async () => {
    // The first paint. Saying "not signed in" here is a claim about the
    // operator's machine made before anyone looked at it.
    stub()
    show({ read: false })
    await waitFor(() => expect(screen.getByText(/Account quota/)).toBeTruthy())
    expect(screen.queryByText(/not signed in/i), 'nobody has looked yet').toBeNull()
  })

  it('and says so plainly when the read itself could not be made', async () => {
    // `App.tsx` catches a failed IPC with `setQuota(null)`, so this used to
    // render as "Claude Code is not signed in on this machine" — a diagnosis of
    // the account, produced by our own outage.
    stub()
    show({ read: true, failed: 'the bridge is not answering' })
    await waitFor(() => expect(screen.getByText(/could not be read|not answering/i)).toBeTruthy())
    expect(screen.queryByText(/not signed in/i)).toBeNull()
  })

  it('but still says "not signed in" when that is what the reader answered', async () => {
    // The other direction, and it is what keeps the sentence worth printing.
    stub()
    show({ read: true, quota: null })
    await waitFor(() => expect(screen.getByText(/not signed in/i)).toBeTruthy())
  })

  it('and names the CAUSE of a partial reading, not its age', async () => {
    // Six reasons rendered as one sentence about staleness. Throttled is not
    // stale; rejected is not stale.
    stub()
    show({ read: true, quota: quota({ problem: 'throttled' }) })
    await waitFor(() => expect(screen.getByText(/42%/)).toBeTruthy())
    expect(screen.getByText(/rate.limited|throttled|asking too often/i)).toBeTruthy()
  })

  it('and a different cause reads differently', async () => {
    stub()
    show({ read: true, quota: quota({ problem: 'no-credential' }) })
    await waitFor(() => expect(screen.getByText(/42%/)).toBeTruthy())
    expect(screen.getByText(/credential|signed in/i)).toBeTruthy()
    expect(screen.queryByText(/rate.limited|throttled/i)).toBeNull()
  })

  it('and a clean reading says nothing about a problem at all', async () => {
    stub()
    show({ read: true, quota: quota() })
    await waitFor(() => expect(screen.getByText(/42%/)).toBeTruthy())
    expect(screen.queryByText(/could not be read|throttled|last read/i)).toBeNull()
  })
})
