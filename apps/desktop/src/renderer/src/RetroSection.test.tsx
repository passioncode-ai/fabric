// The three things the screen must not say (M154).
//
// Each of these fails the moment a number or a sentence stops reaching the
// operator — which is the only thing that would ever notice. The reader has its
// own unit tests; these assert that what it computed is on screen, because a
// correct derivation nothing renders is the shape this session has found four
// times.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { I18nProvider } from './i18n'
import { RetroSection } from './RetroSection'
import { evidenceOf, type RetroItem, type RetroPage } from '../../shared/retroView.ts'
import type { ReadEnvelope } from '../../shared/readEnvelope'

afterEach(cleanup)

const item = (over: Partial<RetroItem> = {}): RetroItem => ({
  factRef: 'f1',
  subject: { kind: 'fact', id: 'f1' },
  category: 'project',
  kind: 'finding',
  claim: 'the build needs pnpm 9',
  actor: { kind: 'agent', id: 's1' },
  evidence: evidenceOf({ raw: 'task:11111111-1111-1111-1111-111111111111', owner: 'p1' }),
  about: null,
  recurrence: { verifiedDistinct: 1, proposed: 0, problem: null },
  recordedAt: new Date().toISOString(),
  validFrom: new Date().toISOString(),
  validTo: null,
  supersedes: null,
  supersededBy: null,
  conflict: null,
  ...over
})

const envelope = (
  items: RetroItem[],
  sources: ReadEnvelope<RetroPage>['sources'] = [
    { name: 'facts', status: 'ok', asOf: null },
    { name: 'occurrences', status: 'ok', asOf: null }
  ]
): ReadEnvelope<RetroPage> => ({
  data: { items, nextCursor: null, historyOnPage: items.filter((i) => i.validTo).length },
  availability: 'complete',
  freshness: 'fresh',
  asOf: null,
  revision: null,
  sources,
  omitted: []
})

const mount = async (answer: ReadEnvelope<RetroPage>, onOpen = vi.fn()): Promise<typeof onOpen> => {
  ;(window as unknown as { fabric: unknown }).fabric = {
    memory: { retro: async () => answer }
  }
  render(
    <I18nProvider locale="en">
      <RetroSection projectId="p1" feedMark={0} onOpen={onOpen} onError={() => {}} />
    </I18nProvider>
  )
  // The read is an effect, not paint: waiting for the element without this
  // waits for a render that has not been asked for yet.
  await act(async () => {})
  return onOpen
}

describe('the drawer opens', () => {
  it('renders a finding with its kind, which nothing has ever done', () => {
    return mount(envelope([item()])).then(() => {
      expect(screen.getByText('the build needs pnpm 9')).toBeTruthy()
      // Twice: once in the kind filter, once as the row's own chip. The chip is
      // the assertion — the filter existing proves nothing about the row.
      expect(screen.getAllByText('Finding').length).toBeGreaterThan(1)
    })
  })

  it('strikes through what the project no longer believes', async () => {
    await mount(envelope([item({ validTo: new Date().toISOString(), supersededBy: 'f2' })]))
    // By MEANING, not by a class: a reader who cannot see the colour is still
    // told this is not current.
    expect(document.querySelector('s')?.textContent).toBe('the build needs pnpm 9')
    expect(screen.getByText(/corrected later/i)).toBeTruthy()
  })
})

