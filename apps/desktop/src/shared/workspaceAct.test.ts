// What a workspace act is allowed to say (UXA-C03).
//
// The three acts on the estate home were run through a helper typed
// `(act: () => Promise<unknown>)`, which erased every answer by signature
// before anything could read it. `choose` reported whether the folder became a
// repository and why not; `adopt` reported a refusal the contract makes
// DELIBERATELY, and the counts of what came in. None of it reached a screen.

import { describe, expect, it } from 'vitest'
import { saidOfAdopt, saidOfChoose, saidOfThrow } from './workspaceAct.ts'

describe('choosing a folder', () => {
  it('says NOTHING when the operator closed the dialog', () => {
    // The cheaper mistake, chosen and said: announcing a dismissed dialog
    // teaches the operator to ignore announcements.
    expect(saidOfChoose({ outcome: 'cancelled' })).toBeNull()
  })

  it('and nothing when the folder is there and versioned — the question vanishing IS the answer', () => {
    expect(saidOfChoose({ outcome: 'ready' })).toBeNull()
  })

  it('but SAYS SO when the folder has no version history, carrying the reason', () => {
    // ADR-0048 calls the workspace a versioned private publication. Without the
    // repository it is a folder, and the operator decides what to keep on the
    // product's word.
    const said = saidOfChoose({ outcome: 'unversioned', reason: 'git is not installed' })
    expect(said).toEqual({ said: 'unversioned', why: 'git is not installed' })
  })
})

describe('adopting one', () => {
  it('says nothing when the dialog was closed', () => {
    // This is the case the old shape could not express: the handler answered
    // `{ ok: false, reason: 'nothing was chosen' }`, so telling a closed dialog
    // from an estate that genuinely cannot adopt meant matching on a message.
    expect(saidOfAdopt({ outcome: 'cancelled' })).toBeNull()
  })

  it('names the refusal the contract makes on purpose', () => {
    const said = saidOfAdopt({ outcome: 'refused', reason: 'this estate already holds projects' })
    expect(said).toEqual({ said: 'refused', why: 'this estate already holds projects' })
  })

  it('and carries WHAT came in, so nothing adopted differs from forty projects', () => {
    expect(saidOfAdopt({ outcome: 'adopted', projects: 40, agents: 7 })).toEqual({
      said: 'adopted',
      projects: 40,
      agents: 7
    })
    expect(saidOfAdopt({ outcome: 'adopted', projects: 0, agents: 0 })).toEqual({
      said: 'adopted',
      projects: 0,
      agents: 0
    })
  })
})

describe('an act that threw', () => {
  it('is reported as itself, never as a refusal', () => {
    // A rejected invoke does not say whether the act landed. Turning it into a
    // refusal would claim the estate refused when nobody can say it was asked.
    expect(saidOfThrow(new Error('the bridge is not answering'))).toEqual({
      said: 'failed',
      why: 'the bridge is not answering'
    })
    expect(saidOfThrow('gone')).toEqual({ said: 'failed', why: 'gone' })
  })
})
