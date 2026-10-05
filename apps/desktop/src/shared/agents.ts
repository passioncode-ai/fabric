import type { Containment } from './containment.ts'

// The agent registry (M146 step 6 · M116's second half · M17's shape).
//
// Before this file, adding a third agent meant editing `launchOptions()` in the
// pty module, the option type, the picker and the bundle's argument builder —
// four places, none of which named the others. Here an agent is ONE descriptor,
// and everything else reads it.
//
// WHY IT IS CODE AND NOT A TABLE. A row in the database would let an agent be
// added at runtime, which is M17's ("create an agent from a prompt") and is not
// scheduled. Building the table now would be a schema nobody writes to, and the
// projector branch for `agent.registered@1` stays deliberately empty with this
// file as its reason. Return trigger: the first time an agent must exist
// without a release, this becomes the seed of a projection rather than the
// registry itself.
//
// WHAT A PERMISSION MODE IS. Not a preference and not a setting: it is chosen
// per LAUNCH and travels in `terminal.opened@1`, so "what was this session
// allowed to do" is answerable from the record months later. The mode Orca
// calls a permission profile, this repository already studied and recorded on
// 2026-09-02; the shape here is that lesson with the journal underneath it.

export interface PermissionMode {
  id: string
  /** A key in the string registry — the label is interface text. */
  labelKey: string
  /** Appended to the program's arguments when this mode is chosen. */
  args: readonly string[]
  /**
   * What stands between this mode's native tools and the world (FA-09).
   *
   * Declared rather than derived from the flags, because a runner whose bypass
   * is spelled differently would read as contained; `check-containment.mjs`
   * refuses a declaration that disagrees with the flags beside it.
   */
  containment: Containment
  /**
   * Set when the mode exists but must not be chosen yet, naming what would have
   * to ship first. A mode that is merely absent teaches nothing; a mode that is
   * present and refused with a reason is a decision the operator can read.
   */
  blockedKey?: string
  /**
   * Set when the mode is available and carries a risk the operator should hold
   * in mind. A warning is NOT a weaker block: it is what a block becomes when
   * the thing it waited for has shipped and a residue remains. Turning a block
   * into silence would spend the reader's trust once and keep nothing.
   */
  warnKey?: string
  /**
   * For a runner told about Fabric through a per-session config (`config-content-env`):
   * the fragment this mode adds to that config. Kilo's permissions live there, not in
   * a flag, so its gate is declared here and `check-containment.mjs` reads it: a
   * fragment that allows everything (`'*': 'allow'`) is declared `none`.
   */
  config?: Readonly<Record<string, unknown>>
}

/**
 * How a CLI is told where Fabric's MCP config is.
 *
 * THIS WAS A FIELD NOTHING READ. It was declared in step 6 and only the TEST
 * looked at it — asserting that a constant equalled itself — while the bundle
 * compiler hardcoded Claude Code's flags for every agent that connects. A
 * second surface-connecting agent would have been launched with another
 * program's arguments and either failed to start or started with no Fabric
 * tools and no complaint.
 *
 * `unimplemented` exists so that stays impossible: an agent may DECLARE an
 * adapter before anyone has written it, and the launch refuses rather than
 * quietly borrowing the flags of whoever went first.
 */
export type SurfaceAdapter = 'mcp-config-flag' | 'config-content-env' | 'none' | 'unimplemented'

/**
 * `config-content-env` (ADR-0119): the runner reads a whole config document from one
 * environment variable, and that document outranks the project's own config file —
 * MEASURED, not assumed: Kilo 7.4.17 lets a project `kilo.json` override `KILO_CONFIG`
 * (a file) but not `KILO_CONFIG_CONTENT` (`kilo debug config`, 2026-10-05, report
 * `raw/probes/kilo-7.4.17-config-precedence.txt`). Through the file, a project could
 * loosen the session's permissions or point Fabric's server name at another URL that
 * then inherits its authorization header; through the content variable it can do neither.
 */
export interface SurfaceConfig {
  /** The variable holding the session's config document. */
  env: string
  /** Whose config dialect the document is written in. */
  format: 'kilo'
}

