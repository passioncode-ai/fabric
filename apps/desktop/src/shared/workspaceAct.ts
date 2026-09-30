// What a workspace act tells the operator (UXA-C03).
//
// MEASURED at `c3bbf5d`. UX28-12 made `proposals.decide` render its typed
// refusal at the action — the checker's words, its remedy, whether retrying can
// work, keyed to the row it was asked about. The three workspace acts on the
// same estate screen were run through one helper that erased all three answers
// in its signature:
//
//     const answer = (act: () => Promise<unknown>, id: string) => (): void => {
//       setWsBusy(id)
//       void act()
//         .then(() => window.fabric.workspace.state().then(setWs))
//         .catch((e) => setWsBusy(String(e)))
//         .finally(() => setWsBusy(null))
//     }
//
// `Promise<unknown>` is the defect in one word. `choose` answered whether the
// folder became a repository and why not; `adopt` answered a DELIBERATE refusal
// — "merging two estates is a thing nobody has specified" — and the counts of
// what came in. None of it reached a screen. And a throw was silent twice over:
// the message went into `wsBusy`, `.finally` nulled it on the same turn, and
// `wsBusy` is only ever read as `disabled={…}`, never rendered.
//
// THE CHEAPER MISTAKE, CHOSEN AND SAID (AX-07, AX-16, UXA-C01). Announcing a
// dismissed dialog teaches the operator to ignore announcements; leaving a
// refusal silent teaches them the button does nothing and costs them the
// estate they were trying to keep. So cancellation says nothing and everything
// else speaks.

/** One sentence's worth of outcome, or null when there is nothing to say. */
export type WorkspaceSaid =
  | { said: 'adopted'; projects: number; agents: number }
  | { said: 'refused'; why: string }
  /** The folder is there and carries no version history. ADR-0048 calls the
   *  workspace a versioned private publication; without the repository it is a
   *  folder, and the operator is entitled to know which they have. */
  | { said: 'unversioned'; why: string }
  | { said: 'failed'; why: string }

export function saidOfChoose(
  r: { outcome: 'ready' } | { outcome: 'unversioned'; reason: string } | { outcome: 'cancelled' }
): WorkspaceSaid | null {
  if (r.outcome === 'unversioned') return { said: 'unversioned', why: r.reason }
  // Ready needs no sentence: the question disappears, which is the answer.
  return null
}

export function saidOfAdopt(
  r:
    | { outcome: 'adopted'; projects: number; agents: number }
    | { outcome: 'refused'; reason: string }
    | { outcome: 'cancelled' }
): WorkspaceSaid | null {
  if (r.outcome === 'adopted')
    return { said: 'adopted', projects: r.projects, agents: r.agents }
  if (r.outcome === 'refused') return { said: 'refused', why: r.reason }
  return null
}

/**
 * A throw, said rather than stored.
 *
 * NOT turned into a refusal: a rejected invoke does not say whether the act
 * landed, and inventing a reason here would claim knowledge of something
 * nobody has. The same rule `AttentionPanel` follows on a thrown decide.
 */
export function saidOfThrow(e: unknown): WorkspaceSaid {
  return { said: 'failed', why: e instanceof Error ? e.message : String(e) }
}
