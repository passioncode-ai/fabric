// Whether the thing asking could have done it without asking (FA-09).
//
// THE FLOOR IS VOLUNTARY, and that is the finding. `fabric_effect_request` is a
// tool an agent MAY call before an external effect; nothing makes it call one.
// Every runner this product launches has native tools — a shell, a file writer,
// an HTTP client — and Fabric sees none of them. So an `allow` on a floored
// effect authorises the ASKING, and the doing was available all along.
//
// THE CARD ALLOWS TWO ANSWERS: intercept the bypass, or refuse the profile the
// action. Interception is impossible for every runner in this tree — it would
// mean sitting inside another program's tool loop — so the second answer is the
// one that can be true, and this file is it.
//
// CONTAINMENT IS A PROPERTY OF THE PAIR, not of the runner. `claude-code` asking
// a person before each tool is a real gate, weaker than Fabric's and present;
// the same runner started with `--dangerously-skip-permissions` has none. A
// warning string beside that flag was the whole cost of it before this.
//
// AND IT IS DECLARED, then cross-checked. Deriving containment from a flag name
// alone would read a runner whose bypass is spelled differently as contained, so
// the descriptor says it and `check-containment.mjs` refuses a declaration that
// disagrees with the flags beside it.

export type Containment =
  /** Fabric sits between the runner and the world. Nothing does, today. */
  | 'intercepted'
  /** The runner asks a person before each tool. Weaker than Fabric's floor, and
   *  real: somebody sees every act before it happens. */
  | 'runner-gated'
  /** Nothing stands between the runner's native tools and the world. */
  | 'none'

/** Flags that remove a runner's own gate. Named, so a new one has to be added
 *  here deliberately rather than arriving unnoticed inside an args array. */
export const BYPASS_FLAGS = [
  '--dangerously-skip-permissions',
  '--yolo',
  '--auto-approve',
  '--no-confirm'
]

export interface ContainmentVerdict {
  allowed: boolean
  containment: Containment
  reason?: string
  remedy?: string
}

/**
 * May this pair be authorised for an effect at or above the floor?
 *
 * BELOW THE FLOOR NOTHING CHANGES. Those acts are not the ones a grant exists
 * for, and gating them on containment would stop an agent reading a file
 * because it could also have read the file.
 */
export function flooredEffectAllowed(input: {
  containment: Containment
  floorClass: string | null
  runner: string
  permissionMode: string | null
}): ContainmentVerdict {
  if (input.floorClass === null)
    return { allowed: true, containment: input.containment }

  if (input.containment === 'none')
    return {
      allowed: false,
      containment: 'none',
      reason:
        `${input.runner}${input.permissionMode ? ` in ${input.permissionMode} mode` : ''} has native tools Fabric ` +
        `cannot see, so authorising this would authorise the asking and not the doing — the same act was available ` +
        `without a grant the whole time.`,
      remedy:
        'Run it in a mode where the runner asks before each tool, or perform the effect yourself.'
    }

  return { allowed: true, containment: input.containment }
}
