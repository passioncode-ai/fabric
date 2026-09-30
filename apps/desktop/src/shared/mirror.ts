// The workspace as a repository (M118, ADR-0002).
//
// The estate lives in Postgres, which has no diff, no review and no blame. The
// DECLARED layer — what a person chose — is mirrored to files so the operator's
// estate is a thing they can read, diff and carry to another machine. Observed
// data is not mirrored: leases, journal rows, an agent's memory. The line is who
// wrote it, and ADR-0002 says it is unambiguous at every row.
//
// TWO RULES CARRY THIS FILE, and both fail invisibly if they are wrong.
//
// 1. THE MIRROR NAMES ITS FIELDS. It never spreads a row. A column added later
//    — a token, a cached credential, an agent's scratch state — must not appear
//    in the operator's git history because somebody widened a select. The
//    allowlist is the security boundary, and it is one that holds by default
//    rather than by review.
//
// 2. THE MIRROR IS DETERMINISTIC. Same estate, byte-identical bytes: keys in a
//    fixed order, rows sorted by id, arrays sorted. A mirror that reorders is a
//    mirror where every write is a diff and `git blame` answers "everything
//    changed, by whoever saved last" — which looks like it works and destroys
//    the only reason to have it.
//
// FORMAT. YAML, as ADR-0002 requires, and every scalar is emitted as a JSON
// string because YAML 1.2 is a superset of JSON. That makes quoting correct by
// construction instead of by a hand-rolled escaper, and the strings this holds
// are exactly the ones a bad escaper would corrupt: a project purpose with a
// colon in it, a name with a quote, a path with a backslash.

export interface MirroredProject {
  id: string
  name: string
  purpose: string | null
  repo_path: string | null
  status: string
  memory_backend: string
  default_agent: string
  mcp_servers: string[]
}

export interface MirroredAgent {
  id: string
  project_id: string
  name: string
  runner_id: string
  instructions: string
  mcp_servers: string[]
  permission_mode: string | null
}

export interface Estate {
  projects: MirroredProject[]
  agents: MirroredAgent[]
}

/** The files a mirror consists of. Path to contents, and nothing else is
 *  written — a mirror that also leaves stray files is one nobody can diff. */
export type Mirror = Record<string, string>

const scalar = (v: unknown): string =>
  v === null || v === undefined ? 'null' : JSON.stringify(String(v))

const list = (items: readonly string[], indent: string): string =>
  items.length === 0 ? ' []' : '\n' + [...items].sort().map((i) => `${indent}- ${scalar(i)}`).join('\n')

/** The field order is DECLARED here and nowhere else. Adding a column to the
 *  database does not add it to the mirror; adding it here does, deliberately. */
export const PROJECT_FIELDS = [
  'id',
  'name',
  'purpose',
  'repo_path',
  'status',
  'memory_backend',
  'default_agent'
] as const

export const AGENT_FIELDS = [
  'id',
  'project_id',
  'name',
  'runner_id',
  'instructions',
  'permission_mode'
] as const

const HEADER = [
  '# Fabric workspace — the declared layer, mirrored from the estate (ADR-0002).',
  '#',
  '# WRITTEN BY FABRIC. Editing this file does not change the estate: the database',
  '# is the store and this is its mirror, so a hand edit shows up as a divergence',
  '# rather than as a setting. Change it in the product and this file follows.',
  '#',
  '# What is NOT here is deliberate: journal rows, leases, memory and transcripts',
  '# are observed rather than declared, and mirroring them would put machine',
  '# writes in a history that exists to record what a person chose.',
  ''
].join('\n')

export function mirrorEstate(estate: Estate): Mirror {
  const projects = [...estate.projects].sort((a, b) => a.id.localeCompare(b.id))
  const agents = [...estate.agents].sort((a, b) => a.id.localeCompare(b.id))

  const projectLines = projects.map((p) => {
    const head = PROJECT_FIELDS.map(
      (f, i) => `${i === 0 ? '  - ' : '    '}${f}: ${scalar(p[f])}`
    )
    return [...head, `    mcp_servers:${list(p.mcp_servers ?? [], '      ')}`].join('\n')
  })

  const agentLines = agents.map((a) => {
    const head = AGENT_FIELDS.map((f, i) => `${i === 0 ? '  - ' : '    '}${f}: ${scalar(a[f])}`)
    return [...head, `    mcp_servers:${list(a.mcp_servers ?? [], '      ')}`].join('\n')
  })

  return {
    'workspace/projects.yaml':
      HEADER + '\nprojects:' + (projectLines.length ? '\n' + projectLines.join('\n') : ' []') + '\n',
    'workspace/agents.yaml':
      HEADER + '\nagents:' + (agentLines.length ? '\n' + agentLines.join('\n') : ' []') + '\n'
  }
}