describe('the three things it must not say', () => {
  it('never says "once" when the occurrence relation could not be read', async () => {
    await mount(
      envelope(
        [item({ recurrence: { verifiedDistinct: null, proposed: null, problem: 'permission denied' } })],
        [
          { name: 'facts', status: 'ok', asOf: null },
          { name: 'occurrences', status: 'error', asOf: null, errorCode: 'permission denied' }
        ]
      )
    )
    // Twice: the banner naming the silent source, and the row's own count.
    expect(screen.getAllByText(/could not be read/i).length).toBeGreaterThan(1)
    expect(screen.queryByText(/observed once/i)).toBeNull()
    // And the failed source is NAMED, so the page does not read as complete.
    expect(screen.getByText(/occurrences/)).toBeTruthy()
  })

  it('never says a source is missing when nobody has looked at it', async () => {
    await mount(envelope([item()]))
    expect(screen.getByText(/nobody has checked/i)).toBeTruthy()
    // The tombstone sentence specifically — the lede legitimately contains the
    // word "removed", and asserting on it would fail for the wrong reason.
    expect(screen.queryByText(/removal was recorded/i)).toBeNull()
  })

  it('shows a refused correction rather than letting two claims look independent', async () => {
    await mount(
      envelope([
        item({
          conflict: {
            status: 'conflict_proposed',
            reason: 'an agent may not bury what a person recorded',
            previousRef: 'f0'
          }
        })
      ])
    )
    expect(screen.getByText(/may not bury/i)).toBeTruthy()
    expect(screen.getByText(/stands beside an earlier fact/i)).toBeTruthy()
  })
})

describe('the source is a place, not a string', () => {
  it('offers the act that opens it, and hands over the parsed ref', async () => {
    // `source_ref: 'task:<uuid>'` has been written since M52 and rendered as a
    // bare uuid at a person ever since.
    //
    // `owner` added by UX28-06, and the reason it is REQUIRED here rather than
    // optional: this case used to pass with no ownership evidence at all, which
    // is exactly the leak — the row handed the resolver the page's project as
    // though it were the source's. The button appears when the source is known
    // to belong here, and the two cases below cover the other answers.
    const onOpen = await mount(
      envelope([
        item({
          evidence: evidenceOf({
            raw: 'task:11111111-1111-1111-1111-111111111111',
            resolved: { found: true },
            owner: 'p1'
          })
        })
      ])
    )
    const button = screen.getByRole('button', { name: /open the source/i })
    await act(async () => button.click())
    expect(onOpen).toHaveBeenCalledWith('p1', {
      kind: 'task',
      id: '11111111-1111-1111-1111-111111111111'
    })
  })

  it('keeps free text readable rather than dropping what it cannot parse', async () => {
    await mount(envelope([item({ evidence: evidenceOf({ raw: 'pnpm -v printed 9.1.0' }) })]))
    expect(screen.getByText('pnpm -v printed 9.1.0')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /open the source/i })).toBeNull()
  })

  it('says so when nothing was cited', async () => {
    await mount(envelope([item({ evidence: evidenceOf({ raw: null }) })]))
    expect(screen.getByText(/no source/i)).toBeTruthy()
  })
})

describe('empty is a claim, and it is only made when everything answered', () => {
  it('says nothing is here when every source answered', async () => {
    await mount(envelope([]))
    expect(screen.getByText(/nothing has been recorded/i)).toBeTruthy()
  })

  it('refuses to say it while a source is silent', async () => {
    await mount(
      envelope([], [{ name: 'facts', status: 'error', asOf: null, errorCode: 'permission denied' }])
    )
    expect(screen.queryByText(/nothing has been recorded/i)).toBeNull()
    expect(screen.getByText(/not the same as nothing being there/i)).toBeTruthy()
  })
})

describe('a source belongs to a project, and this row may not guess which (UX28-06)', () => {
  it('does not offer to open a source owned by another project', async () => {
    // THE LEAK. The row knows the project it is being READ in; a fact's
    // `source_ref` may name a task recorded anywhere. Handing the page's
    // project to the resolver asserted the source belonged to it, so a source
    // from another project opened INSIDE this one, with that project's id.
    await mount(
      envelope([
        item({
          evidence: evidenceOf({
            raw: 'task:22222222-2222-2222-2222-222222222222',
            resolved: { found: true },
            owner: 'p2'
          })
        })
      ])
    )
    expect(screen.queryByRole('button', { name: /open the source/i })).toBeNull()
    // And it says why, in place, rather than dropping the row or jumping.
    expect(screen.getByText(/another project/i)).toBeTruthy()
    // The raw ref is still on screen: it is the only provenance there is.
    expect(screen.getByText(/22222222/)).toBeTruthy()
  })

  it('and does not offer to open one whose owner nobody could establish', async () => {
    // Honest and common — the lookup failed, or the source names something the
    // store cannot place. "Cannot be opened from here" is what not knowing
    // looks like; the reassuring default would send the operator somewhere
    // wrong.
    await mount(
      envelope([
        item({
          evidence: evidenceOf({
            raw: 'task:33333333-3333-3333-3333-333333333333',
            resolved: { found: true },
            owner: null
          })
        })
      ])
    )
    expect(screen.queryByRole('button', { name: /open the source/i })).toBeNull()
    expect(screen.getByText(/33333333/)).toBeTruthy()
  })
})

