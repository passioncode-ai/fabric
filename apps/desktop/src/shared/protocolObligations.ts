// Which rules are walls, and which are advice (M155, ADR-0026).
//
// MEASURED: `fabric_whoami` hands an agent eight rules as one flat list of
// imperatives, and their actual force is completely different.
//
//   "You can only see and touch this project"  — REFUSED. The scoped store
//                                                throws `OutOfScope`.
//   "Claim a task before working on it"        — NOTHING CHECKS THIS. No lease
//                                                is consulted before a move.
//   "Read your context pack first"             — advice.
//   "Spending money needs a person"            — refused at Fabric's door, and
//                                                unenforceable for a CLI that
//                                                can curl. Stated as an absolute.
//
// An agent cannot tell which of those is a wall, and neither can an operator
// reading them. Told "claim before working" in the same voice as "you cannot
// see other projects", both read as enforced — and one of them is a hope.
//
// THE LABEL IS EARNED, NOT ASSERTED. A REFUSED obligation must name the symbol
// that does the refusing, and `scripts/check-obligations.mjs` resolves it. A
// voluntary client cannot be given an enforced label by writing a firmer
// sentence, which is the whole failure mode: intent text counted as
// enforcement.
//
// AND SCOPE IS PART OF THE TRUTH. Fabric can refuse an effect that goes through
// its own door. It cannot refuse a native CLI writing a file directly, and a
// rule that says "never" where only "never through here" holds is a guarantee
// the product does not have.

export type ObligationMode =
  /** The server refuses. There is an executable test and a named symbol. */
  | 'REFUSED'
  /** Not refused, but recorded: a host fact somebody can check afterwards. */
  | 'OBSERVED'
  /** Guidance. It never blocks anything, and saying so is honest rather than
   *  weak — an agent that discovers a "rule" was advice stops believing the
   *  rest. */
  | 'ADVICE'

export type ObligationScope =
  /** True of anything reaching Fabric, whatever the runner does elsewhere. */
  | 'fabric_mediated'
  /** True of the runner's own behaviour too. Nothing here claims this yet:
   *  it needs the runner certified, not the door guarded. */
  | 'native_too'

export interface ProtocolObligation {
  id: string
  /** What the agent is told, in the agent's own reading. */
  text: string
  mode: ObligationMode
  scope: ObligationScope
  /** REQUIRED for REFUSED, and resolved by the gate. `file#symbol`. */
  enforcementPoint?: string
  /** For OBSERVED: what is recorded, so "was this followed" is answerable. */
  evidence?: string
}

