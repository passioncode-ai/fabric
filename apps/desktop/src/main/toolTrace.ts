// One attempt identity for every tool call, whatever happened to it (S05).
//
// MEASURED BEFORE THIS EXISTED: the agent surface counted calls — `callsInWindow++`
// — and recorded nothing else. Which tool, how long, whether it returned or was
// refused: none of it left a trace. A session that spent an hour being refused
// by a schema and one that spent an hour working looked identical afterwards.
//
// THE TRACE SITS AT THE TRANSPORT, NOT AROUND THE HANDLERS, and that is the
// whole design. The MCP SDK validates arguments BEFORE dispatching, so a call
// whose arguments fail the schema never reaches a callback — a wrapper around
// the tool functions is blind exactly when an agent is getting the arguments
// wrong, which is when somebody most wants to look. Installed here, one call
// covers all nine of `handle`'s exits, including the four that answer 401
// before any handler exists. Eight remembered call sites would hold until
// somebody added a ninth.
//
// IT READS WHAT WAS WRITTEN, NOT WHAT WAS RETURNED. A JSON-RPC error rides
// inside a 200 and so does a tool answering `isError`. The tap keeps a bounded
// peek at the response body for exactly that classification and throws the rest
// away — a trace that kept results would keep whatever secret was in one.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { classifyToolOutcome, describeCall, type ToolOutcome } from '../shared/toolOutcome.ts'
import { ops } from './opsSink.ts'
import type { OpsOutcome } from '../shared/opsLog.ts'

/** Enough for a JSON-RPC error envelope, far too little for a tool result. The
 *  trace must not grow with the size of the answers it is watching. */
const PEEK_BYTES = 4_096

/** The three-value outcome the ops log speaks, from the six this one does. A
 *  refusal is not a failure of the process — the surface did its job — so it is
 *  `ok` at level warn rather than `failed`, and a search for real breakage is
 *  not drowned by an agent guessing at arguments. */
const OPS_OUTCOME: Record<ToolOutcome, { outcome: OpsOutcome; level: 'info' | 'warn' | 'error' }> = {
  returned: { outcome: 'ok', level: 'info' },
  refused: { outcome: 'ok', level: 'warn' },
  schema_error: { outcome: 'ok', level: 'warn' },
  threw: { outcome: 'failed', level: 'error' },
  cancelled: { outcome: 'unknown', level: 'warn' },
  unknown: { outcome: 'unknown', level: 'warn' }
}

export interface AttemptContext {
  correlationId: string
  sessionId?: string
  estateId?: string
  projectId?: string
}

export interface Attempt {
  /** The attempt's own id. Everything the call causes carries it, so a journal
   *  event and the refusal that followed it join up without a timestamp guess. */
  id: string
  /** The body arrives AFTER the credential checks — a request refused for a
   *  bad bearer is refused before anyone reads it — so the subject is filled in
   *  when it becomes known. Until then the attempt is honestly anonymous rather
   *  than falsely attributed to a tool nobody named. */
  saw(body: unknown): void
  /** Called by the surface when IT decides the outcome before the transport
   *  does — a refusal it writes itself. Optional: with nothing called, the tap
   *  still classifies from what reached the socket. */
  refused(reason: string): void
}

/**
 * Watch one request through to whatever ends it.
 *
 * Returns immediately; the record is written when the response finishes, or
 * when the socket closes without one.
 */
export function beginAttempt(input: {
  req: IncomingMessage
  res: ServerResponse
  /** Read at RECORD time, not at call time. The estate and the session are only
   *  known once the credential resolves, which is after this is installed; the
   *  caller fills the same object in and the record carries what was true. */
  ctx: AttemptContext
  now?: () => number
}): Attempt {
  const now = input.now ?? (() => Date.now())
  const started = now()
  let subject: ReturnType<typeof describeCall> = null
  const id = `${input.ctx.correlationId}:${started.toString(36)}`

  let peek = ''
  let refusedReason: string | null = null
  let recorded = false

  // Tapping `write`/`end` rather than asking the transport: the transport is a
  // dependency and its response shape is its business. The socket is the one
  // thing every path here shares.
  const originalWrite = input.res.write.bind(input.res)
  const originalEnd = input.res.end.bind(input.res)
  const keep = (chunk: unknown): void => {
    if (peek.length >= PEEK_BYTES) return
    if (typeof chunk === 'string') peek += chunk
    // ANY byte view, not `Buffer.isBuffer`. The MCP SDK writes a plain
    // Uint8Array, for which `isBuffer` is false — measured, and it silently
    // dropped every response body into `unknown`. A tap that recognises one
    // encoding of bytes is a tap that stops working when a dependency changes
    // which one it uses, and reports nothing while it does.
    else if (ArrayBuffer.isView(chunk))
      peek += Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString('utf8')
    if (peek.length > PEEK_BYTES) peek = peek.slice(0, PEEK_BYTES)
  }
  input.res.write = ((chunk: unknown, ...rest: unknown[]) => {
    keep(chunk)
    return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...rest)
  }) as typeof input.res.write
  input.res.end = ((chunk?: unknown, ...rest: unknown[]) => {
    if (chunk !== undefined && typeof chunk !== 'function') keep(chunk)
    return (originalEnd as (...a: unknown[]) => ServerResponse)(chunk, ...rest)
  }) as typeof input.res.end

  const write = (outcome: ToolOutcome): void => {
    if (recorded) return
    recorded = true
    const mapped = OPS_OUTCOME[outcome]
    ops.record({
      op: subject?.tool ? `tool.${subject.tool}` : `mcp.${subject?.method ?? 'unparsed'}`,
      outcome: mapped.outcome,
      level: mapped.level,
      ms: now() - started,
      ctx: {
        correlationId: input.ctx.correlationId,
        ...(input.ctx.estateId ? { estateId: input.ctx.estateId } : {}),
        ...(input.ctx.projectId ? { projectId: input.ctx.projectId } : {}),
        ...(input.ctx.sessionId ? { sessionId: input.ctx.sessionId } : {})
      },
      detail: {
        attempt_id: id,
        // The FINE outcome, beside the coarse one the log speaks. A refusal by
        // schema and a handler that threw are both "not a result" and they are
        // fixed by completely different people.
        trace_outcome: outcome,
        status: input.res.statusCode,
        ...(subject?.rpcId ? { rpc_id: subject.rpcId } : {}),
        ...(refusedReason ? { refused: refusedReason } : {})
      }
    })
  }

  input.res.on('finish', () => {
    let parsed: { error?: { code?: number }; result?: { isError?: boolean } } | null = null
    try {
      parsed = peek ? (JSON.parse(peek) as typeof parsed) : null
    } catch {
      // A body that does not parse is not a lie about the outcome — it is a
      // stream, or a peek cut mid-object. The status still classifies it, and
      // `unknown` is the honest answer for a 200 nobody could read.
      parsed = null
    }
    write(classifyToolOutcome({ status: input.res.statusCode, body: parsed }))
  })

  input.res.on('close', () => {
    if (recorded) return
    // No response, and the socket is gone. Whether the client hung up or the
    // process fell over changes who is at fault, so they are not merged.
    write(input.req.destroyed ? 'cancelled' : 'unknown')
  })

  return {
    id,
    saw(body) {
      subject = describeCall(body)
    },
    refused(reason) {
      refusedReason = reason
    }
  }
}
