import { describe, expect, it } from 'vitest'
import { bodyFromEnds, TOOL_OUTCOMES, classifyToolOutcome, coverageOf, describeCall, refusalOps, typedRefusalCode } from './toolOutcome.ts'

describe('an HTTP status is not an outcome', () => {
  it('reads a JSON-RPC error inside a 200 as a failure, not a success', () => {
    expect(classifyToolOutcome({ status: 200, body: { error: { code: -32000 } } })).toBe('threw')
  })

  it('separates a schema rejection from a handler that threw', () => {
    // The distinction is the point: one means the agent got the arguments
    // wrong and can fix them, the other means the tool broke.
    expect(classifyToolOutcome({ status: 200, body: { error: { code: -32602 } } })).toBe('schema_error')
    expect(classifyToolOutcome({ status: 200, body: { error: { code: -32601 } } })).toBe('schema_error')
  })

  it('reads a 200 whose result says isError as a failure', () => {
    expect(classifyToolOutcome({ status: 200, body: { result: { isError: true } } })).toBe('threw')
  })

  it('still tells a SCHEMA refusal apart when the SDK hides it inside a normal result', () => {
    // Measured against the real SDK: a call whose arguments fail validation does
    // NOT come back as a JSON-RPC error. It comes back as an ordinary tool
    // result with `isError`, and the only surviving signal is the code the SDK
    // renders into its own message. Without this the trace would file every
    // refused argument as a crashed tool — and send the wrong person looking.
    const refused = {
      status: 200,
      body: {
        result: {
          isError: true,
          content: [{ type: 'text', text: 'MCP error -32602: Input validation error: Invalid arguments for tool t' }]
        }
      }
    }
    expect(classifyToolOutcome(refused)).toBe('schema_error')
  })

  it('does not read a tool that genuinely threw as a schema refusal', () => {
    const threw = {
      status: 200,
      body: { result: { isError: true, content: [{ type: 'text', text: 'the database refused the connection' }] } }
    }
    expect(classifyToolOutcome(threw)).toBe('threw')
  })

  it('reads only the START of the message, so a long result cannot smuggle the prefix', () => {
    const smuggled = {
      status: 200,
      body: {
        result: {
          isError: true,
          content: [{ type: 'text', text: 'x'.repeat(200) + 'MCP error -32602: not really' }]
        }
      }
    }
    expect(classifyToolOutcome(smuggled)).toBe('threw')
  })

  it('reads a plain result as returned', () => {
    expect(classifyToolOutcome({ status: 200, body: { result: {} } })).toBe('returned')
  })

  it('reads any 4xx or 5xx as a refusal before dispatch', () => {
    for (const status of [401, 413, 429, 500])
      expect(classifyToolOutcome({ status, body: null })).toBe('refused')
  })

  it('has UNKNOWN for a response that never completed', () => {
    // Not a failure and not a success. The same third answer the read envelope
    // and the effect intents keep.
    expect(classifyToolOutcome({ status: 200, body: null })).toBe('unknown')
    expect(classifyToolOutcome({ status: 200 })).toBe('unknown')
  })

  it('reads a client that went away as cancelled, whatever the status', () => {
    expect(classifyToolOutcome({ status: 200, body: { result: {} }, clientGone: true })).toBe('cancelled')
  })

  it('enumerates exactly the outcomes a surface can produce', () => {
    expect(TOOL_OUTCOMES).toEqual(['returned', 'refused', 'schema_error', 'threw', 'cancelled', 'unknown'])
  })
})

describe('coverage', () => {
  it('is complete only when nothing is known to be missing', () => {
    expect(coverageOf(0)).toEqual({ complete: true, lost: 0 })
  })

  it('is incomplete when records were lost, and says how many', () => {
    expect(coverageOf(3, 'the sink was unwritable')).toMatchObject({ complete: false, lost: 3 })
  })

  it('admits when it does not even know how many were lost', () => {
    // The honest answer after a sink that failed silently. Claiming zero there
    // is how a partial corpus is reported as a whole one.
    expect(coverageOf(null)).toMatchObject({ complete: false, lost: null })
  })
})

