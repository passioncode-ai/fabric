// #region estate-search — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#3-the-index
/**
 * The estate index's pure half (the operator, 2026-11-19: «нужен поиск по всем сессиям и транскриптам, список проектов
 * с путями, быстрый запуск сессии по имени папки без ошибок»): how a query becomes the two FTS5 queries, how rankings are
 * fused, how a transcript's lines become a session and its turns, how a project's folder gets its role, how a name finds
 * one project, and how a quote is checked. No clock, no reads: `main/estateIndex.ts` holds the database and the files.
 *
 * The words are Fabric's own (`boardSearch.ts#terms`, the stemmer `fabric_board_search` uses), so a word means the same
 * in both doors. The fusion is reciprocal rank with k = 60, as in Sound Engine's knowledge base and the agents database's
 * `hybrid-retrieval` pattern; the quote rule is that pattern's (`quotes.py`), ported.
 */
import { terms } from './boardSearch.ts'

export const RRF_K = 60
/** The longest passage of a transcript kept as one turn document. */
export const TURN_CHARS = 1800
/** How much of a single message is read: a pasted file is a passage, not a corpus. */
export const MESSAGE_CHARS = 6000
export const PASSAGE_CHARS = 300

export type DocKind = 'session' | 'turn' | 'task' | 'note' | 'message' | 'console' | 'project' | 'commit'
export const DOC_KINDS: readonly DocKind[] = ['session', 'turn', 'task', 'note', 'message', 'console', 'project', 'commit']

export type Ranking = 'words' | 'trigram' | 'vector'

const quoteFts = (t: string): string => `"${t.replace(/"/g, '""')}"`

/** The words query: every term of the query, ORed; a long plain term also as a prefix. Null when nothing is searchable. */
export function wordsQuery(query: string): string | null {
  const ts = [...new Set(terms(query))].slice(0, 24)
  if (!ts.length) return null
  // A long plain term also matches as a prefix one letter shorter: a light stemmer leaves «сесси» for «сессии» and «сесс»
  // for «сессий», and both start with «сесс».
  return ts.map((t) => (t.length >= 5 && /^[\p{L}\p{N}]+$/u.test(t) ? `${quoteFts([...t].slice(0, -1).join(''))}*` : quoteFts(t))).join(' OR ')
}

/** The trigram query: the whole phrase (a pasted fragment matches as it stands) and each word of three or more
 *  characters, ORed. Null when the query has no fragment of three characters. */
