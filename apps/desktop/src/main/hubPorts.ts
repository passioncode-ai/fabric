// #region hub-ports — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#313-the-hubs-boundary-wave-w1
/**
 * What the hub reads from the window's process (ADR-0195 decision 5, wave W1): the terminals, the sweep of abandoned work,
 * the settings and the agent registry, each named as an interface with one implementation (`windowHubPorts`). Until W1
 * these were closures written inline where `main/index.ts` builds the agent surface, three of them copies of one settings
 * read. W2 gives `fabric-board` its own implementations of the same four; nothing the surface does changes with W1.
 */
import type { PtyManager } from './pty'
import type { AbandonedSweep } from './abandonedSweepRun.ts'
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

export interface HubPorts {
  /** Read late: undefined until the terminal manager exists (`AgentSurfaceDeps.ptys`). */
  terminals(): HubTerminals | undefined
  sweep: HubSweep
  settings: HubSettings
  registry: HubRegistry
}

/** The window's process as the hub's one implementation of its four ports. */
export function windowHubPorts(w: {
  ptys: () => PtyManager | undefined
  /** Null until the sweep starts: no nudges yet. */
  sweep: () => AbandonedSweep | null
  readSettings: () => LocalRead<AppSettings>
  registry: { snapshot(): Parameters<typeof machineAgentsOf>[0] }
}): HubPorts {
  return {
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
    registry: { machineAgents: () => machineAgentsOf(w.registry.snapshot()) }
  }
}
// #endregion hub-ports