export interface AgentDescriptor {
  id: string
  label: string
  /** What actually runs. `null` means the operator's login shell. */
  program: string | null
  description: string
  /** Whether this option is handed a credential for the agent surface. */
  connectsToSurface: boolean
  /**
   * How this CLI is told where Fabric's MCP config is. `mcp-config-flag` is
   * Claude Code's `--mcp-config … --strict-mcp-config`; a third agent that
   * reads an environment variable instead gets a new adapter here rather than a
   * branch in the bundle compiler.
   */
  surfaceAdapter: SurfaceAdapter
  /** Required by `config-content-env`: where and in which dialect the session config goes. */
  surfaceConfig?: SurfaceConfig
  /**
   * The channel a result comes BACK on (PF-10.01) — the capability that makes
   * an agent an EXECUTOR, not just a process that ran. `surface`: the live
   * Fabric MCP surface (claim/handoff/memory registered as tools). `packet`: a
   * separate TRUSTED transport — the agent is handed an execution packet and
   * returns its result out-of-band, without the live surface; portable, and
   * verified on its own terms. `none`: it can run in the directory but cannot
   * publish a result, so it is NOT a ready executor. Launching a terminal is
   * not proof of `surface`: only a verified adapter is.
   */
  resultChannel: 'surface' | 'packet' | 'none'
  /**
   * Environment the program needs, merged over the operator's own.
   *
   * Added when a third agent was attempted: `goose` takes its unattended mode
   * from `GOOSE_MODE`, not from a flag, and the descriptor could not say so.
   * The "a third agent is one row" claim was false until this existed.
   */
  env?: Readonly<Record<string, string>>
  permissionModes: readonly PermissionMode[]
  /** The mode used when the operator does not choose. Never a blocked one. */
  defaultMode: string | null
}

export const AGENTS: readonly AgentDescriptor[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    program: 'claude',
    description: 'An agent session in the project directory, connected to Fabric',
    connectsToSurface: true,
    surfaceAdapter: 'mcp-config-flag',
    resultChannel: 'surface',
    defaultMode: 'ask',
    permissionModes: [
      // The runner asks a person before each tool. Weaker than Fabric's floor
      // and real: somebody sees every act before it happens.
      { id: 'plan', labelKey: 'agent.mode.plan', args: ['--permission-mode', 'plan'], containment: 'runner-gated' },
      { id: 'ask', labelKey: 'agent.mode.ask', args: [], containment: 'runner-gated' },
      {
        id: 'bypass',
        labelKey: 'agent.mode.bypass',
        args: ['--dangerously-skip-permissions'],
        // NOTHING stands between this and the world. Before FA-09 that cost was
        // a warning string; now a floored effect is refused for it, because
        // authorising one would authorise the asking and not the doing.
        containment: 'none',
        // M95 SHIPPED, so this is no longer blocked — and the change is a
        // downgrade rather than a deletion. What was true: an unattended agent
        // eventually prints a credential, and every byte lands in a transcript
        // every agent in the project can search. What changed: secrets are now
        // removed on the way in, before the spool file, and the count travels
        // with the record. What did NOT change: the redactor matches SHAPES, so
        // a secret with no shape still passes. That residue is the warning.
        warnKey: 'agent.mode.bypassWarn'
      }
    ]
  },
  {
    // A THIRD AGENT, added to test the claim that adding one is a single row.
    // It is not, and this row says exactly how far it gets: codex runs here as
    // itself, in the project directory, and sees NO Fabric tools — because
    // nobody has verified how it is told about an MCP server, and guessing a
    // flag is how an agent starts with no tools and no complaint.
    //
    // Return trigger: someone runs `codex` against a known MCP config and
    // records what it takes. Then this becomes a real adapter and the row
    // changes by two fields.
    id: 'codex',
    label: 'Codex',
    program: 'codex',
    description: 'A coding agent in the project directory. Not connected to Fabric: how it learns about MCP servers has not been verified here',
    connectsToSurface: false,
    surfaceAdapter: 'none',
    // No verified surface adapter and no packet transport wired yet, so Codex
    // is NOT a ready Fabric executor: it runs in the directory but cannot
    // register claim/handoff/memory. When the packet transport lands, this
    // becomes 'packet' and the row gains a trusted-transport check — not before.
    resultChannel: 'none',
    defaultMode: null,
    permissionModes: []
  },
  {
    // P-10 / ADR-0119: the first runner connected without Claude Code's flags. Kilo's TUI in
    // the project directory, told about Fabric by a session config in KILO_CONFIG_CONTENT
    // (see `SurfaceConfig` for why the content variable and not the file). Probed on Kilo
    // 7.4.17: the remote MCP entry with its bearer header connects, and a wrong bearer reads
    // "needs authentication" (report `raw/probes/kilo-7.4.17-mcp-list.txt`).
    id: 'kilo',
    label: 'Kilo Code',
    program: 'kilo',
    description: 'An agent session in the project directory, connected to Fabric',
    connectsToSurface: true,
    surfaceAdapter: 'config-content-env',
    surfaceConfig: { env: 'KILO_CONFIG_CONTENT', format: 'kilo' },
    resultChannel: 'surface',
    defaultMode: 'ask',
    permissionModes: [
      // Kilo's own default allows every tool ("*": {"*": "allow"}, measured), so asking is
      // something this mode SETS, not something it inherits.
      {
        id: 'ask',
        labelKey: 'agent.mode.ask',
        args: [],
        containment: 'runner-gated',
        config: { permission: { edit: 'ask', bash: 'ask', webfetch: 'ask', external_directory: 'ask' } }
      },
      {
        id: 'bypass',
        labelKey: 'agent.mode.bypass',
        args: [],
        containment: 'none',
        config: { permission: { '*': 'allow' } },
        warnKey: 'agent.mode.bypassWarn'
      }
    ]
  },
  {
    id: 'shell',
    label: 'Terminal',
    program: null,
    description: 'A plain login shell, no agent',
    connectsToSurface: false,
    surfaceAdapter: 'none',
    resultChannel: 'none',
    defaultMode: null,
    permissionModes: []
  }
]

