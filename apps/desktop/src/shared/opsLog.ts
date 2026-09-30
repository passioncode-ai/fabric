// What the PROGRAM did, as distinct from what happened to the estate (M81).
//
// TWO PLANES, AND CONFUSING THEM IS THE FAILURE THIS PREVENTS. The journal is
// what happened to the ESTATE: durable, replayable, gapless, and every row of it
// is evidence — which is why `localStore.ts` says the record has to stay smaller
// than what it describes. This is the other plane: what the program did, high
// volume, rotating, disposable, and losing it costs nothing.
//
// MEASURED BEFORE THIS EXISTED. Fifty-one event types in the journal and every
// one of them a business event: not one records that an operation FAILED.
// Thirty-one `console.error` calls in the main process, writing to a terminal a
// packaged Electron app does not have. Eighteen `catch {}` blocks that swallow
// entirely — no console, no record, nothing. So a routine tick that fails at
// three in the morning leaves its evidence in a stream nobody is reading, or
// leaves none at all.
//
// THE THREE PROPERTIES THAT MAKE IT USEFUL RATHER THAN NOISY:
//
//   1. Every record carries a CORRELATION ID. A line nobody can join to the
//      click that caused it is a log you can read and cannot search, and the
//      difference is the whole point.
//   2. An outcome is `ok | failed | unknown`. "We do not know" is a third
//      answer, and it is the honest one for a dispatch whose result never came
//      back — the same vocabulary the read envelope and the effect intents use.
//   3. Nothing secret reaches it. The redaction from M195 runs over the detail
//      AND over the error message, because a failing HTTP client puts the URL it
//      called into the message and a token in a query string is a token in the
//      log. Stacks are dropped: they carry paths, and the name and message are
//      what a reader needs.

import { redactPayload } from './redact.ts'

export const LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type OpsLevel = (typeof LEVELS)[number]

export type OpsOutcome = 'ok' | 'failed' | 'unknown'

/** How much of one value may reach the log. A file's contents, a memory claim
 *  or a transcript would otherwise arrive whole. */
const VALUE_CAP = 600

export interface OpsRecord {
  at: string
  level: OpsLevel
  op: string
  outcome: OpsOutcome
  correlationId: string
  ms?: number
  estateId?: string
  projectId?: string
  sessionId?: string
  detail?: Record<string, unknown>
  error?: { name: string; message: string }
  /** What the redaction removed, by rule and count. Present only when it
   *  removed something, so its presence is itself the signal. */
  redactions?: { rule: string; count: number }[]
}

/** `outcome` already says how it went, so a caller naming a level as well is
 *  answering the same question twice and eventually differently. */
const LEVEL_FOR: Record<OpsOutcome, OpsLevel> = { ok: 'info', unknown: 'warn', failed: 'error' }

/** Bound structure before examining strings. Kept strings remain complete until
 * redaction, because slicing one first can remove a private-key footer. */
function boundStructure(input: Record<string, unknown>): Record<string, unknown> {
  let visited = 0
  const active = new WeakSet<object>()
  const walk = (value: unknown, depth: number): unknown => {
    if (++visited > 1_000) return '[omitted: node limit]'
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint')
      return `[omitted: ${typeof value}]`
    if (value === null || typeof value !== 'object') return value
    if (active.has(value)) return '[omitted: circular]'
    if (depth >= 8) return '[omitted: depth limit]'
    active.add(value)
    const read = (key: string): unknown => {
      if (visited >= 1_000) return '[omitted: node limit]'
      // Logging must not invoke arbitrary getters, including discarded tails.
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return descriptor && 'value' in descriptor
        ? walk(descriptor.value, depth + 1) : '[omitted: accessor]'
    }
    let out: unknown
    if (Array.isArray(value)) {
      const array: unknown[] = []
      for (let i = 0; i < Math.min(value.length, 20); i++) {
        array.push(read(String(i)))
        if (visited >= 1_000) { array.push('[omitted: node limit]'); break }
      }
      out = array
    } else {
      const object: Record<string, unknown> = Object.create(null)
      let count = 0
      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue
        if (count++ >= 20) break
        object[key] = read(key)
        if (visited >= 1_000) { object.__omitted = '[omitted: node limit]'; break }
      }
      out = object
    }
    active.delete(value)
    return out
  }
  return walk(input, 0) as Record<string, unknown>
}

function cap(value: unknown): unknown {
  if (typeof value === 'string' && value.length > VALUE_CAP)
    return `${value.slice(0, VALUE_CAP)}…[truncated, ${value.length} chars]`
  if (Array.isArray(value)) return value.slice(0, 20).map(cap)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = Object.create(null)
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = cap(v)
    return out
  }
  return value
}

export function opsRecord(input: {
  at: Date
  op: string
  outcome: OpsOutcome
  correlationId: string
  level?: OpsLevel
  ms?: number
  estateId?: string
  projectId?: string
  sessionId?: string
  detail?: Record<string, unknown>
  error?: unknown
}): OpsRecord {
  if (!input.correlationId)
    throw new Error(
      'an ops record needs a correlation id: a line that cannot be joined to what caused it is a log you can read and cannot search'
    )

  const raw = boundStructure(input.detail ?? {})
  if (input.error !== undefined) {
    const e = input.error
    raw.__error =
      e instanceof Error ? { name: e.name, message: e.message } : { name: 'Error', message: String(e) }
  }

  const sanitized = redactPayload(raw)
  // Truncating first can remove a PEM footer and turn a recognizable secret
  // into unmatched text. Only already-sanitized values may be capped.
  const payload = cap(sanitized.payload) as Record<string, unknown>
  const redactions = sanitized.redactions
  const errorField = payload.__error as { name: string; message: string } | undefined
  delete payload.__error

  return {
    at: input.at.toISOString(),
    level: input.level ?? LEVEL_FOR[input.outcome],
    op: input.op,
    outcome: input.outcome,
    correlationId: input.correlationId,
    ...(input.ms !== undefined ? { ms: input.ms } : {}),
    ...(input.estateId ? { estateId: input.estateId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(Object.keys(payload).length ? { detail: payload } : {}),
    ...(errorField ? { error: errorField } : {}),
    ...(redactions.length ? { redactions } : {})
  }
}

/** Is `level` at or above `floor`? So a filter can mean "this and worse". */
export function atLeast(floor: OpsLevel, level: OpsLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(floor)
}

/** Keep the NEWEST lines. A log that drops the newest to stay small throws away
 *  the failure that is being investigated right now. */
export function trim(lines: string[], keep: number): string[] {
  return lines.length <= keep ? lines : lines.slice(lines.length - keep)
}
