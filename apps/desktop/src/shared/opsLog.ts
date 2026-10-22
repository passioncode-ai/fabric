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

import { redact, redactPayload } from './redact.ts'

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
  const sanitized = redactPayload(raw)
  // Truncating first can remove a PEM footer and turn a recognizable secret
  // into unmatched text. Only already-sanitized values may be capped.
  const payload = cap(sanitized.payload) as Record<string, unknown>
  const redactions = [...sanitized.redactions]
  // The error is said apart from the detail, so a detail key can never stand in for it (final-candidate verification),
  // and only as text: its name and its message, each through the text rules, then capped. What `errorParts` hands over
  // is all text by construction: a plain object's values never reach it (see there).
  let errorField: { name: string; message: string } | undefined
  if (input.error !== undefined) {
    const parts = errorParts(input.error)
    const text = redact(parts.message)
    for (const c of text.redactions) {
      const seen = redactions.find((r) => r.rule === c.rule)
      if (seen) seen.count += c.count
      else redactions.push({ ...c })
    }
    errorField = { name: parts.name, message: String((cap({ m: text.text }) as { m: unknown }).m) }
  }

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

/** A thrown or returned failure, as the log says it, in text only. An Error: its name and message. A plain object with a
 *  string message (PostgREST answers an RPC failure with `{ message, code, details, hint }`, whose `String()` is
 *  «[object Object]», which hid every failed board tick, 0.3.10 review DA-3): its message and code. Any other object:
 *  the NAMES of its own fields, never their values. Three verifications of 0.3.10 found a new way for a value to reach
 *  the log each time the values were written and masked (a field rule, a header pair, an unknown header); names carry
 *  the diagnosis without that risk. It reads each property once, own data properties only, never a getter or `toJSON`,
 *  and nothing it is handed can make the record throw. */
function errorParts(e: unknown): { name: string; message: string } {
  try {
    if (e instanceof Error) {
      const name: unknown = e.name
      const message: unknown = e.message
      return { name: typeof name === 'string' ? name : 'Error', message: typeof message === 'string' ? message : '[omitted: a message that is not text]' }
    }
    if (e === null || typeof e !== 'object') return { name: 'Error', message: typeof e === 'symbol' ? '[omitted: symbol]' : String(e) }
    const own = (key: string): unknown => {
      const d = Object.getOwnPropertyDescriptor(e, key)
      return d && 'value' in d ? d.value : undefined
    }
    const message = own('message')
    const code = own('code')
    const suffix = typeof code === 'string' || typeof code === 'number' ? ` (${String(code).slice(0, 32)})` : ''
    if (typeof message === 'string' && message) return { name: 'Error', message: message + suffix }
    // A name that does not read as a field name (a token used as a key) is not written either.
    const names = Object.keys(e).slice(0, 20).map((k) => (/^[A-Za-z_][A-Za-z_-]{0,19}[0-9]{0,4}$/.test(k) ? k : '[omitted]'))
    return { name: 'Error', message: `[a failure that is not an Error, with no message; its fields: ${names.join(', ') || 'none'}]${suffix}` }
  } catch {
    return { name: 'Error', message: '[omitted: unreadable error]' }
  }
}

/** Is `level` at or above `floor`? So a filter can mean "this and worse". */
export function atLeast(floor: OpsLevel, level: OpsLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(floor)
}

// #region ops-cause — docs: docs/architecture/passioncode-platform.md#12-runtime-reliability-and-observability
/** What kind of failure a caught error was, without its message: its name and its code (a SQLSTATE such as
 *  `57014`, `ECONNREFUSED`, `ABORT_ERR`). Audit 2026-10-05 A7-036: thirteen catches recorded a synthetic error
 *  and dropped the real one, so a stalled database, a refusal and a bug read the same. The message stays out —
 *  those sites keep a dependency's text (which may carry a credential) out of the log on purpose; a name and a
 *  code of a fixed shape carry none. */
export interface OpsCause { name: string; code?: string }

export function causeOf(e: unknown): OpsCause {
  const raw = e as { name?: unknown; code?: unknown } | null
  const name = e instanceof Error && typeof raw?.name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(raw.name)
    ? raw.name : e instanceof Error ? 'Error' : `non-error ${e === null ? 'null' : typeof e}`
  const code = typeof raw?.code === 'number' && Number.isFinite(raw.code) ? String(raw.code)
    : typeof raw?.code === 'string' && /^[A-Za-z0-9_.-]{1,32}$/.test(raw.code) ? raw.code : undefined
  return code === undefined ? { name } : { name, code }
}
// #endregion ops-cause

/** Keep the NEWEST lines. A log that drops the newest to stay small throws away
 *  the failure that is being investigated right now. */
export function trim(lines: string[], keep: number): string[] {
  return lines.length <= keep ? lines : lines.slice(lines.length - keep)
}
