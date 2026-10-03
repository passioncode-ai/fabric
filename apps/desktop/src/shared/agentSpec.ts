// #region agent-spec — docs: docs/ux/scenarios.md#scn-130-start-a-new-agent-inside-a-project
// An agent created from a prompt (M125).
//
// `agents.ts` said this moment would come: "the projector branch for
// `agent.registered@1` stays deliberately empty… return trigger: the first agent
// that must exist without a release." This is it, and the distinction that
// resolves it is not the one that file anticipated.
//
// A RUNNER IS NOT AN AGENT. A runner is a program on this machine — `claude`,
// `codex`, a login shell — and it names a binary and the flags it understands,
// so it ships with the app and stays code. An AGENT is a named configuration OF
// a runner: what it is for, what it may reach, how much it may do without
// asking. That is created at runtime and is a row. `agents.ts` keeps the
// runners; nothing there grows.
//
// THE AUTHORITY RULE, and it is the whole of this file. The project's granted
// servers (M127) are a CEILING, the agent's declared servers are a REQUEST, and
// what it gets is the request — not the ceiling, because least privilege is the
// point of asking. But a request that reaches outside the ceiling is a REFUSAL,
// never a silent trim: trimmed, the agent starts without a tool it said it
// needed, looks for it, does not find it, and improvises. That is the same
// mid-run failure ADR-0034 refuses one level down, and it deserves the same
// answer one level up.

export interface AgentSpec {
  /** What the operator will pick it by. */
  name: string
  /** What it is for, in their words. Becomes the agent's own instructions. */
  instructions: string
  /** Which program actually runs — an id from the runner registry. */
  runnerId: string
  /** What it says it needs to reach. Empty is a real answer: Fabric only. */
  servers: string[]
}

export type SpecVerdict = { ok: true; spec: AgentSpec } | { ok: false; reason: string }

export const NAME_MAX = 60
export const INSTRUCTIONS_MIN = 20

/**
 * An agent is picked by its name, so a project holds one agent per name: trimmed and compared without
 * case, because "Reviewer" and "reviewer " are the same word to the person choosing between them. The
 * create form and the `agents:create` handler both ask this, so they cannot disagree.
 */
export function nameTaken(name: string, existing: readonly { name: string }[]): boolean {
  const n = name.trim().toLowerCase()
  return n !== '' && existing.some((a) => a.name.trim().toLowerCase() === n)
}

/**
 * Whether a failed `agent.registered@1` append was the write boundary refusing a taken name (migration 72,
 * `refuse_taken_agent_name`, under the estate's lock). The journal reports the database's message inside
 * its own sentence, so the sentence is matched rather than the code it does not carry. Anything else is
 * a different failure and is never dressed up as this one.
 */
export function agentNameTakenAtWrite(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /append_event\(agent\.registered@1\) failed: this project already has an agent called /.test(message)
}

export function readSpec(draft: {
  name: string
  instructions: string
  runnerId: string
  servers?: string[]
}): SpecVerdict {
  const name = draft.name.trim()
  const instructions = draft.instructions.trim()
  if (!name) return { ok: false, reason: 'an agent needs a name you can pick it by' }
  if (name.length > NAME_MAX)
    return { ok: false, reason: `a name longer than ${NAME_MAX} characters is a description` }
  if (instructions.length < INSTRUCTIONS_MIN)
    return {
      ok: false,
      // Not a style rule. An agent whose whole brief is "fix bugs" is one the
      // operator will not recognise in a week and the model cannot act on.
      reason: `say what the agent is for in at least ${INSTRUCTIONS_MIN} characters — this text is the whole of what it will be told`
    }
  if (!draft.runnerId.trim()) return { ok: false, reason: 'an agent needs a program to run in' }

  // Duplicates are dropped rather than refused: asking for the same server twice
  // is a typo, not a decision, and refusing it teaches nothing.
  const servers = [...new Set((draft.servers ?? []).map((s) => s.trim()).filter(Boolean))]
  return { ok: true, spec: { name, instructions, runnerId: draft.runnerId.trim(), servers } }
}

export type ServerResolution =
  | { ok: true; servers: string[] }
  | { ok: false; refused: string[]; reason: string }

/**
 * What this agent may actually reach, given what the project granted.
 *
 * Least privilege in one line: the agent gets what it ASKED for, never the whole
 * ceiling. And anything it asked for that the project did not grant refuses the
 * launch by name — the operator either grants it or the agent does not run,
 * because the third option is an agent running without a tool it declared.
 */
export function resolveServers(
  requested: readonly string[],
  projectGrants: readonly string[]
): ServerResolution {
  const refused = requested.filter((s) => !projectGrants.includes(s))
  if (refused.length > 0)
    return {
      ok: false,
      refused,
      reason:
        `this agent asks for ${refused.join(', ')}, which this project does not grant. ` +
        `Grant it in the project's settings, or remove it from the agent — starting ` +
        `without a server it declared is how an agent improvises around a missing tool.`
    }
  return { ok: true, servers: [...requested] }
}
// #endregion agent-spec
