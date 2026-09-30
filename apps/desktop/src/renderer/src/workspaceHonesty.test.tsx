// The folder is not a backup, and the product says which it is (AX-12).
//
// MEASURED at `ade0954`, three claims that support each other and are all
// false:
//
//   1. `restorability()` — the function `archive.ts` describes as the one that
//      "refuses the word" backup — is called by NOTHING but its own unit test.
//      Ninth instance of this cycle's recurring shape, and the first where the
//      unread thing is the guard on the very claim its card is about.
//   2. The onboarding sentence tells the operator the opposite: "Without one
//      there is no backup and no version history" reads, plainly, as "with one
//      you have a backup". `storageContract.ts` says otherwise in its own words
//      on the `goals` row — "the largest gap in the mirror and the reason it
//      may not be called a backup".
//   3. `archive.ts` justifies the labelling by saying "the screen names the
//      absences". NO renderer file imports `storageContract` at all, so no
//      screen names anything. A comment asserting a property the codebase does
//      not have.
//
// Two of thirty-odd tables are carried. Goals, tasks, questions and routines
// are NOT REBUILDABLE from the mirror, and an operator who declines a folder
// because they already have backups, or keeps one believing they do, is making
// that decision on the product's word.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { EstateHome } from './EstateHome'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { declaredCoverage, restorability } from '../../shared/storageContract'
import { NO_MARKS } from '../../shared/feedMarks'
import { whole } from '../../../test/envelopes'
import { fireEvent } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** The estate has never been asked where its workspace lives. */
function stub(git: 'yes' | 'declined' | 'unanswered' = 'unanswered') {
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window ?? {}, {
      fabric: {
        workspace: { state: vi.fn(async () => ({ path: null, git })) },
        favourites: { list: async () => [] },
        board: { query: async () => ({ rows: [], total: 0 }) },
        attention: { list: async () => whole([]) },
        estate: { summary: async () => null, profile: async () => null },
        memory: { overview: async () => null }
      }
    })
  )
}

const show = () =>
  render(
    <I18nProvider locale="en">
      <EstateHome
        projects={[]}
        sessions={[]}
        feed={[]}
        marks={NO_MARKS}
        readThroughSeq={0}
        onRead={async () => {}}
        onOpen={vi.fn()}
        onNew={vi.fn()}
      />
    </I18nProvider>
  )

describe('the question about a folder does not promise a backup', () => {
  it('the fixture is the ASK, or nothing below is about it', () => {
    // Without this the cases would pass on a screen that never rendered the
    // banner at all — the lesson from the AX-08 fixture that delivered nothing.
    expect(en['workspace.ask'], 'the string must exist to be checked').toBeTruthy()
  })

  it('never tells the operator that the folder IS a backup', () => {
    // The word may appear — saying "this is not a backup" is exactly right —
    // but not as a promise. What is refused is the shape "without one there is
    // no backup", which grants one by implication.
    const ask = en['workspace.ask']
    expect(ask, 'a folder that carries two of thirty tables is not a backup').not.toMatch(
      /there is no backup/i
    )
  })

  it('and the screen NAMES what the folder will not bring back', async () => {
    // `archive.ts` claims this already happens. It did not: no renderer file
    // imported the contract, so the absences existed only in a constant.
    stub()
    show()
    const verdict = restorability(declaredCoverage())
    expect(verdict.restorable, 'the fixture must be an estate that is NOT fully restorable').toBe(false)
    expect(verdict.missing.length, 'and it must have absences to name').toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByText(new RegExp(verdict.missing[0]))).toBeTruthy())
  })

  it('and says it only while the question is open', async () => {
    // A caveat printed for ever becomes furniture. The absences belong beside
    // the decision they inform.
    stub('yes')
    show()
    const verdict = restorability(declaredCoverage())
    await waitFor(() => expect(screen.queryByText(new RegExp(verdict.missing[0]))).toBeNull())
  })
})