export function trigramQuery(query: string): string | null {
  const q = query.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 200)
  const parts = new Set<string>()
  if ([...q].length >= 3) parts.add(q)
  for (const w of q.split(/[\s,;:!?()«»"]+/)) if ([...w].length >= 3) parts.add(w)
  if (!parts.size) return null
  return [...parts].slice(0, 8).map(quoteFts).join(' OR ')
}

/** Reciprocal rank fusion: each ranking adds 1 / (k + rank) for every id it lists (rank from 1). */
export function fuse(rankings: Partial<Record<Ranking, readonly string[]>>, k = RRF_K): Array<{ id: string; score: number; via: Ranking[] }> {
  const by = new Map<string, { id: string; score: number; via: Ranking[] }>()
  for (const [name, ids] of Object.entries(rankings) as Array<[Ranking, readonly string[]]>) {
    ids.forEach((id, i) => {
      const row = by.get(id) ?? { id, score: 0, via: [] }
      row.score += 1 / (k + i + 1)
      if (!row.via.includes(name)) row.via.push(name)
      by.set(id, row)
    })
  }
  return [...by.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/** About PASSAGE_CHARS of the body around the first word of the query that it holds, verbatim (only whitespace runs
 *  folded), so the passage can be checked against the body. */
export function passage(body: string, query: string, size = PASSAGE_CHARS): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  if (flat.length <= size) return flat
  const lower = flat.toLowerCase()
  const q = query.toLowerCase().replace(/\s+/g, ' ').trim()
  let at = q.length >= 3 ? lower.indexOf(q) : -1
  if (at < 0) {
    const hits = q.split(/[^\p{L}\p{N}_-]+/u).filter((w) => w.length >= 3)
      .map((w) => lower.indexOf(w.slice(0, Math.max(3, Math.min(w.length, 6))))).filter((i) => i >= 0)
    at = hits.length ? Math.min(...hits) : 0
  }
  const start = Math.max(0, Math.min(at - 80, flat.length - size))
  return flat.slice(start, start + size)
}

// #region transcripts — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#33-sources-and-how-each-is-kept-current

export interface TranscriptTurn { role: 'user' | 'assistant'; text: string; line: number; at: string | null }

/** What a transcript's lines say: its id, folder, title, branch, times and the turns a person searches for. */
export interface TranscriptFacts {
  sessionId: string | null
  cwd: string | null
  title: string | null
  branch: string | null
  firstAt: string | null
  lastAt: string | null
  turns: TranscriptTurn[]
}

export const emptyFacts = (): TranscriptFacts => ({ sessionId: null, cwd: null, title: null, branch: null, firstAt: null, lastAt: null, turns: [] })

/** Injected instructions and system text a person never typed: never a turn. */
function injected(text: string): boolean {
  const t = text.trimStart()
  return t.startsWith('<') && !t.startsWith('<pasted_content') || t.startsWith('# AGENTS.md') || t.startsWith('Caveat: ') ||
    t.startsWith('[Request interrupted')
}

/** A user message's text with a pasted block's tags taken off (the text inside is what the person gave). */
function cleanUser(text: string): string {
  return text.replace(/<\/?pasted_content[^>]*>/g, '').trim()
}

const at = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? v : null)

function noteTimes(f: TranscriptFacts, t: string | null): void {
  if (!t) return
  if (!f.firstAt || t < f.firstAt) f.firstAt = t
  if (!f.lastAt || t > f.lastAt) f.lastAt = t
}

/**
 * Claude Code's JSONL, one line at a time (`firstLine` is the 1-based number of the first line given), into `facts`.
 * A line cut while it was being written, or too long to be a message (a tool's output), is skipped; the rest still read.
 */
export function readClaudeLines(lines: readonly string[], firstLine: number, facts: TranscriptFacts): void {
  lines.forEach((line, i) => {
    if (!line || line.length > 400_000) return
    // A tool's result is most of the corpus and nobody searches it: skipped before the parse.
    if (line.includes('"tool_result"') && !line.includes('"text"')) return
    let r: Record<string, unknown>
    try { r = JSON.parse(line) as Record<string, unknown> } catch { return /* cut mid-write: the next pass reads it whole */ }
    if (typeof r.sessionId === 'string' && !facts.sessionId) facts.sessionId = r.sessionId
    if (typeof r.cwd === 'string' && !facts.cwd) facts.cwd = r.cwd
    if (typeof r.gitBranch === 'string' && r.gitBranch && r.gitBranch !== 'HEAD') facts.branch = r.gitBranch
    if (r.type === 'ai-title' && typeof r.aiTitle === 'string') facts.title = r.aiTitle.slice(0, 200)
    if (r.type === 'summary' && typeof r.summary === 'string' && !facts.title) facts.title = r.summary.slice(0, 200)
    const when = at(r.timestamp)
    noteTimes(facts, when)
    if (r.type !== 'user' && r.type !== 'assistant') return
    if (r.isSidechain === true || r.isMeta === true) return
    const content = (r.message as { content?: unknown } | undefined)?.content
    const parts: string[] = []
    if (typeof content === 'string') parts.push(content)
    else if (Array.isArray(content))
      for (const c of content as Array<Record<string, unknown>>) if (c?.type === 'text' && typeof c.text === 'string') parts.push(c.text)
    let text = parts.join('\n').trim()
    if (!text || injected(text)) return
    if (r.type === 'user') text = cleanUser(text)
    if (!text) return
    facts.turns.push({ role: r.type as 'user' | 'assistant', text: text.slice(0, MESSAGE_CHARS), line: firstLine + i, at: when })
  })
}

/** Codex's rollout JSONL into `facts`: `session_meta` names the session and its folder; messages of the user and the
 *  assistant are turns. */
export function readCodexLines(lines: readonly string[], firstLine: number, facts: TranscriptFacts): void {
  lines.forEach((line, i) => {
    if (!line || line.length > 400_000) return
    let r: Record<string, unknown>
    try { r = JSON.parse(line) as Record<string, unknown> } catch { return /* cut mid-write */ }
    const when = at(r.timestamp)
    noteTimes(facts, when)
    const p = (r.payload ?? {}) as Record<string, unknown>
    if (r.type === 'session_meta') {
      if (typeof p.id === 'string' && !facts.sessionId) facts.sessionId = p.id
      if (typeof p.cwd === 'string' && !facts.cwd) facts.cwd = p.cwd
      const git = p.git as { branch?: unknown } | undefined
      if (typeof git?.branch === 'string') facts.branch = git.branch
      return
    }
    if (r.type !== 'response_item' || p.type !== 'message' || (p.role !== 'user' && p.role !== 'assistant')) return
    const parts: string[] = []
    if (Array.isArray(p.content))
      for (const c of p.content as Array<Record<string, unknown>>)
        if ((c?.type === 'input_text' || c?.type === 'output_text' || c?.type === 'text') && typeof c.text === 'string') parts.push(c.text)
    const text = parts.join('\n').trim()
    if (!text || injected(text)) return
    if (p.role === 'user' && !facts.title) facts.title = text.replace(/\s+/g, ' ').slice(0, 120)
    facts.turns.push({ role: p.role as 'user' | 'assistant', text: text.slice(0, MESSAGE_CHARS), line: firstLine + i, at: when })
  })
}

/** Turns grouped into passages of at most TURN_CHARS, each with its first and last line. */
export function turnPassages(turns: readonly TranscriptTurn[]): Array<{ text: string; lineStart: number; lineEnd: number; at: string | null }> {
  const out: Array<{ text: string; lineStart: number; lineEnd: number; at: string | null }> = []
  let cur: { text: string; lineStart: number; lineEnd: number; at: string | null } | null = null
  for (const t of turns) {
    const piece = `${t.role === 'user' ? '›' : '‹'} ${t.text}`
    if (cur && cur.text.length + piece.length + 1 <= TURN_CHARS) {
      cur.text += `\n${piece}`
      cur.lineEnd = t.line
      cur.at = t.at ?? cur.at
      continue
    }
    if (cur) out.push(cur)
    cur = { text: piece.slice(0, MESSAGE_CHARS), lineStart: t.line, lineEnd: t.line, at: t.at }
  }
  if (cur) out.push(cur)
  return out
}

/** The command that continues a session in a terminal (the person's, or a Fabric console's first line). */
export function resumeCommand(runtime: 'claude' | 'codex', sessionId: string, cwd: string | null, configDir: string | null = null): string {
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
  const cd = cwd ? `cd ${q(cwd)} && ` : ''
  if (runtime === 'codex') return `${cd}codex resume ${sessionId}`
  return `${cd}${configDir ? `CLAUDE_CONFIG_DIR=${q(configDir)} ` : ''}claude --resume ${sessionId}`
}
// #endregion transcripts

// #region project-catalogue — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#35-projects-without-duplicates

export type ProjectRole = 'canonical' | 'duplicate' | 'worktree' | 'temporary'

export interface CatalogueInput { id: string; name: string; repo_path: string | null; lastActivityAt?: string | null }
export interface CatalogueRow extends CatalogueInput { role: ProjectRole; of: string | null }

const TEMP_ROOTS = [/\/\.cache\//, /^\/private\/tmp(\/|$)/, /^\/tmp(\/|$)/, /^\/private\/var\/folders\//, /^\/var\/folders\//, /\/scratchpad(\/|$)/]

export function folderRole(folder: string | null, linkedWorktree = false): 'temporary' | 'worktree' | 'plain' {
  if (!folder) return 'plain'
  const f = `${folder.replace(/\/+$/, '')}/`
  if (TEMP_ROOTS.some((re) => re.test(f))) return 'temporary'
  if (linkedWorktree || /\/_worktrees\//.test(f) || /\/\.claude\/worktrees\//.test(f)) return 'worktree'
  return 'plain'
}

const roleRank: Record<ProjectRole, number> = { canonical: 0, worktree: 1, duplicate: 2, temporary: 3 }

/**
 * Every project with its role. `worktreeOf` answers, for a folder that is a linked Git worktree, the repository's main
 * folder (null when it is not one or Git could not say).
 */
export function catalogue(projects: readonly CatalogueInput[], worktreeOf: (folder: string) => string | null = () => null): CatalogueRow[] {
  const rows: CatalogueRow[] = projects.map((p) => {
    const main = p.repo_path ? worktreeOf(p.repo_path) : null
    const kind = folderRole(p.repo_path, main !== null)
    return { ...p, role: kind === 'temporary' ? 'temporary' : kind === 'worktree' ? 'worktree' : 'canonical', of: main }
  })
  const byName = new Map<string, CatalogueRow[]>()
  for (const r of rows) byName.set(r.name.toLowerCase(), [...(byName.get(r.name.toLowerCase()) ?? []), r])
  for (const group of byName.values()) {
    if (group.length < 2) continue
    const plain = group.filter((r) => r.role === 'canonical')
      .sort((a, b) => String(b.lastActivityAt ?? '').localeCompare(String(a.lastActivityAt ?? '')) || a.id.localeCompare(b.id))
    const keeper = plain[0] ?? null
    for (const r of plain.slice(1)) { r.role = 'duplicate'; r.of = keeper?.repo_path ?? null }
    if (keeper) for (const r of group) if (r !== keeper && r.of === null) r.of = keeper.repo_path
  }
  return rows
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 9
  const d = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[b.length]!
}

const base = (p: string | null): string => (p ? p.replace(/\/+$/, '').split('/').pop() ?? '' : '')
const norm = (s: string): string => s.toLowerCase().replace(/[\s_.]+/g, '-')

export type ProjectMatch =
  | { found: CatalogueRow; via: 'id' | 'folder' | 'name' | 'fuzzy' }
  | { ambiguous: CatalogueRow[] }
  | { missing: true; near: CatalogueRow[] }

/**
 * One project by its id, absolute folder, name or folder name, with a typo forgiven (two edits) and a part of a name or
 * path taken. Among several matches of the best kind, the canonical one wins over a worktree, a duplicate or a
 * temporary folder; several canonical ones are ambiguous and answered as a list.
 */
export function matchProject(rows: readonly CatalogueRow[], query: string): ProjectMatch {
  const q = String(query ?? '').trim()
  if (!q) return { missing: true, near: [] }
  const byId = rows.find((r) => r.id === q)
  if (byId) return { found: byId, via: 'id' }
  const folder = q.replace(/\/+$/, '')
  const byFolder = rows.find((r) => r.repo_path && r.repo_path.replace(/\/+$/, '') === folder)
  if (byFolder) return { found: byFolder, via: 'folder' }
  const n = norm(q)
  const pick = (group: CatalogueRow[], via: 'name' | 'fuzzy'): ProjectMatch | null => {
    if (!group.length) return null
    const best = Math.min(...group.map((r) => roleRank[r.role]))
    const top = group.filter((r) => roleRank[r.role] === best)
    return top.length === 1 ? { found: top[0]!, via } : { ambiguous: [...group].sort((a, b) => roleRank[a.role] - roleRank[b.role]) }
  }
  const exact = rows.filter((r) => norm(r.name) === n || norm(base(r.repo_path)) === n)
  const e = pick(exact, 'name')
  if (e) return e
  const words = n.split('-').filter((w) => w.length >= 2)
  const partial = rows.filter((r) => { const hay = norm(`${r.name} ${r.repo_path ?? ''}`); return words.length > 0 && words.every((w) => hay.includes(w)) })
  const p = pick(partial, 'name')
  if (p) return p
  const close = rows.filter((r) => Math.min(distance(norm(r.name), n), distance(norm(base(r.repo_path)), n)) <= (n.length >= 8 ? 2 : 1))
  const c = pick(close, 'fuzzy')
  if (c) return c
  const near = rows.map((r) => ({ r, d: Math.min(distance(norm(r.name), n), distance(norm(base(r.repo_path)), n)) }))
    .filter((x) => x.d <= 4).sort((a, b) => a.d - b.d || roleRank[a.r.role] - roleRank[b.r.role]).slice(0, 5).map((x) => x.r)
  return { missing: true, near }
}
// #endregion project-catalogue

// #region contexts — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#36-visibility-contexts-never-mixed

/**
 * A folder's context from the organization Observatory gives the project that holds it: the person's own (Observatory's
 * default organization, or none) is `personal`, any other `org:<id>`. Every organization is its own context, so a
 * partner's work and an organization's are never mixed with each other or with the person's. No name is written here:
 * the organizations are the person's data (`estateRun.ts#readOrganizations`).
 */
export function contextOf(organization: string | null | undefined, personal: string | null): string {
  const o = String(organization ?? '').trim().toLowerCase()
  if (!o || o === String(personal ?? '').trim().toLowerCase()) return 'personal'
  return `org:${o}`
}

/** The longest folder of `folders` that holds `cwd`, with its value; null when none does. */
export function holder<T>(folders: ReadonlyMap<string, T>, cwd: string | null): { folder: string; value: T } | null {
  if (!cwd) return null
  let best: { folder: string; value: T } | null = null
  for (const [f, v] of folders) {
    const ff = f.replace(/\/+$/, '')
    if ((cwd === ff || cwd.startsWith(`${ff}/`)) && (!best || ff.length > best.folder.length)) best = { folder: ff, value: v }
  }
  return best
}
// #endregion contexts

// #region refs — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#41-nodes-and-edges

/** What a text names that the graph links: Fabric task and message ids (a full uuid), carry-over rows, ADRs and commits. */
export function refsOf(text: string): { uuids: string[]; co: string[]; adr: string[]; shas: string[] } {
  const uniq = (xs: Iterable<string>) => [...new Set(xs)].slice(0, 50)
  const t = text.slice(0, 20_000)
  return {
    uuids: uniq([...t.matchAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi)].map((m) => m[0].toLowerCase())),
    co: uniq([...t.matchAll(/\bCO-(\d{3,4})\b/g)].map((m) => `CO-${m[1]}`)),
    adr: uniq([...t.matchAll(/\bADR-(\d{4})\b/g)].map((m) => `ADR-${m[1]}`)),
    shas: uniq([...t.matchAll(/\b[0-9a-f]{40}\b/g)].map((m) => m[0]))
  }
}
// #endregion refs

// #region quotes — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#37-quotes-that-can-be-checked

export interface Claim { quote: string; doc: string; text?: string }
export type ClaimVerdict = { claim: Claim; kept: true } | { claim: Claim; kept: false; reason: 'short' | 'long' | 'unknown-doc' | 'changed' | 'not-verbatim' | 'adds-number' }

const flatten = (s: string): string => s.normalize('NFKC').replace(/\s+/g, ' ').trim()
const numbers = (s: string): string[] => [...s.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.'))

/**
 * The agents database's quote rule (`quotes.py`): a claim is kept only when its quote (12 to 600 characters) stands
 * verbatim in the body of the document it cites, the body still has the digest it was retrieved with, and the claim's
 * own words add no number the quote lacks. `docs` maps a document id to its body, digest now and the digest retrieved.
 */
export function checkClaims(claims: readonly Claim[], docs: ReadonlyMap<string, { body: string; digest: string; retrieved?: string }>): ClaimVerdict[] {
  return claims.map((claim): ClaimVerdict => {
    const q = flatten(claim.quote ?? '')
    if (q.length < 12) return { claim, kept: false, reason: 'short' }
    if (q.length > 600) return { claim, kept: false, reason: 'long' }
    const d = docs.get(claim.doc)
    if (!d) return { claim, kept: false, reason: 'unknown-doc' }
    if (d.retrieved && d.retrieved !== d.digest) return { claim, kept: false, reason: 'changed' }
    if (!flatten(d.body).includes(q)) return { claim, kept: false, reason: 'not-verbatim' }
    if (claim.text) {
      const have = new Set(numbers(q))
      if (numbers(claim.text).some((n) => !have.has(n))) return { claim, kept: false, reason: 'adds-number' }
    }
    return { claim, kept: true }
  })
}
// #endregion quotes
// #region window-answers — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#5-the-doors

/** One hit as the window shows it: what the CEO's `fabric_knowledge_search` answers, narrowed to what a row needs. */
export interface EverywhereHit {
  id: string
  kind: string
  title: string
  passage: string
  at: string | null
  node: string
  project: string | null
  folder: string | null
  context: string
  session_id: string | null
  resume: string | null
  cite: string | null
  via: string[]
}

export type EverywhereAnswer =
  | { ok: true; hits: EverywhereHit[]; degraded: string[]; docs: number }
  | { ok: false; reason: string }

export interface AroundNode { id: string; kind: string | null; label: string | null; known: boolean; hop: number; rel: string; direction: 'in' | 'out' }
export type AroundAnswer =
  | { ok: true; start: { id: string; kind: string | null; label: string | null } | null; nodes: AroundNode[]; capped: boolean }
  | { ok: false; reason: string }

/** Where each neighbour sits on rings around the centre, one ring per hop (a drawing; the list beneath says the same). */
export function ringLayout(nodes: readonly AroundNode[], size: number): Map<string, { x: number; y: number }> {
  const at = new Map<string, { x: number; y: number }>()
  const c = size / 2
  const byHop = new Map<number, AroundNode[]>()
  for (const n of nodes) byHop.set(n.hop, [...(byHop.get(n.hop) ?? []), n])
  const rings = Math.max(1, ...byHop.keys())
  for (const [hop, ring] of byHop) {
    const r = (c - 60) * (hop / rings)
    ring.forEach((n, i) => {
      const a = (2 * Math.PI * i) / ring.length - Math.PI / 2 + hop * 0.35
      at.set(n.id, { x: Math.round(c + r * Math.cos(a)), y: Math.round(c + r * Math.sin(a)) })
    })
  }
  return at
}
// #endregion window-answers
// #endregion estate-search