export interface Divergence {
  path: string
  /** Said to the operator: what differs, not a diff they must read. */
  reason: string
}

/**
 * What the files on disk say that the estate does not, and the reverse.
 *
 * ADR-0002 requires a gate that fails when the two disagree and does not say
 * which wins. It does not need to: the DATABASE is the store, so a divergence
 * is a report about the FILES, and the fix is to write them again. Saying so
 * here stops the question being answered differently by whoever hits it first.
 */
export function compareMirror(onDisk: Mirror, estate: Estate): Divergence[] {
  const wanted = mirrorEstate(estate)
  const out: Divergence[] = []
  for (const [path, text] of Object.entries(wanted)) {
    if (!(path in onDisk)) out.push({ path, reason: 'is missing from the workspace' })
    else if (onDisk[path] !== text)
      out.push({ path, reason: 'differs from the estate — the estate is the store, so this file is out of date' })
  }
  for (const path of Object.keys(onDisk))
    if (!(path in wanted))
      out.push({ path, reason: 'is in the workspace and Fabric does not write it' })
  return out
}

// ── Reading a mirror back ──────────────────────────────────────────────────
//
// An existing workspace may be imported instead of created (M118). That means
// reading files this module wrote, which is a narrower job than reading YAML and
// is treated as such.
//
// AN UNRECOGNISED LINE REFUSES THE WHOLE FILE. A mirror is machine-written, so a
// line this reader does not know is either a hand edit or a format from a newer
// Fabric — and in both cases importing "most of it" silently drops something the
// operator has. A refusal that names the line is recoverable; a partial import
// is a loss nobody sees. This is the same rule as the all-or-nothing grant in
// ADR-0034, pointed at data instead of at authority.

export type ParseResult<T> = { ok: true; rows: T[] } | { ok: false; reason: string }

/** A field with a value: `  - id: "x"` or `    name: "y"`. */
const FIELD = /^(\s*)(?:- )?([a-z_]+): (.+)$/
/** A field OPENING a list: `    mcp_servers:` with nothing after the colon.
 *  The writer emits this whenever the list is non-empty, so a reader that does
 *  not know it refuses its own output — which is how this line got written. */
const OPENS_LIST = /^(\s*)(?:- )?([a-z_]+):$/

function readScalar(raw: string): string | null | undefined {
  if (raw === 'null') return null
  if (!raw.startsWith('"')) return undefined
  try {
    const v: unknown = JSON.parse(raw)
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

export function parseMirror(text: string, key: string): ParseResult<Record<string, unknown>> {
  const lines = text.split('\n')
  const rows: Record<string, unknown>[] = []
  let current: Record<string, unknown> | null = null
  let openList: string | null = null
  let started = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const at = (why: string): ParseResult<Record<string, unknown>> => ({
      ok: false,
      reason: `line ${i + 1}: ${why} — this file is written by Fabric, so an unreadable line means it was edited or comes from a newer version. Nothing was imported.`
    })
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue

    if (!started) {
      if (line === `${key}: []`) return { ok: true, rows: [] }
      if (line === `${key}:`) {
        started = true
        continue
      }
      return at(`expected "${key}:" and found ${JSON.stringify(line.slice(0, 40))}`)
    }

    // A member of the list a previous line opened.
    if (openList !== null && line.startsWith('      - ')) {
      const value = readScalar(line.slice(8).trim())
      if (typeof value !== 'string') return at('a list item that is not a quoted string')
      ;(current![openList] as string[]).push(value)
      continue
    }

    const opens = line.match(OPENS_LIST)
    if (opens) {
      if (!current) return at('a list opened before any row started')
      openList = opens[2]
      current[openList] = []
      continue
    }

    const m = line.match(FIELD)
    if (!m) return at('neither a field nor a list item')
    const [, indent, field, raw] = m
    const isFirstOfRow = line.startsWith('  - ')

    if (isFirstOfRow) {
      if (current) rows.push(current)
      current = {}
    } else if (!current) {
      return at('a field before any row started')
    }
    if (indent.length !== 2 && indent.length !== 4) return at(`unexpected indentation (${indent.length} spaces)`)

    openList = null
    if (raw === '[]') {
      current![field] = []
      continue
    }
    const value = readScalar(raw)
    if (value === undefined) return at('a value that is neither a quoted string, null, nor []')
    current![field] = value
  }
  if (current) rows.push(current)
  return { ok: true, rows }
}