// UXA-C03 AT THE OTHER THREE DOORS.
//
// The card names `proposals.decide`, whose typed refusal UX28-12 already
// renders — says, remedy, retryability, keyed to the row, duplicate click
// refused, queue re-read. Measured at `c3bbf5d`, all of it holds and is
// watched. The doctrine it establishes — render the typed refusal AT THE
// ACTION — is not applied to the three workspace acts on this screen, and the
// helper that runs them is where it is lost:
//
//     const answer = (act: () => Promise<unknown>, id: string) => (): void => {
//       setWsBusy(id)
//       void act()
//         .then(() => window.fabric.workspace.state().then(setWs))
//         .catch((e) => setWsBusy(String(e)))
//         .finally(() => setWsBusy(null))
//     }
//
// `Promise<unknown>` ERASES all three answers by signature:
//
//   - `choose()` answers `{ path, repository, reason? }`. The folder is written
//     first and the repository initialised second, so `repository: false` with
//     a reason is a real outcome: the operator has a workspace with NO version
//     history, on the one surface whose purpose (ADR-0048) is a versioned
//     private publication.
//   - `adopt()` answers `{ ok, reason?, projects, agents }`, and its refusal is
//     DELIBERATE and documented in the contract — "refused when this estate
//     already holds projects: merging two estates is a thing nobody has
//     specified". The operator clicks, is refused, and the question stays open
//     with nothing said, so they click again.
//   - a throw is silent TWICE OVER: `.catch` writes the message into `wsBusy`,
//     `.finally` nulls it on the same turn, and `wsBusy` is only ever read as
//     `disabled={wsBusy !== null}` — no surface renders it.
describe('a workspace act says what it did (UXA-C03)', () => {
  const acts = (over: Record<string, unknown>) => {
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        fabric: {
          workspace: {
            state: vi.fn(async () => ({ path: null, git: 'unanswered' })),
            choose: vi.fn(async () => ({ outcome: 'cancelled' as const })),
            adopt: vi.fn(async () => ({ outcome: 'adopted' as const, projects: 1, agents: 1 })),
            decline: vi.fn(async () => undefined),
            ...over
          },
          favourites: { list: async () => [] },
          board: { query: async () => ({ rows: [], total: 0 }) },
          attention: { list: async () => whole([]) },
          estate: { summary: async () => null, profile: async () => null },
          memory: { overview: async () => null }
        }
      })
    )
  }

  const click = async (label: string): Promise<void> => {
    show()
    await waitFor(() => expect(screen.getByText(label)).toBeTruthy())
    fireEvent.click(screen.getByText(label))
  }

  it('the fixture offers the three acts, or nothing below is about them', async () => {
    acts({})
    await click(en['workspace.adopt'])
    await waitFor(() => expect(screen.getByText(en['workspace.choose'])).toBeTruthy())
    expect(screen.getByText(en['workspace.decline'])).toBeTruthy()
  })

  it('says WHY an adoption was refused, instead of leaving the question open in silence', async () => {
    // The contract refuses this on purpose. Refusing in silence teaches the
    // operator that the button does nothing.
    acts({
      adopt: vi.fn(async () => ({
        outcome: 'refused' as const,
        reason: 'this estate already holds projects'
      }))
    })
    await click(en['workspace.adopt'])
    await waitFor(() => expect(screen.getByText(/already holds projects/)).toBeTruthy())
  })

  it('and says WHAT an adoption brought in, rather than only ending the question', async () => {
    acts({ adopt: vi.fn(async () => ({ outcome: 'adopted' as const, projects: 4, agents: 7 })) })
    await click(en['workspace.adopt'])
    await waitFor(() => expect(screen.getByText(/4/)).toBeTruthy())
  })

  it('says the folder has NO version history when the repository was not made', async () => {
    // ADR-0048 calls the workspace a versioned private publication. Without the
    // repository it is a folder, and the operator is not told — on the surface
    // whose entire subject is keeping their estate.
    acts({
      choose: vi.fn(async () => ({
        outcome: 'unversioned' as const,
        path: '/tmp/estate',
        reason: 'git is not installed on this machine'
      }))
    })
    await click(en['workspace.choose'])
    await waitFor(() => expect(screen.getByText(/git is not installed/)).toBeTruthy())
  })

  it('but says nothing when the operator simply closed the dialog', async () => {
    // Cancelling is not an outcome to report. A product that announces every
    // dismissed dialog teaches the operator to dismiss its announcements.
    acts({ choose: vi.fn(async () => ({ outcome: 'cancelled' as const })) })
    await click(en['workspace.choose'])
    await waitFor(() => expect(screen.getByText(en['workspace.choose'])).toBeTruthy())
    // The four sentences this feature can say, by their distinctive words — a
    // loose regex here matched the CEO panel's lede ("questions an agent could
    // not decide") and reported a silence that was never broken.
    for (const said of [/not under version control/i, /was not adopted/i, /^Adopted:/, /did not go through/i])
      expect(screen.queryByText(said), String(said)).toBeNull()
  })

  it('and says nothing when the ADOPT dialog was closed either', async () => {
    // The same silence at the other door. Plant B was caught by the unit test
    // and NOT by this file until this case existed — the pure rule held while
    // the surface had no witness for it, which is the asymmetry this cycle
    // keeps finding one door at a time.
    acts({ adopt: vi.fn(async () => ({ outcome: 'cancelled' as const })) })
    await click(en['workspace.adopt'])
    await waitFor(() => expect(screen.getByText(en['workspace.adopt'])).toBeTruthy())
    for (const said of [/was not adopted/i, /^Adopted:/, /did not go through/i])
      expect(screen.queryByText(said), String(said)).toBeNull()
  })

  it('and a thrown act is SAID, not written into a value nothing renders', async () => {
    acts({ adopt: vi.fn(async () => { throw new Error('the bridge is not answering') }) })
    await click(en['workspace.adopt'])
    await waitFor(() => expect(screen.getByText(/not answering/)).toBeTruthy())
  })
})