export function describeAgent(id: string): AgentDescriptor | null {
  return AGENTS.find((a) => a.id === id) ?? null
}

/**
 * What stands between this runner-and-mode and the world (FA-09).
 *
 * An UNKNOWN runner is `none`, and that is the only safe direction: the whole
 * question is whether Fabric can be sure, and a runner it cannot name is one it
 * cannot be sure about. A runner with no permission modes at all is `none` too —
 * a shell has no gate to ask.
 */
export function containmentFor(runnerId: string, modeId: string | null): Containment {
  const agent = describeAgent(runnerId)
  if (!agent || agent.permissionModes.length === 0) return 'none'
  const mode = agent.permissionModes.find((m) => m.id === (modeId ?? agent.defaultMode))
  return mode?.containment ?? 'none'
}

export type ExecutorReadiness =
  | { ready: true; channel: 'surface' | 'packet' }
  | { ready: false; reason: string }

/**
 * Whether an agent may act as a Fabric EXECUTOR (PF-10.01).
 *
 * The bar is a RESULT CHANNEL that actually exists, checked against the
 * capability rather than assumed from a successful spawn. `surface` requires a
 * real (implemented, non-`none`) adapter — a terminal that launched proves the
 * program ran, never that it registered a tool. `packet` is the separate
 * trusted transport. `none`, an unimplemented adapter, or a `surface` claim
 * with no adapter is NOT ready: an executor that cannot return a result is a
 * process, and calling it ready is how a Codex terminal gets mistaken for a
 * peer of the Claude executor.
 */
export function executorReadiness(agentId: string): ExecutorReadiness {
  const agent = describeAgent(agentId)
  if (!agent) return { ready: false, reason: `unknown agent: ${agentId}` }
  if (agent.resultChannel === 'surface') {
    if (agent.surfaceAdapter === 'none' || agent.surfaceAdapter === 'unimplemented')
      return { ready: false,
        reason: `${agent.id} claims the surface channel but its adapter is ` +
          `${agent.surfaceAdapter} — no verified way to register Fabric's tools` }
    if (!agent.connectsToSurface)
      return { ready: false,
        reason: `${agent.id} claims the surface channel but is not handed a surface credential` }
    return { ready: true, channel: 'surface' }
  }
  if (agent.resultChannel === 'packet') return { ready: true, channel: 'packet' }
  return { ready: false,
    reason: `${agent.id} has no result channel — it can run in the directory but ` +
      `cannot publish a claim, hand-off or memory result, so it is not a ready executor` }
}