describe('the act offered is the act the evidence names', () => {
  // MEASURED at `49b0a6f`. `evidenceOf` computes FOUR different acts — `open`,
  // `locate`, `retry` and NONE — and `EvidenceAvailability.action` was read by
  // nothing in production. Twelfth instance of this cycle's recurring shape.
  //
  // The screen split on `evidenceOpens(...)`, a boolean over the status, and
  // offered a button in BOTH branches. So a source the module records as
  // REMOVED, and one the operator is not permitted to read, both got a "try to
  // open" — an act that cannot possibly work, offered over the module's own
  // sentence saying so. And `locate` and `retry`, which are different acts,
  // rendered identically.
  //
  // The module's own header states the rule this restores: collapsing four
  // recoverable-or-not facts into one word "teaches the reader to ignore the
  // word, and the one time it means deleted they will".

  const withStatus = (reason: Parameters<typeof evidenceOf>[0]['resolved'] extends undefined ? never : NonNullable<Parameters<typeof evidenceOf>[0]['resolved']>['reason']) =>
    item({
      evidence: evidenceOf({
        raw: 'task:11111111-1111-1111-1111-111111111111',
        owner: 'p1',
        resolved: { found: false, reason }
      })
    })

  it('the fixture is a source that resolves to a REMOVED row, or nothing below is about it', () => {
    const got = withStatus('deleted_tombstone')
    expect(got.evidence.status).toBe('deleted_tombstone')
    expect(got.evidence.action, 'the module names NO act for a removal it recorded').toBeNull()
  })

  it('offers NOTHING for a source recorded as removed', async () => {
    await mount(envelope([withStatus('deleted_tombstone')]))
    expect(screen.getByText(/removed, and the removal was recorded/)).toBeTruthy()
    // NO BUTTON AT ALL, not merely none named "open". The first version of
    // this assertion asked for a button matching /open/i, and a plant that
    // offered one labelled "Try again" walked straight past it — the act was
    // back and the case stayed green. A plant must move the assertion, and
    // proving it does is what caught this.
    expect(
      screen.queryAllByRole('button', { name: /open|where|try/i }),
      'an act that cannot work, offered beside the sentence saying so'
    ).toEqual([])
  })

  it('and nothing for a source the operator may not read', async () => {
    await mount(envelope([withStatus('unauthorized')]))
    expect(screen.getByText(/not permitted to read it/)).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: /open|where|try/i })).toEqual([])
  })

  it('but a failed lookup offers a RETRY, which is a different act', async () => {
    await mount(envelope([withStatus('unavailable')]))
    expect(screen.getByText(/the lookup failed/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again|retry/i })).toBeTruthy()
  })

  it('and a source on another machine offers to LOCATE it, not to open it', async () => {
    await mount(envelope([withStatus('not_on_this_host')]))
    expect(screen.getByText(/on another machine/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /where|locate/i })).toBeTruthy()
  })

  it('and an available source still opens', async () => {
    // The other direction, so the fix is not "offer nothing": the common case
    // must keep working, or the caution has swallowed the feature.
    await mount(envelope([item({ evidence: evidenceOf({ raw: 'task:11111111-1111-1111-1111-111111111111', owner: 'p1', resolved: { found: true } }) })]))
    expect(screen.getByRole('button', { name: /open/i })).toBeTruthy()
  })
})
