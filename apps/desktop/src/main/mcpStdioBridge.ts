// #region mcp-stdio-bridge — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#2-fabrics-surface-reaches-the-agent-per-session-never-through-its-own-config
/**
 * Fabric's stdio bridge (P-10 AS-05, ADR-0119 §2): an MCP server on stdio that relays every message
 * to the session's surface over streamable HTTP. For an agent whose ACP `initialize` declares no
 * HTTP MCP (Cline 3.0.46, measured): `session/new` names this program as a stdio server, and the
 * credential reaches it in its environment, never in its arguments.
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
  agent.onmessage = (message) => { surface.send(message).catch(() => closeBoth('the surface refused a message')) }
  surface.onmessage = (message) => { agent.send(message).catch(() => closeBoth('the agent side is gone')) }
  agent.onclose = () => closeBoth('the agent closed the bridge')
  surface.onclose = () => closeBoth('the surface closed the session')
  agent.onerror = () => { /* stdio errors end in onclose */ }
  surface.onerror = () => { /* an HTTP error is answered to the agent by the surface, or ends in onclose */ }
  await surface.start()
  await agent.start()
  return finished
}
// #endregion mcp-stdio-bridge
