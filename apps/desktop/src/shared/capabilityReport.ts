// What a runner can actually do, and how we know (M181, ADR-0043).
//
// MEASURED, and it is a live false alarm rather than a hypothetical: the
// runtime observer passes `beatsSupported: true` as a LITERAL at its only
// production call site. M178 built the `unsupported` coverage precisely so a
// runner nobody wired a heartbeat into is never reported dead — and the caller
// defeats it with a hardcoded true. Three of the four runners in `AGENTS`
// declare `surfaceAdapter: 'none'`, which means no MCP surface at all: they
// cannot beat, cannot acknowledge a delivery, cannot report a trace. Every one
// of their sessions is reported STALLED fifteen minutes in, forever.
//
// SO A CAPABILITY IS NEVER "TESTED" BECAUSE THE RUNNER NAME IS RECOGNISED.
// A declaration is `supported_unverified` — it says what somebody wrote down.
// It becomes `supported_verified` only when the thing was OBSERVED happening:
// a beat that arrived, an acknowledgement that landed. The distinction is the
// whole card, and it is what makes an admission check mean something.
//
// AND A DEGRADED RESULT IS A TUPLE, NOT A BOOLEAN. What was done, what was NOT
// verified, what was left out. A green flag over a run that skipped half its
// checks is the same lie as a mirror that says "backup" over two tables.

export const CAPABILITIES = [
  /** The agent can be handed a structured surface at all. */
  'structured_ready',
  /** It can acknowledge the instruction it was sent (M103). */
  'task_ack',
  /** It can say what it is doing (M178). */
  'heartbeat',
  /** Its tool calls are traceable (S05). */
  'tool_trace',
  /** An effect it performs carries a stable idempotency key (ADR-0050). */
  'effect_idempotency'
] as const
export type Capability = (typeof CAPABILITIES)[number]

export type CapabilityState =
  /** Observed happening. The only state that is evidence. */
  | 'supported_verified'
  /** Declared by the runner descriptor and never seen. */
  | 'supported_unverified'
  /** The runner cannot do this at all. */
  | 'unsupported'
  /** It could, and right now it cannot. */
  | 'temporarily_unavailable'

export interface CapabilityFinding {
  name: Capability
  state: CapabilityState
  /** What made this true. Absent for a declaration, which is the point. */
  evidence?: string
}

export interface CapabilityReport {
  runnerId: string
  /** The adapter the descriptor declares. A NAME, not a measurement. */
  adapter: string
  capabilities: CapabilityFinding[]
  checkedAt: number
}

/** Everything the structured surface provides. A runner without it has none of
 *  them, and saying so is the difference between an honest gap and a false
 *  alarm every fifteen minutes. */
const NEEDS_SURFACE: readonly Capability[] = ['task_ack', 'heartbeat', 'tool_trace', 'effect_idempotency']

/**
 * What the descriptor CLAIMS, before anything has been observed.
 *
 * Everything here is `supported_unverified` or `unsupported`. Nothing this
 * function returns is ever verified, because a descriptor is a sentence
 * somebody wrote and not an observation.
 */
export function declaredCapabilities(input: {
  runnerId: string
  adapter: string
  connectsToSurface: boolean
  now: number
}): CapabilityReport {
  const hasSurface = input.connectsToSurface && input.adapter !== 'none' && input.adapter !== 'unimplemented'
  return {
    runnerId: input.runnerId,
    adapter: input.adapter,
    checkedAt: input.now,
    capabilities: CAPABILITIES.map((name) => ({
      name,
      state:
        name === 'structured_ready'
          ? hasSurface
            ? ('supported_unverified' as const)
            : ('unsupported' as const)
          : hasSurface && NEEDS_SURFACE.includes(name)
            ? ('supported_unverified' as const)
            : ('unsupported' as const)
    }))
  }
}

/** Promote a declaration to verified, because the thing was seen happening. */
export function withObserved(
  report: CapabilityReport,
  name: Capability,
  evidence: string
): CapabilityReport {
  return {
    ...report,
    capabilities: report.capabilities.map((c) =>
      c.name === name && c.state !== 'unsupported'
        ? { ...c, state: 'supported_verified' as const, evidence }
        : c
    )
  }
}

export function stateOf(report: CapabilityReport, name: Capability): CapabilityState {
  return report.capabilities.find((c) => c.name === name)?.state ?? 'unsupported'
}

/** Is this capability there at all — however we came to believe it? Used where
 *  the question is "may I expect this", not "has it been proven". */
export function isAvailable(report: CapabilityReport, name: Capability): boolean {
  const s = stateOf(report, name)
  return s === 'supported_verified' || s === 'supported_unverified'
}

export type ExecutionMode = 'full' | 'degraded_optional' | 'blocked_required'

/**
 * May this workload run, and how honestly?
 *
 * A REQUIRED capability that is not `supported_verified` blocks. Not merely
 * absent — UNVERIFIED blocks too, because "the descriptor says so" is exactly
 * the evidence this module exists to refuse for anything safety-bearing.
 */
export function resolveExecutionMode(input: {
  report: CapabilityReport
  required: readonly Capability[]
  optional: readonly Capability[]
}): { mode: ExecutionMode; missingRequired: Capability[]; missingOptional: Capability[]; says: string } {
  const missingRequired = input.required.filter((c) => stateOf(input.report, c) !== 'supported_verified')
  const missingOptional = input.optional.filter((c) => !isAvailable(input.report, c))
  if (missingRequired.length > 0)
    return {
      mode: 'blocked_required',
      missingRequired,
      missingOptional,
      says: `this work needs ${missingRequired.join(', ')} proven, and on ${input.report.runnerId} it is not`
    }
  if (missingOptional.length > 0)
    return {
      mode: 'degraded_optional',
      missingRequired,
      missingOptional,
      says: `${input.report.runnerId} cannot ${missingOptional.join(', ')}; the work runs and those go unrecorded`
    }
  return { mode: 'full', missingRequired, missingOptional, says: 'everything this work needs is available' }
}

export interface Degradation {
  /** What WAS done. */
  claims: string[]
  /** What could not be checked, and must not read as checked. */
  notVerified: string[]
  /** Inputs that were unreachable, so the result is over less than it looks. */
  omittedInputs: string[]
  completionAssessment: 'complete' | 'partial' | 'unknown'
}

/**
 * A degraded outcome, as a tuple.
 *
 * Never a boolean. `complete` requires nothing unverified and nothing omitted;
 * a run with an unreachable source is `partial` however many of its own steps
 * succeeded, and a run that could not tell is `unknown`.
 */
export function deriveDegradation(input: {
  claims: readonly string[]
  notVerified: readonly string[]
  omittedInputs: readonly string[]
  sourceReachable: boolean
}): Degradation {
  const base = {
    claims: [...input.claims],
    notVerified: [...input.notVerified],
    omittedInputs: [...input.omittedInputs]
  }
  if (!input.sourceReachable) return { ...base, completionAssessment: 'unknown' }
  if (base.notVerified.length === 0 && base.omittedInputs.length === 0)
    return { ...base, completionAssessment: 'complete' }
  return { ...base, completionAssessment: 'partial' }
}