export const OBLIGATIONS: readonly ProtocolObligation[] = [
  {
    id: 'scope.one-project',
    text: 'You can only see and touch this project. Other projects are not visible through this door.',
    mode: 'REFUSED',
    scope: 'fabric_mediated',
    enforcementPoint: 'apps/desktop/src/main/scopedStore.ts#OutOfScope'
  },
  {
    id: 'floor.ask-first',
    text:
      'Spending money, deleting what cannot be recovered, and publishing outward need a person. Ask with ' +
      'fabric_effect_request BEFORE doing one. The first answer is always a refusal — that is the operator ' +
      'being asked, not a failure. Ask again once they have agreed; you never hold the permission yourself. ' +
      'This is enforced for anything you do THROUGH Fabric; what your own tools can reach directly, Fabric ' +
      'cannot stop — it is on you.',
    mode: 'REFUSED',
    // NAMED, because the old wording claimed an absolute. A native CLI can write
    // a file or call an API without passing this door, and a rule that says
    // "never" where only "never through here" holds is a guarantee the product
    // does not have.
    scope: 'fabric_mediated',
    enforcementPoint: 'apps/desktop/src/main/policy.ts#decide'
  },
  {
    id: 'ladder.no-self-close',
    text: 'You cannot close a task yourself. Move it to review and a person decides.',
    mode: 'REFUSED',
    scope: 'fabric_mediated',
    enforcementPoint: 'apps/desktop/src/shared/ladder.ts#mayMove'
  },
  {
    id: 'delivery.confirm',
    text:
      'Confirm the instruction you were handed with fabric_task_accept, quoting the digest that came with it. ' +
      'Until you do, the task is not recorded as running.',
    mode: 'REFUSED',
    scope: 'fabric_mediated',
    enforcementPoint: 'supabase/migrations/20260927000060_continuation_dispatch.sql#acknowledge_delivery'
  },
  {
    id: 'claim.before-working',
    text:
      'Claim a task with fabric_task_claim before working on it, and check fabric_leases_list first — the claim ' +
      'is how a neighbour sees that the work is taken. Nothing stops you skipping this; the cost is landing on ' +
      'the same files as somebody else.',
    // MEASURED AS ADVICE. No lease is consulted before a move, so the old
    // wording asked for something no mechanism holds — and told it in the same
    // voice as the rules that do.
    mode: 'ADVICE',
    scope: 'fabric_mediated'
  },
  {
    id: 'claims.are-yours',
    text:
      'Your report is recorded as YOUR CLAIM. Fabric separately observes this session, and the two are kept ' +
      'apart. Do not describe work as done that you have not verified.',
    mode: 'OBSERVED',
    scope: 'fabric_mediated',
    evidence: 'agent_stages rows carry the claim; session.observed@1 carries what the harness saw'
  },
  {
    id: 'orientation.read-pack',
    text:
      'Read your context pack first — it is what Fabric already knows about this project, and it cites where ' +
      'each line came from.',
    mode: 'OBSERVED',
    scope: 'fabric_mediated',
    evidence: 'session.oriented@1 records the ask; its absence is unconfirmed rather than proof (M179)'
  },
  {
    id: 'progress.report-stage',
    text:
      'Report your stage with fabric_stage_report as you move through the work. It is how the operator sees ' +
      'progress without reading your whole transcript.',
    mode: 'ADVICE',
    scope: 'fabric_mediated'
  },
  {
    id: 'memory.write-what-you-learn',
    text: 'Write what you learn about this project with fabric_memory_remember, and cite where you learned it.',
    mode: 'ADVICE',
    scope: 'fabric_mediated'
  },
  {
    id: 'notes.are-working-context',
    text:
      'Notes on a task (fabric_task_note) are working context, not documentation. What deserves to outlive the ' +
      'task goes to fabric_memory_remember instead.',
    mode: 'ADVICE',
    scope: 'fabric_mediated'
  }
]

/** How a rule reads to an agent, once it says what kind of rule it is. */
export function labelled(o: ProtocolObligation): string {
  const prefix =
    o.mode === 'REFUSED'
      ? 'ENFORCED'
      : o.mode === 'OBSERVED'
        ? 'WATCHED'
        : 'ADVICE'
  return `[${prefix}] ${o.text}`
}

export interface CoverageRow {
  obligationId: string
  status: 'enforced' | 'observed' | 'unsupported' | 'unknown'
}

/**
 * What this runner is actually held to.
 *
 * UNSUPPORTED AND UNKNOWN ARE NOT THE SAME, and the card is explicit about it:
 * unsupported is a known absence of capability, unknown is unmeasured. A runner
 * with no structured surface CANNOT be held to a delivery acknowledgement —
 * that is unsupported. A runner nobody has tested is unknown, and reporting it
 * as enforced because the obligation says REFUSED would be the same "recognised
 * by name" inference M181 refuses.
 */
export function coverageFor(input: {
  obligations: readonly ProtocolObligation[]
  /** Which obligations this runner's surface can even participate in. */
  supported: (id: string) => boolean | 'unknown'
}): CoverageRow[] {
  return input.obligations.map((o) => {
    const s = input.supported(o.id)
    if (s === 'unknown') return { obligationId: o.id, status: 'unknown' as const }
    if (!s) return { obligationId: o.id, status: 'unsupported' as const }
    return {
      obligationId: o.id,
      status: o.mode === 'REFUSED' ? ('enforced' as const) : ('observed' as const)
    }
  })
}