/**
 * A real two-session handoff, VERIFIED not simulated (PF-10.02).
 *
 * The claim under test: on a supported host, a fresh PLANNER session emits an
 * execution packet, an INDEPENDENT EXECUTOR session (a new session, NOT the
 * planner and NOT reading its transcript) consumes only that packet, and its
 * result comes back on a TRUSTED result channel. Three things must be recorded
 * — the digest the executor actually LOADED, the tool CALL it made, and the
 * CURRENT result — and if the host is not a ready executor the whole thing is
 * NOT_RUN, never a green from a spawn.
 *
 * `evidence` is what a runner observed: the packet digest, the executor's own
 * session id and the id it loaded, whether it read the planner's transcript,
 * the tool it called, and the result's channel. This function judges; a runner
 * gathers.
 */
export type HandoffVerdict =
  | { status: 'verified'; actualLoad: string; toolCall: string; result: 'current' }
  | { status: 'NOT_RUN'; reason: string }
  | { status: 'failed'; reason: string }

export function verifyHandoff(
  hostId: string,
  evidence: {
    packetDigest?: string | null
    executorSession?: string | null
    plannerSession?: string | null
    loadedDigest?: string | null
    readPlannerTranscript?: boolean
    toolCall?: string | null
    resultChannel?: 'surface' | 'packet' | 'none' | null
  } | null
): HandoffVerdict {
  const ready = executorReadiness(hostId)
  if (!ready.ready)
    return { status: 'NOT_RUN', reason: `host not a ready executor: ${ready.reason}` }
  const e = evidence || {}
  // NOT_RUN when the host was ready but nothing actually happened — no evidence
  // is not a pass. A green needs an actual load, an actual call, an actual
  // result.
  if (!e.packetDigest || !e.loadedDigest || !e.toolCall)
    return { status: 'NOT_RUN', reason: 'no recorded load/tool-call/result — the host was ready but the handoff did not run' }
  // The executor must be INDEPENDENT: a different session that did NOT read the
  // planner's transcript. A result produced by reading the transcript is not a
  // packet handoff — it is one session finishing its own thread.
  if (e.executorSession && e.plannerSession && e.executorSession === e.plannerSession)
    return { status: 'failed', reason: 'planner and executor are the same session — not a two-session handoff' }
  if (e.readPlannerTranscript)
    return { status: 'failed', reason: 'the executor read the planner transcript — the result depends on it, not on the packet' }
  // The executor must have loaded the packet it was handed, and returned on a
  // TRUSTED channel (surface or packet), not "none".
  if (e.loadedDigest !== e.packetDigest)
    return { status: 'failed', reason: `the executor loaded ${e.loadedDigest}, not the packet ${e.packetDigest}` }
  if (e.resultChannel !== 'surface' && e.resultChannel !== 'packet')
    return { status: 'failed', reason: `the result arrived on an untrusted channel (${e.resultChannel})` }
  return { status: 'verified', actualLoad: e.loadedDigest, toolCall: e.toolCall, result: 'current' }
}

export type ModeVerdict =
  | { ok: true; args: readonly string[]; config: Readonly<Record<string, unknown>> | null }
  | { ok: false; reason: string }

/**
 * Whether a session may open in this mode, and with what arguments.
 *
 * Asked by the main process before spawning, not only by the picker. A picker
 * that hides a choice is a suggestion; this is the rule, and it is the same
 * shape as the ladder's `mayMove` for the same reason.
 */
export function mayLaunch(agentId: string, modeId: string | null): ModeVerdict {
  const agent = describeAgent(agentId)
  if (!agent) return { ok: false, reason: `unknown agent: ${agentId}` }
  if (agent.permissionModes.length === 0) return { ok: true, args: [], config: null }
  const wanted = modeId ?? agent.defaultMode
  const mode = agent.permissionModes.find((m) => m.id === wanted)
  if (!mode) return { ok: false, reason: `${agent.label} has no mode called ${String(wanted)}` }
  if (mode.blockedKey) return { ok: false, reason: mode.blockedKey }
  return { ok: true, args: mode.args, config: mode.config ?? null }
}
