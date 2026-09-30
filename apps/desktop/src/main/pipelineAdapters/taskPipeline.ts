// The task-pipeline adapter (PF-06.01) — imports a task-pipeline config into
// Fabric, and refuses what it cannot honour.
//
// The one failure mode an interop layer must not have is the silent omission:
// an importer that drops the gate it does not understand produces a pipeline
// that advances ungated, and nobody chose that. So this adapter is total in
// both directions — everything it accepts round-trips byte-equal, and
// everything it cannot honour is a NAMED refusal, never a skipped field.

export interface StageGate {
  type: 'auto' | 'judgment' | 'manual'
  check: string
  [extra: string]: unknown
}

export interface Stage {
  state: string
  skills: string[]
  gate: StageGate
  [extra: string]: unknown
}

export interface TaskPipelineConfig {
  version?: number
  stages: Stage[]
  must_understand?: string[]
  profile?: { name: string; [extra: string]: unknown }
  skill_lock?: { address: string; sha256: string }
  [extra: string]: unknown
}

export type ImportResult =
  | { ok: true; pipeline: TaskPipelineConfig }
  | { ok: false; reasons: string[] }

const SUPPORTED_GATES = new Set(['auto', 'judgment', 'manual'])

/** What THIS adapter understands beyond the base contract. An entry in the
 *  config's `must_understand` outside this set refuses the whole config. */
const UNDERSTOOD = new Set(['profile', 'skill_lock', 'graph_version'])

const SHA = /^[0-9a-f]{64}$/

export function importConfig(raw: unknown): ImportResult {
  const reasons: string[] = []
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { ok: false, reasons: ['the config is not an object'] }
  const cfg = raw as Record<string, unknown>

  for (const name of (cfg.must_understand as string[] | undefined) ?? []) {
    if (!UNDERSTOOD.has(name))
      reasons.push(
        `must_understand names "${name}", which this adapter does not understand — ` +
          `the whole config is refused rather than imported without it`
      )
  }

  const stages = cfg.stages
  if (!Array.isArray(stages) || stages.length === 0) {
    reasons.push('stages: required, non-empty')
  } else {
    stages.forEach((s, i) => {
      if (typeof s !== 'object' || s === null) {
        reasons.push(`stages[${i}]: not an object`)
        return
      }
      const st = s as Record<string, unknown>
      if (!st.state) reasons.push(`stages[${i}].state: missing`)
      if (!Array.isArray(st.skills) || st.skills.length === 0)
        reasons.push(`stages[${i}].skills: required, non-empty`)
      const gate = st.gate as Record<string, unknown> | undefined
      if (!gate || typeof gate !== 'object') {
        reasons.push(`stages[${i}].gate: missing — an ungated stage is not a stage`)
      } else {
        if (!SUPPORTED_GATES.has(String(gate.type)))
          reasons.push(
            `stages[${i}].gate.type "${String(gate.type)}" is not one this adapter can ` +
              `execute — refused by name, never silently omitted`
          )
        if (!gate.check) reasons.push(`stages[${i}].gate.check: missing`)
      }
    })
  }

  // The pins, validated when present — and refused when malformed, because a
  // half-checked pin reads as a checked one.
  if (cfg.profile !== undefined) {
    const prof = cfg.profile as Record<string, unknown>
    if (typeof prof !== 'object' || prof === null || !prof.name)
      reasons.push('profile: present but nameless — a pin that pins nothing')
  }
  if (cfg.skill_lock !== undefined) {
    const lock = cfg.skill_lock as Record<string, unknown>
    if (typeof lock !== 'object' || lock === null || !lock.address ||
        !SHA.test(String(lock.sha256 ?? '')))
      reasons.push('skill_lock: needs address + sha256 — the skill versions are part of the proof')
  }
  if (cfg.graph_version !== undefined && !Number.isInteger(cfg.graph_version))
    reasons.push('graph_version: must be an integer')

  if (reasons.length) return { ok: false, reasons }
  // Everything is retained — unknown non-mandatory fields ride along verbatim,
  // which is what makes the round-trip below an identity.
  return { ok: true, pipeline: structuredClone(cfg) as TaskPipelineConfig }
}

/** The other direction. Import → export is an identity on accepted configs:
 *  the adapter adds nothing, drops nothing, reorders nothing. */
export function exportConfig(pipeline: TaskPipelineConfig): Record<string, unknown> {
  return structuredClone(pipeline)
}

// ---------------------------------------------------------------------------
// The projection (PF-06.02) — one authority, immutable identities, both ways.
//
// When a task-pipeline graph is imported, FABRIC is the single dispatch
// authority: graph.py hands the queue over and is not a second scheduler — two
// schedulers over one node is how one unit of work runs twice. The mapping
// that makes this safe is DETERMINISTIC and immutable: a node at a revision
// projects to exactly one task identity, importing it twice yields the same
// identity (so the second import cannot dispatch a second attempt), and a
// result routes BACK to the node revision it was built against — never to
// "the current one", because staleness is the coordinator's verdict to make,
// not the adapter's to erase.

export const DISPATCH_AUTHORITY = 'fabric' as const

export interface NodeRef {
  runId: string
  nodeId: string
  revision: number
}

const REF_RE = /^tp:([^:]+):([^@]+)@r(\d+)$/

/** node@revision → the one task identity it may ever have. Pure and total. */
export function taskIdFor(ref: NodeRef): string {
  if (!ref.runId || !ref.nodeId || !Number.isInteger(ref.revision))
    throw new Error('a projection needs runId, nodeId and an integer revision')
  return `tp:${ref.runId}:${ref.nodeId}@r${ref.revision}`
}

/** The way back. Null for a task Fabric created itself — not every task is a
 *  projection, and guessing an identity would route a result to nowhere. */
export function nodeFor(taskId: string): NodeRef | null {
  const m = REF_RE.exec(taskId)
  return m ? { runId: m[1], nodeId: m[2], revision: Number(m[3]) } : null
}

/**
 * Import a set of graph nodes as dispatchable rows. Idempotent by
 * construction: the identity is the projection, so a re-import maps every
 * node to the task that already exists rather than minting a rival.
 */
export function projectNodes(
  runId: string,
  nodes: ReadonlyArray<{ nodeId: string; revision: number; instruction: string }>
): Array<{ id: string; instruction: string; node: NodeRef }> {
  const seen = new Set<string>()
  const out: Array<{ id: string; instruction: string; node: NodeRef }> = []
  for (const n of nodes) {
    const node = { runId, nodeId: n.nodeId, revision: n.revision }
    const id = taskIdFor(node)
    if (seen.has(id)) continue            // one node, one row — even inside one import
    seen.add(id)
    out.push({ id, instruction: n.instruction, node })
  }
  return out
}
