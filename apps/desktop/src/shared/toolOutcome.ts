// What happened to one tool call, as distinct from what HTTP said (S05).
//
// AN HTTP STATUS IS NOT AN OUTCOME. A JSON-RPC error rides inside a 200, and so
// does a tool that answered with `isError: true`. Reading the status as the
// result counts a refused call as a success, which is the specific way a trace
// stops being evidence.
//
// AND THE SDK VALIDATES BEFORE THE HANDLER RUNS. A call whose arguments fail the
// schema never reaches the callback, so a wrapper around the handlers cannot see
// it — it is invisible exactly when an agent is getting the arguments wrong,
// which is when somebody most wants to look. The attempt is therefore opened at
// the transport boundary, before validation, and closed by whatever comes back.

export const TOOL_OUTCOMES = [
  /** The handler answered. */
  'returned',
  /** The surface refused before any dispatch: no credential, budget, body size. */
  'refused',
  /** The SDK rejected the arguments; no handler ran. */
  'schema_error',
  /** The handler threw, or answered with `isError`. */
  'threw',
  /** The client went away before the answer. */
  'cancelled',
  /** The response never completed and we do not know what happened. Not a
   *  failure and not a success — the third answer this whole codebase keeps. */
  'unknown'
] as const

export type ToolOutcome = (typeof TOOL_OUTCOMES)[number]

/** JSON-RPC's own code for "the params did not validate". */
const INVALID_PARAMS = -32602
const METHOD_NOT_FOUND = -32601

export function classifyToolOutcome(input: {
  status: number
  /** The parsed JSON-RPC response, when there was one. */
  body?: { error?: { code?: number }; result?: { isError?: boolean; content?: unknown } } | null
  clientGone?: boolean
}): ToolOutcome {
  if (input.clientGone) return 'cancelled'
  if (input.status >= 400) return 'refused'
  if (input.body === undefined) return 'unknown'
  if (input.body === null) return 'unknown'
  const code = input.body.error?.code
  if (code === INVALID_PARAMS || code === METHOD_NOT_FOUND) return 'schema_error'
  if (code !== undefined) return 'threw'
  // A 200 whose result says it is an error. MEASURED, and it is the reason this
  // function is not three lines: the MCP SDK does NOT return a JSON-RPC error
  // for a call its schema refuses. It catches the validation failure and hands
  // back an ordinary tool result carrying `isError` — so by the envelope alone
  // a refused argument and a tool that crashed are the same shape, and the
  // trace would lose the distinction that decides WHO fixes it.
  if (input.body.result?.isError === true)
    return embeddedCode(input.body.result) === INVALID_PARAMS ? 'schema_error' : 'threw'
  return 'returned'
}

/**
 * The code the SDK renders into its own error text (`MCP error -32602: …`).
 *
 * A STRING CONTRACT, and it is named as one rather than hidden. It is the only
 * signal the envelope carries, and it belongs to a dependency — so it is pinned
 * by a probe that asserts the SDK's ACTUAL rendering
 * (`test/agent-surface.test.mjs`, section 8). An SDK that changes the wording
 * fails that probe instead of quietly re-labelling every schema refusal as a
 * crash for the next year.
 *
 * A tool free-texting the same prefix would be misread. That costs a label on a
 * failure that is a failure either way; being wrong in this direction is cheap,
 * and the alternative is having no distinction at all.
 */
function embeddedCode(result: { content?: unknown }): number | null {
  const first = Array.isArray(result.content) ? result.content[0] : null
  const text = first && typeof first === 'object' && 'text' in first ? (first as { text?: unknown }).text : null
  if (typeof text !== 'string') return null
  const m = /^MCP error (-?\d+):/.exec(text.slice(0, 64))
  return m ? Number(m[1]) : null
}

/**
 * How much of the trace this answer can be believed to cover.
 *
 * `partial` is not a warning, it is a fact about the corpus: an eval that treats
 * a partial trace as complete measures a subset and reports a whole.
 */
export interface TraceCoverage {
  complete: boolean
  /** How many attempts are known to be missing, or null when even that is
   *  unknown — which is the honest answer after a sink that failed silently. */
  lost: number | null
  reason?: string
}

export function coverageOf(lost: number | null, reason?: string): TraceCoverage {
  if (lost === 0) return { complete: true, lost: 0 }
  return { complete: false, lost, ...(reason ? { reason } : {}) }
}

/** What a JSON-RPC request was FOR, as far as a trace needs to know.
 *
 *  The tool name comes off the request rather than the response on purpose: a
 *  call refused by the schema produces a response that names no tool, and that
 *  is exactly the call somebody is trying to debug. */
export interface CallSubject {
  method: string
  /** The tool, for `tools/call`. Null for every other method. */
  tool: string | null
  /** The client's own id, so its retry of the same id is recognisable as a
   *  retry rather than counted as a second call. */
  rpcId: string | null
}

export function describeCall(body: unknown): CallSubject | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as { method?: unknown; params?: { name?: unknown }; id?: unknown }
  if (typeof b.method !== 'string') return null
  return {
    method: b.method,
    tool: b.method === 'tools/call' && typeof b.params?.name === 'string' ? b.params.name : null,
    rpcId: b.id === undefined || b.id === null ? null : String(b.id)
  }
}
