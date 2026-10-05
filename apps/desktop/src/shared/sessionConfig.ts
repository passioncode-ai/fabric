// #region session-config-content — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#2-fabrics-surface-reaches-the-agent-per-session-never-through-its-own-config
// The per-session config a `config-content-env` runner is started with (ADR-0119, P-10).
//
// Pure: no file, no process, no clock — `sessionBundle.ts` writes nothing from here and
// hands the result to the spawn as ONE environment variable. Kept out of the bundle
// compiler so the shape each dialect needs is tested on its own, without a surface.
import type { Granted } from './servers.ts'
import type { SurfaceConfig } from './agents.ts'

export interface SessionConfigInput {
  /** Fabric's agent surface for this session. */
  endpoint: string
  /** The one-shot scope credential minted for this session. */
  token: string
  /** Gateway servers the project granted, each with its hop's role key. */
  grants: readonly Granted[]
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
      // Kilo's (OpenCode's) dialect: `mcp.<name>` of type `remote` with `headers`, and
      // `instructions` as file paths. The surface is written LAST among the servers so a
      // granted server can never take its name.
      const servers: Record<string, unknown> = {}
      for (const g of input.grants)
        if (g.name !== SURFACE_SERVER)
          servers[g.name] = { type: 'remote', url: g.url, headers: { 'x-agw-key': g.key }, enabled: true }
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
