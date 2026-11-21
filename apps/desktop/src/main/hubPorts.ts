// #region hub-ports — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#313-the-hubs-boundary-wave-w1
/**
 * What the hub reads from the window's process (ADR-0195 decision 5, wave W1): the terminals, the sweep of abandoned work,
 * the settings and the agent registry, each named as an interface with one implementation (`windowHubPorts`). Until W1
 * these were closures written inline where `main/index.ts` builds the agent surface, three of them copies of one settings
 * read. W2a adds the fifth, the two acts a product's connection asks of the desktop (open its link, name the app that
 * takes its scheme). W2 gives `fabric-board` its own implementations of the same five; nothing the surface does changes.
 */
import type { PtyManager } from './pty'
import type { AbandonedSweep } from './abandonedSweepRun.ts'
import type { CeoOperations } from './ceoTools.ts'
import type { KnowledgeOperations } from './knowledgeTools.ts'
import type { CeoBoardOperations } from './voiceBoard.ts'
import type { LocalRead } from './localState.ts'
import type { AppSettings } from '../shared/types'
import { workingLanguageOfRead } from '../shared/appSettings.ts'
import type { Nudge } from '../shared/abandonedSweep.ts'
import { machineAgentsOf, type MachineAgents } from '../shared/machineAgents.ts'

/** The terminals Fabric runs, as the hub reads them: one session, a project's sessions, a session's runner. */
export type HubTerminals = Pick<PtyManager, 'get' | 'list' | 'runnerOf'>

/** The sweep's nudges for a session: taken by fabric_work_list and fabric_heartbeat, shown by a turn's answer. */
export interface HubSweep {
  takeNudges(sessionId: string, projectId: string): string[]
  showTurnNudges(sessionId: string, projectId: string, turnKey: string): Nudge[]
}

/** The two settings the hub reads at each fabric_whoami (P-24, ADR-0176 §3); null when the file could not be read. */
export interface HubSettings {
  language(): string | null
  machineTrust(): string | null
}

/** The agents and services of this machine (the operator, 2026-11-07), for each session's fabric_whoami. */
export interface HubRegistry {
  machineAgents(): MachineAgents
}

/** What a product's connection asks of the desktop (`productConnect.ts`): open its sign-in link in the person's browser,
 *  and name the app registered for its callback scheme, null when none is. */
export interface HubLinks {
  openExternal(url: string): Promise<void>
  handlerFor(url: string): Promise<{ name: string; path: string } | null>
}

/** The CEO agent (ADR-0197): which session is the CEO's console, and its session control, given only to that session. */
export interface HubCeo {
  isCeo(sessionId: string): boolean
  operations(): CeoOperations | null
  /** The estate index's two doors (ADR-0200); absent where no index runs. */
  knowledge?(): KnowledgeOperations | null
  /** The board's reads the voice has, as the CEO's own tools (CO-622 item 5); absent where no store runs. */
  board?(): CeoBoardOperations | null
}

export interface HubPorts {
  /** Absent in a process with no CEO (the board's own entry): no session gets the CEO's tools. */
  ceo?: HubCeo
  /** Read late: undefined until the terminal manager exists (`AgentSurfaceDeps.ptys`). */
  terminals(): HubTerminals | undefined
  sweep: HubSweep
  settings: HubSettings
  registry: HubRegistry
  links: HubLinks
}

/** The window's process as the hub's one implementation of its four ports. */
export function windowHubPorts(w: {
  ptys: () => PtyManager | undefined
  /** Null until the sweep starts: no nudges yet. */
  sweep: () => AbandonedSweep | null
  readSettings: () => LocalRead<AppSettings>
  /** The CEO agent, read late: null until it exists. */
  ceo?: () => { isCeo(sessionId: string): boolean; operations(): CeoOperations | null; knowledge?(): KnowledgeOperations | null; board?(): CeoBoardOperations | null } | null
  registry: { snapshot(): Parameters<typeof machineAgentsOf>[0] }
  /** Electron's `shell.openExternal` and `app.getApplicationInfoForProtocol`, handed in so this module imports no Electron. */
  desktop: {
    openExternal(url: string): Promise<void>
    applicationInfoForProtocol(url: string): Promise<{ name: string; path: string }>
  }
}): HubPorts {
  return {
    ...(w.ceo ? { ceo: { isCeo: (id: string) => w.ceo?.()?.isCeo(id) ?? false, operations: () => w.ceo?.()?.operations() ?? null, knowledge: () => w.ceo?.()?.knowledge?.() ?? null, board: () => w.ceo?.()?.board?.() ?? null } } : {}),
    terminals: () => w.ptys(),
    sweep: {
      takeNudges: (sessionId, projectId) => w.sweep()?.takeNudges(sessionId, projectId) ?? [],
      showTurnNudges: (sessionId, projectId, turnKey) => w.sweep()?.showTurnNudges(sessionId, projectId, turnKey) ?? []
    },
    settings: {
      // A settings file that could not be read answers with defaults; unknown is not on, so it names no language
      // (0.3.11 review, iteration 2, ER-3: the person may have switched it off).
      language: () => workingLanguageOfRead(w.readSettings()),
      // ADR-0176 §3: an unreadable settings file reads as not trusted (null), never as the person's last answer.
      machineTrust: () => { const read = w.readSettings(); return read.status === 'unreadable' ? null : read.value.machineTrust }
    },
    registry: { machineAgents: () => machineAgentsOf(w.registry.snapshot()) },
    links: {
      openExternal: (url) => w.desktop.openExternal(url),
      // Electron answers an empty path when no app takes the scheme: that is no handler, not one without a path.
      handlerFor: async (url) => {
        const info = await w.desktop.applicationInfoForProtocol(url)
        return info.path ? { name: info.name, path: info.path } : null
      }
    }
  }
}
// #endregion hub-ports
