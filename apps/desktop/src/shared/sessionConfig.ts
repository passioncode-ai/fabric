// #region session-config-content — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#amendment-1--2026-10-05-a-terminal-session-takes-its-config-from-the-runners-own-content-variable
// The per-session config a `config-content-env` runner is started with (ADR-0119, P-10).
//
// Pure: no file, no process, no clock — `sessionBundle.ts` writes nothing from here and
// hands the result to the spawn as ONE environment variable. Kept out of the bundle
// compiler so the shape each dialect needs is tested on its own, without a surface.
import type { SessionProduct } from './servers.ts'
import type { SurfaceConfig } from './agents.ts'

export interface SessionConfigInput {
  /** Fabric's agent surface for this session. */
  endpoint: string
  /** The one-shot scope credential minted for this session. */
  token: string
  /** The family products the project grants, each as its registry entry declares it — no credential (servers.ts). */
  grants: readonly SessionProduct[]
  /** Files the runner reads as instructions: the brief and Fabric's preamble. */
  instructions: readonly string[]
  /** The chosen permission mode's fragment. */
  modeConfig: Readonly<Record<string, unknown>> | null
}

/** The server name Fabric's surface goes under, the name every brief and tool refers to. */
export const SURFACE_SERVER = 'fabric'

export function sessionConfig(format: SurfaceConfig['format'], input: SessionConfigInput): Record<string, unknown> {
  switch (format) {
    case 'kilo': {
      // Kilo's (OpenCode's) dialect: `mcp.<name>` of type `remote` (a URL) or `local` (one command
      // array, measured: `kilo mcp add`, 2026-10-11), and `instructions` as file paths. A granted
      // product carries no header: only the surface, the first server, carries a credential (SH-9).
      // The surface is written LAST so a granted server can never take its name.
      const servers: Record<string, unknown> = {}
      for (const g of input.grants)
        if (g.name !== SURFACE_SERVER)
          servers[g.name] = g.server.kind === 'http'
            ? { type: 'remote', url: g.server.url, enabled: true }
            : { type: 'local', command: [g.server.command, ...g.server.args], enabled: true }
      servers[SURFACE_SERVER] = {
        type: 'remote',
        url: input.endpoint,
        headers: { Authorization: `Bearer ${input.token}` },
        enabled: true
      }
      return {
        $schema: 'https://kilo.ai/config.json',
        ...(input.modeConfig ?? {}),
        mcp: servers,
        instructions: [...input.instructions]
      }
    }
  }
}
// #endregion session-config-content
