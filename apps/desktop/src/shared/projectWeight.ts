// A project's weight on the Board — declared tier plus measured pressure (M156).
//
// ADR-0002's rule applied to attention: declared data and observed data are kept
// apart, and a gate fails when the two disagree. The TIER is the operator's
// claim, set explicitly and never mutated by the system. PRESSURE is measured
// beside it, capped, and added — so the board can say "you called this steady;
// it has 4 blocked tasks and a goal due Friday", which is a prompt to re-declare
// rather than a silent promotion.
//
// The cap is the guarantee: pressure may lift a `steady` project above an idle
// `active` one, and may never lift it above `critical`. Attention follows
// evidence; it does not overrule the operator.
//
// This is a SCRIPT, not an agent (ADR-0039 §4): every output is a number a
// comparison can check, so a wrong one is an error the code catches rather than
// one a model introduces.

export type Tier = 'critical' | 'active' | 'steady' | 'paused'

export const TIER_WEIGHT: Record<Tier, number> = {
  critical: 40,
  active: 25,
  steady: 10,
  paused: 0
}

/**
 * The most pressure can add, and its value is forced by two demands that pin it
 * to an open interval rather than a preference:
 *   - a maxed `steady` project must OUTRANK an idle `active` one (evidence wins):
 *     10 + cap > 25  ⟹  cap > 15;
 *   - a maxed `steady` project must stay BELOW a bare `critical` one (the
 *     operator is never overruled): 10 + cap < 40  ⟹  cap < 30.
 * So 15 < cap < 30, and 20 sits in the middle. A flat cap outside this window
 * cannot satisfy both, which the tests hold to.
 */
export const PRESSURE_CAP = 20

export interface ProjectSignals {
  tier: Tier
  blockedTasks: number
  daysSinceOldestOpenQuestion: number
  goalDueWithinWeek: boolean
  ranInLast24h: boolean
}

export interface WeightedProject {
  tier: Tier
  weight: number
  components: { tier: number; pressure: number }
}

export function projectWeight(s: ProjectSignals): WeightedProject {
  const raw =
    4 * Math.max(0, s.blockedTasks) +
    3 * Math.max(0, s.daysSinceOldestOpenQuestion) +
    (s.goalDueWithinWeek ? 15 : 0) +
    (s.ranInLast24h ? 5 : 0)
  const pressure = Math.min(raw, PRESSURE_CAP)
  const tierWeight = TIER_WEIGHT[s.tier]
  return {
    tier: s.tier, // echoed, never changed — the system does not touch the claim
    weight: tierWeight + pressure,
    components: { tier: tierWeight, pressure }
  }
}

// ── CEO trust — ADR-0004's autonomy shape, on a different subject ─────────────

export type CeoTrust = 'ask' | 'cited' | 'routine' | 'proposing'

/** Most restrictive first: an unknown value resolves to index 0, never the top. */
const TRUST_ORDER: CeoTrust[] = ['ask', 'cited', 'routine', 'proposing']

const rank = (t: CeoTrust): number => {
  const i = TRUST_ORDER.indexOf(t)
  return i < 0 ? 0 : i
}

/** An unknown value is not obeyed — it collapses to the most restrictive level.
 *  A typo in a config must fail closed, never open. */
const clamp = (t: CeoTrust): CeoTrust => (TRUST_ORDER.includes(t) ? t : 'ask')

/**
 * The trust in effect for a project: its override, clamped to the estate's.
 *
 * A project may LOWER trust freely and may never EXCEED the estate — the same
 * inheritance a sub-goal has under its parent's autonomy (ADR-0004). So raising
 * trust everywhere is one deliberate act on the estate, not four quiet ones in
 * the projects nobody watches. `null` override inherits the estate unchanged.
 */
export function ceoTrustFor(estate: CeoTrust, projectOverride: CeoTrust | null): CeoTrust {
  if (projectOverride === null) return clamp(estate)
  const e = clamp(estate)
  const o = clamp(projectOverride)
  return rank(o) <= rank(e) ? o : e
}
