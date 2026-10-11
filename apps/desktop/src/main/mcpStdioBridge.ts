// #region mcp-stdio-bridge — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#2-fabrics-surface-reaches-the-agent-per-session-never-through-its-own-config
/**
 * Fabric's stdio bridge (P-10 AS-05, ADR-0119 §2): an MCP server on stdio that relays every message
 * to the session's surface over streamable HTTP. For an agent whose ACP `initialize` declares no
 * HTTP MCP (Cline 3.0.46 and Hermes 0.21.4, measured): `session/new` names this program as a stdio
 * server — once for Fabric's surface, and once per project-granted server on the machine's gateway
 * (audit 2026-10-06 DA-2) — and the credential reaches it in its environment, never in its arguments.
 *
 * A relay, not a second server: it neither reads nor rewrites the messages, so the surface's own
 * authorisation, scoping and refusals are the only ones in force.
 */
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

export interface BridgeEnds {
  /** The agent's side: MCP over this process's stdio. */
  agent: Transport
  /** Fabric's side: the session surface over streamable HTTP, carrying the bearer. */
  surface: Transport
}

/** The HTTP status a transport error carries (the SDK's `StreamableHTTPError.code`), or null. */
const statusOf = (error: unknown): number | null => {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'number' ? code : null
}

/** Pipes both ends into each other; resolves when either closes, after closing the other. */
export async function relay({ agent, surface }: BridgeEnds, log: (line: string) => void = () => {}): Promise<void> {
  let done!: () => void
  const finished = new Promise<void>((resolve) => { done = resolve })
  let closing = false
  const closeBoth = (why: string): void => {
    if (closing) return
    closing = true
    log(`fabric-bridge: ${why}`)
    Promise.allSettled([agent.close(), surface.close()]).then(() => done())
  }
  // A failed relay is answered to the agent as that request's error and the bridge goes on: one
  // transient 5xx used to close it, ending Fabric's tools for the rest of the session (audit
  // 2026-10-05 A6-007). Only a refused credential (401/403) ends it, since nothing later can succeed.
  // Audit 2026-10-05 A7-037: the refusal that ends the bridge answers its request first, and every failure
  // names its HTTP status, so a revoked credential, a 5xx and a refused connection no longer read the same.
  const answer = (message: unknown, text: string): Promise<void> => {
    const id = (message as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number'
      ? agent.send({ jsonrpc: '2.0', id, error: { code: -32603, message: text } })
      : Promise.resolve()
  }
  agent.onmessage = (message) => {
    surface.send(message).catch((error: unknown) => {
      const status = statusOf(error)
      if (status === 401 || status === 403) {
        const why = `the surface refused the session credential (HTTP ${status})`
        // Answered, then closed — whether or not the answer could still be written.
        return void answer(message, `Fabric's surface did not take this request: ${why}`).catch(() => {}).finally(() => closeBoth(why))
      }
      const reason = error instanceof Error && error.message ? error.message : 'no answer'
      log(`fabric-bridge: a message did not reach the surface${status === null ? '' : ` (HTTP ${status})`}: ${reason}`)
      answer(message, `Fabric's surface did not take this request: ${reason}`).catch(() => closeBoth('the agent side is gone'))
    })
  }
  surface.onmessage = (message) => { agent.send(message).catch(() => closeBoth('the agent side is gone')) }
  agent.onclose = () => closeBoth('the agent closed the bridge')
  surface.onclose = () => closeBoth('the surface closed the session')
  agent.onerror = () => { /* stdio errors end in onclose */ }
  // An HTTP error is answered to the agent by the surface, or ends in onclose; it is still said, with its status.
  surface.onerror = (error: unknown) => {
    const status = statusOf(error)
    log(`fabric-bridge: the surface transport reported an error${status === null ? '' : ` (HTTP ${status})`}: ${error instanceof Error && error.message ? error.message : 'no detail'}`)
  }
  await surface.start()
  await agent.start()
  return finished
}
// #endregion mcp-stdio-bridge