describe('what the call was for, read off the REQUEST', () => {
  it('names the tool a call was for', () => {
    const got = describeCall({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'fabric_task_move' } })
    expect(got).toEqual({ method: 'tools/call', tool: 'fabric_task_move', rpcId: '7' })
  })

  it('still names the tool when the arguments are the thing that is wrong', () => {
    // The whole reason the subject is taken from the request: a call the schema
    // refuses produces a response naming no tool, and it is precisely that call
    // somebody is trying to debug.
    const got = describeCall({ id: 1, method: 'tools/call', params: { name: 'fabric_task_move', arguments: { to: 'nonsense' } } })
    expect(got?.tool).toBe('fabric_task_move')
  })

  it('carries no tool for a method that is not a tool call', () => {
    expect(describeCall({ id: 1, method: 'tools/list' })).toEqual({ method: 'tools/list', tool: null, rpcId: '1' })
  })

  it('keeps the client rpc id, so a retry is recognisable as one', () => {
    expect(describeCall({ id: 'abc', method: 'initialize' })?.rpcId).toBe('abc')
  })

  it('returns nothing for a body that is not a request at all', () => {
    for (const junk of [null, 'x', 42, {}, { params: {} }]) expect(describeCall(junk)).toBeNull()
  })

  it('never carries the arguments', () => {
    // A trace that keeps arguments keeps whatever secret was in them. The
    // redaction door is one layer in; this layer simply never holds them.
    const got = describeCall({ id: 1, method: 'tools/call', params: { name: 't', arguments: { token: 'sk-live-secret' } } })
    expect(JSON.stringify(got)).not.toContain('sk-live')
  })
})

describe('a body too long to keep is read from its two ends (2026-10-14)', () => {
  const big = (result: object) => JSON.stringify({ jsonrpc: '2.0', id: 2, result })
  const ends = (body: string) => bodyFromEnds(body.slice(0, 4096), body.slice(-512), body.length <= 4096)
  it('a long answer that returned is returned, not unknown', () => {
    const body = big({ content: [{ type: 'text', text: 'x'.repeat(20000) }] })
    expect(classifyToolOutcome({ status: 200, body: ends(body) })).toBe('returned')
  })
  it('a long answer that says isError at its end is an error, and the SDK code at its head still names a schema refusal', () => {
    expect(classifyToolOutcome({ status: 200, body: ends(big({ content: [{ type: 'text', text: 'boom ' + 'y'.repeat(9000) }], isError: true })) })).toBe('threw')
    expect(classifyToolOutcome({ status: 200, body: ends(big({ content: [{ type: 'text', text: 'MCP error -32602: bad ' + 'y'.repeat(9000) }], isError: true })) })).toBe('schema_error')
  })
  it('a short body is parsed whole, and a stream that is no JSON-RPC response stays unknown', () => {
    expect(classifyToolOutcome({ status: 200, body: ends(big({ content: [] })) })).toBe('returned')
    expect(classifyToolOutcome({ status: 200, body: ends('event: message\n' + 'z'.repeat(5000)) })).toBe('unknown')
  })
})

describe('the 0.3.8 audit of the 0.3.7 log', () => {
  it('a notification answered 202 with no body was accepted, not unknown', () => {
    expect(classifyToolOutcome({ status: 202 })).toBe('returned')
    // Bytes that are no JSON-RPC answer are still unknown, 202 or not (0.3.8 review ER-7).
    expect(classifyToolOutcome({ status: 202, body: null })).toBe('unknown')
  })
  it('a typed refusal names its code, from structuredContent or from the text block', () => {
    expect(typedRefusalCode({ result: { isError: true, structuredContent: { error: { code: 'needs-grant', message: 'x' } }, content: [] } })).toBe('needs-grant')
    expect(typedRefusalCode({ result: { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: { code: 'no-session' } }) }] } })).toBe('no-session')
  })
  it('a crash, a success and a schema refusal carry no typed code', () => {
    expect(typedRefusalCode({ result: { isError: true, content: [{ type: 'text', text: 'boom' }] } })).toBeNull()
    expect(typedRefusalCode({ result: { content: [{ type: 'text', text: JSON.stringify({ error: { code: 'x-y' } }) }] } })).toBeNull()
    expect(typedRefusalCode({ result: { isError: true, content: [{ type: 'text', text: 'MCP error -32602: bad' }] } })).toBeNull()
    expect(typedRefusalCode({ error: { code: -32000 } })).toBeNull()
  })
})

describe('how a typed refusal is logged (0.3.8 review ER-2)', () => {
  it('a refusal by design is warn and ok; one that may have run is unknown; one that says something failed stays an error', () => {
    expect(refusalOps('needs-grant')).toEqual({ outcome: 'ok', level: 'warn' })
    expect(refusalOps('outcome-unknown')).toEqual({ outcome: 'unknown', level: 'warn' })
    for (const code of ['hub-unavailable', 'product-credential-unavailable', 'product-error', 'internal', 'product-unreachable', 'product-refused', 'product-outdated']) expect(refusalOps(code)).toEqual({ outcome: 'failed', level: 'error' })
    expect(refusalOps('not_available'), 'the board may have stored it').toEqual({ outcome: 'unknown', level: 'warn' })
  })
})
