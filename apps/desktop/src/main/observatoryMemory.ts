// #region observatory-memory — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#34-the-packet
/**
 * Fabric's own door to Project Observatory's workflows (CO-409 wave 1, spec §3.4): the dispatcher opens a workflow for
 * a board request and offers it to the default agent. It speaks to Observatory's stdio MCP server, the one every
 * coding agent on this machine runs (`<engine>/mcp/server.py` under the venv's Python), as the built-in local stdio
 * caller, with the owner `service:fabric`. One child at a time, started on first use, closed with the app. Nothing
 * here holds a secret: Observatory names keys and never returns them.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { APP_VERSION } from '../shared/appVersion.ts'

export const FABRIC_OWNER = 'service:fabric'

export interface ObservatoryServer {
  python: string
  server: string
}

/** The Python and the server script, from `project-observatory`'s shebang and `full-path`; null when absent. */
export async function findObservatoryServer(launcher: string | null): Promise<ObservatoryServer | null> {
  if (!launcher) return null
  let python: string | null = null
  try {
    const first = readFileSync(launcher, 'utf8').split('\n', 1)[0] ?? ''
    if (first.startsWith('#!') && path.isAbsolute(first.slice(2).trim())) python = first.slice(2).trim()
  } catch {
    // An unreadable launcher is the same as none: the dispatcher says Observatory is not installed.
    return null
  }
  if (!python) return null
  const engine = await new Promise<string | null>((resolve) => {
    execFile(launcher, ['full-path'], { timeout: 15_000 }, (e, out) => resolve(e ? null : String(out).trim().split('\n').pop() ?? null))
  })
  if (!engine || !path.isAbsolute(engine)) return null
  return { python, server: path.join(engine, 'mcp', 'server.py') }
}

export type ToolCall = (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>

/** A stdio client to Observatory: `call` answers the tool's structured content, or throws with its error. */
export function createObservatoryClient(locate: () => Promise<ObservatoryServer | null>, timeoutMs = 60_000): { call: ToolCall; close(): Promise<void> } {
  let client: Client | null = null
  let connecting: Promise<Client> | null = null
  const connect = async (): Promise<Client> => {
    if (client) return client
    if (connecting) return connecting
    connecting = (async () => {
      const where = await locate()
      if (!where) throw new Error('Project Observatory is not installed on this computer')
      const c = new Client({ name: 'fabric-dispatcher', version: APP_VERSION })
      await c.connect(new StdioClientTransport({ command: where.python, args: [where.server], stderr: 'ignore' }))
      client = c
      return c
    })()
    try { return await connecting } finally { connecting = null }
  }
  return {
    async call(name, args) {
      const c = await connect()
      let result
      try {
        result = await c.callTool({ name, arguments: args }, undefined, { timeout: timeoutMs })
      } catch (e) {
        // A broken child is started again on the next call.
        client = null
        void c.close().catch(() => undefined)
        throw e
      }
      const r = result as { structuredContent?: Record<string, unknown>; content?: Array<{ type: string; text?: string }>; isError?: boolean }
      let body = r.structuredContent
      if (!body) {
        const text = r.content?.find((x) => x.type === 'text')?.text
        try { body = text ? JSON.parse(text) as Record<string, unknown> : {} } catch {
          // A tool that answered plain text: kept as text, the caller reads the ids it needs and refuses without them.
          body = { text }
        }
      }
      if (r.isError) throw new Error(`${name} refused: ${JSON.stringify(body).slice(0, 300)}`)
      return body
    },
    async close() {
      const c = client
      client = null
      if (c) await c.close().catch(() => undefined)
    }
  }
}
// #endregion observatory-memory
