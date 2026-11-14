// #region board-search — docs: docs/evidence/specs/2026-11-14-board-search.md#2-the-ranking
/**
 * The board search's ranking (the operator, 2026-11-14: «хочу чтобы агенты делали раг поиск по доске когда ищут связи
 * кто чем занят»): the retrieval half of an agent's search, the agent being the model that reads what comes back.
 *
 * Lexical, on purpose: the estate's embedding policy sends no caller's query to a remote model (Observatory's
 * `embedding-policy/1`), and the board holds the operator's words. So the query and the documents are read as words in
 * Russian and English, each reduced to its stem by a light suffix rule, ids (`CO-571`, `fabric_work_list`,
 * `boardDispatchRun.ts`) kept whole beside their parts, and ranked by BM25 over a document's title (weighted three) and
 * text, with recency and live work raised. A long word also matches by its prefix, at half weight. An agent that wants
 * meaning across languages passes words in both, as the tool's description tells it. Pure: no clock, no reads.
 */

export type SearchKind = 'task' | 'note' | 'request' | 'message' | 'project'

export interface SearchDoc {
  id: string
  kind: SearchKind
  title: string
  text: string
  /** When it last moved (a task) or was written (a note, a message); null when unknown. */
  at: string | null
  /** A task a live claim holds now, or a request still open: work someone is on. */
  live?: boolean
}

export interface SearchHit<D extends SearchDoc = SearchDoc> {
  doc: D
  score: number
  /** The query's own words (lower case) that matched, in the query's order. */
  matched: string[]
  /** About 240 characters of the title and text around the first matched word. */
  snippet: string
}

const STOP = new Set([
  // English
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'at', 'is', 'are', 'was', 'be', 'it', 'its',
  'this', 'that', 'as', 'from', 'not', 'no', 'but', 'who', 'what', 'which', 'when', 'where', 'how', 'do', 'does', 'into',
  // Russian
  'и', 'в', 'во', 'на', 'с', 'со', 'по', 'к', 'ко', 'о', 'об', 'от', 'до', 'за', 'из', 'у', 'не', 'ни', 'но', 'а', 'или',
  'что', 'это', 'как', 'для', 'при', 'же', 'ли', 'бы', 'то', 'так', 'его', 'её', 'ее', 'их', 'кто', 'чем', 'где', 'когда'
])

// Longest first: the first that leaves a stem of three letters or more is taken.
const RU_ENDINGS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ость', 'ости', 'ения', 'ение', 'ений', 'ании', 'ание',
  'иях', 'ией', 'иям', 'ает', 'ают', 'яет', 'яют', 'ует', 'уют', 'ить', 'ать', 'ять', 'еть', 'ешь', 'ишь', 'ете', 'ите',
  'ала', 'ило', 'ила', 'али', 'или', 'ные', 'ный', 'ная', 'ное', 'ных', 'ным', 'ной', 'ную',
  'ов', 'ев', 'ей', 'ий', 'ый', 'ой', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях',
  'ию', 'ия', 'ть', 'ут', 'ют', 'ит', 'ет', 'ал', 'ил', 'ла', 'ло', 'ли',
  'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й'
].sort((x, y) => y.length - x.length)
const EN_RULES: Array<[RegExp, string]> = [
  [/ations$/, 'ate'], [/ation$/, 'ate'], [/ings$/, ''], [/ing$/, ''], [/ies$/, 'y'], [/ied$/, 'y'], [/ers$/, ''],
  [/er$/, ''], [/ed$/, ''], [/es$/, ''], [/ly$/, ''], [/(?<![su])s$/, '']
]

/** A word's stem: a light suffix rule per script; a word of three letters or fewer is kept as it is. */
export function stem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е')
  if (w.length <= 3) return w
  if (/[а-я]/.test(w)) {
    for (const e of RU_ENDINGS) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length)
    return w
  }
  if (/^[a-z]+$/.test(w)) {
    for (const [re, to] of EN_RULES) {
      if (!re.test(w)) continue
      const s = w.replace(re, to)
      if (s.length >= 3) return s
    }
  }
  return w
}

const WORD = /[\p{L}\p{N}]+/gu
/** How much of one document is read (ER-1, ER-3, 0.3.21 review, iteration 1): a board message may be 64 KB written by
 *  another project, and the main process ranks every document on each call. */
export const TEXT_MAX = 6000
/** The longest word kept whole; a longer run is cut, never matched in full. */
export const WORD_MAX = 64
/** The most query words searched (ER-9, 0.3.21 review, iteration 2): each word walks the board's vocabulary for its
 *  prefixes, and a 300-character query of absent words measured 8.5 s cold at the read bounds. */
export const QUERY_WORDS = 12

/** The words of a text, linear in its length, each cut at WORD_MAX. */
function wordsOf(text: string): Array<{ word: string; at: number }> {
  const out: Array<{ word: string; at: number }> = []
  for (const m of text.slice(0, TEXT_MAX).matchAll(WORD)) out.push({ word: m[0].slice(0, WORD_MAX), at: m.index! })
  return out
}

/** Ids: neighbouring words joined by one of `-_./` with nothing else between (`CO-571`, `fabric_work_list`,
 *  `boardDispatchRun.ts`). Built from the words, never by a backtracking pattern (ER-1: one 64 KB run took 5 s). */
function compoundsOf(text: string, words: Array<{ word: string; at: number }>): string[] {
  const out: string[] = []
  let run: string[] = []
  let end = -1
  const flush = () => { if (run.length > 1) out.push(run.join('').toLowerCase()); run = [] }
  for (const w of words) {
    const sep = end >= 0 && w.at === end + 1 ? text[end] : null
    if (sep !== null && '-_./'.includes(sep) && run.length) run.push(sep, w.word)
    else { flush(); run = [w.word] }
    end = w.at + w.word.length
  }
  flush()
  return out
}

/** One word's terms: its stem, and for a camelCase word the whole word beside its parts' stems. */
function wordTerms(raw: string): string[] {
  const parts = raw.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ')
  const out = parts.length > 1 ? [raw.toLowerCase()] : []
  for (const p of parts) if (p.length >= 2 && !STOP.has(p.toLowerCase())) out.push(stem(p))
  return out
}

/** A text's terms: ids whole (lower case), then every word's stem; stop words and single letters are dropped. */
export function terms(text: string): string[] {
  const t = text.slice(0, TEXT_MAX).normalize('NFKC').replace(/[Ёё]/g, (c) => (c === 'Ё' ? 'Е' : 'е'))
  const words = wordsOf(t)
  const out: string[] = compoundsOf(t, words)
  for (const w of words) out.push(...wordTerms(w.word))
  return out
}

/** How many words of the query can be searched: none for an empty query or one of stop words alone. */
export function searchableWords(query: string): number {
  return queryWords(query).length
}

/** The query's own words in their order, each with its terms; stop words dropped, duplicates once. An id (`CO-571`,
 *  `boardDispatchRun.ts`) counts as one word where it stands (DA-9, DO-19, 0.3.21 review, iteration 3). */
function allQueryWords(query: string): Array<{ word: string; terms: string[] }> {
  const seen = new Set<string>()
  const words: Array<{ word: string; terms: string[] }> = []
  const t = query.slice(0, TEXT_MAX).normalize('NFKC')
  const add = (raw: string, ts: string[]) => {
    const word = raw.toLowerCase()
    if (ts.length && !seen.has(word)) { seen.add(word); words.push({ word, terms: ts }) }
  }
  let run: Array<{ word: string; at: number }> = []
  const flush = () => {
    if (run.length > 1) {
      const id = run.map((w, i) => (i ? t[run[i - 1].at + run[i - 1].word.length] : '') + w.word).join('').toLowerCase()
      add(id, [id.replace(/ё/g, 'е')])
    } else if (run.length === 1) add(run[0].word, wordTerms(run[0].word))
    run = []
  }
  for (const w of wordsOf(t)) {
    const prev = run[run.length - 1]
    const end = prev ? prev.at + prev.word.length : -1
    if (prev && w.at === end + 1 && '-_./'.includes(t[end])) run.push(w)
    else { flush(); run = [w] }
  }
  flush()
  return words
}

/** The words searched: the first QUERY_WORDS of the query's own words. */
function queryWords(query: string): Array<{ word: string; terms: string[] }> {
  return allQueryWords(query).slice(0, QUERY_WORDS)
}

/** The query's words split into those searched and those past QUERY_WORDS, so an answer can name what was left out
 *  (UX-11, 0.3.21 review, iteration 3). */
export function queryCut(query: string): { searched: string[]; notSearched: string[] } {
  const all = allQueryWords(query).map((w) => w.word)
  return { searched: all.slice(0, QUERY_WORDS), notSearched: all.slice(QUERY_WORDS) }
}

const K1 = 1.2
const B = 0.75
const TITLE_WEIGHT = 3
const PREFIX_WEIGHT = 0.5
const PREFIX_MIN = 5
const DAY_MS = 86_400_000

interface Indexed<D> { doc: D; tf: Map<string, number>; len: number; seen: Map<string, number> }

function index<D extends SearchDoc>(doc: D): Indexed<D> {
  const tf = new Map<string, number>()
  const title = terms(doc.title), text = terms(doc.text)
  for (const t of title) tf.set(t, (tf.get(t) ?? 0) + TITLE_WEIGHT)
  for (const t of text) tf.set(t, (tf.get(t) ?? 0) + 1)
  return { doc, tf, len: title.length * TITLE_WEIGHT + text.length, seen: new Map() }
}

/** How often a term occurs in a document: exactly, or, for a long term, as a prefix either way at half weight. */
function frequency(ix: Indexed<SearchDoc>, term: string): number {
  const exact = ix.tf.get(term)
  if (exact) return exact
  if (term.length < PREFIX_MIN) return 0
  // ER-3: the prefix walk over a document's terms is done once per term and kept for the score.
  const known = ix.seen.get(term)
  if (known !== undefined) return known
  let f = 0
  // ER-12 (0.3.21 review, iteration 3): an id (`boardDispatchRun.ts`, `fabric_work_list`) is matched whole or as the start
  // of a longer document term, never by a shorter document word it begins with (`board`, `fabric`).
  const id = /[-_./]/.test(term)
  for (const [t, n] of ix.tf) if (t.length >= PREFIX_MIN && (t.startsWith(term) || (!id && term.startsWith(t)))) f += n * PREFIX_WEIGHT
  ix.seen.set(term, f)
  return f
}

function snippetOf(doc: SearchDoc, words: string[]): string {
  const whole = doc.text ? `${doc.title} · ${doc.text.slice(0, TEXT_MAX)}` : doc.title
  const flat = whole.replace(/\s+/g, ' ').trim()
  if (flat.length <= 240) return flat
  const lower = flat.toLowerCase()
  const hits = words.map((w) => lower.indexOf(w.slice(0, Math.max(3, Math.min(w.length, 6))))).filter((i) => i >= 0)
  const at = hits.length ? Math.min(...hits) : 0
  const start = Math.max(0, Math.min(at - 60, flat.length - 240))
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 240)}${start + 240 < flat.length ? '…' : ''}`
}

/**
 * The documents that match the query, best first, at most `limit`. A document matching none of the query's words is
 * not answered. The score is BM25 times how much of the query matched (half to whole), times recency (up to 1.5 for
 * today, falling over two weeks) and 1.3 for live work.
 */
export function rankDocs<D extends SearchDoc>(query: string, docs: readonly D[], opts: { now: number; limit: number }): Array<SearchHit<D>> {
  const words = queryWords(query)
  if (!words.length || !docs.length) return []
  const indexed = docs.map(index)
  const avg = indexed.reduce((s, x) => s + x.len, 0) / indexed.length || 1
  const allTerms = [...new Set(words.flatMap((w) => w.terms))]
  const df = new Map(allTerms.map((t) => [t, indexed.filter((ix) => frequency(ix, t) > 0).length]))
  const n = indexed.length
  const hits: Array<SearchHit<D>> = []
  for (const ix of indexed) {
    let bm25 = 0
    const matched: string[] = []
    for (const w of words) {
      let wordScore = 0
      for (const t of w.terms) {
        const f = frequency(ix, t)
        if (!f) continue
        const d = df.get(t) ?? 0
        const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5))
        wordScore += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * (ix.len / avg)))
      }
      if (wordScore > 0) { bm25 += wordScore; matched.push(w.word) }
    }
    if (!matched.length) continue
    const at = ix.doc.at ? Date.parse(ix.doc.at) : NaN
    const ageDays = Number.isFinite(at) ? Math.max(0, (opts.now - at) / DAY_MS) : 90
    const score = bm25 * (0.5 + 0.5 * (matched.length / words.length)) * (1 + 0.5 * Math.exp(-ageDays / 14)) * (ix.doc.live ? 1.3 : 1)
    hits.push({ doc: ix.doc, score: Math.round(score * 1000) / 1000, matched, snippet: snippetOf(ix.doc, matched) })
  }
  return hits.sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id)).slice(0, Math.max(0, opts.limit))
}

export interface ClaimLike {
  claimId: string
  taskId: string
  owner: string
  agent: string | null
  title: string
  touches: readonly string[]
}

// ER-11 (0.3.21 review, iteration 3): every repository of this estate carries these, often once per package.
const GENERIC_NAMES = new Set(['src', 'lib', 'app', 'apps', 'main', 'index', 'readme', 'test', 'tests', 'docs', 'shared', 'scripts',
  'package', 'utils', 'types', 'components', 'changelog', 'license', 'agents', 'claude', 'contributing', 'makefile', 'dockerfile',
  'tsconfig', 'eslintrc', 'prettierrc', 'gitignore', 'vite', 'vitest', 'jest', 'babel', 'webpack', 'rollup', 'pnpm-lock',
  'package-lock', 'yarn', 'cargo', 'pyproject', 'requirements', 'setup', 'config', 'settings', 'global', 'globals', 'styles'])

/** A claim's touches read as words: each path's file or folder name, never the shared prefix every path carries. */
function touchWords(touches: readonly string[]): string {
  // ER-8 (0.3.21 review, iteration 2): a name every repository has (src, index, README, test) or one under four letters
  // never enters the comparison, as a word or as a shared name, so it links nothing.
  // ER-11 (iteration 3): a name is read up to its first dot after any leading ones, so `index.test.ts`, `index.d.ts` and
  // `.eslintrc.cjs` read as `index` and `eslintrc`.
  return touches.map((p) => (p.replace(/\/+$/, '').split('/').pop() ?? '').replace(/^\.+/, '').split('.')[0])
    .filter((n) => n.length >= 4 && !GENERIC_NAMES.has(n.toLowerCase())).join(' ')
}

/**
 * Live claims of other sessions whose task reads like the one being claimed (the claim's answer, `similar_work`): at
 * most three, each sharing two of its words or half of them. Never the session's own claims or the same task.
 */
export function similarClaims(mine: { taskId: string; owner: string; title: string; touches: readonly string[] }, claims: readonly ClaimLike[]):
  Array<ClaimLike & { matched: string[]; score: number }> {
  const query = `${mine.title} ${touchWords(mine.touches)}`
  const total = queryWords(query).length
  if (!total) return []
  const others = claims.filter((c) => c.owner !== mine.owner && c.taskId !== mine.taskId)
  const docs = others.map((c) => ({ id: c.claimId, kind: 'task' as const, title: c.title, text: touchWords(c.touches), at: null, claim: c }))
  // A file or folder name both claims touch is a link on its own, whatever the titles say.
  // ER-5: a name every repository has (src, index, README, test) links nothing.
  const names = (ts: readonly string[]) => new Set(touchWords(ts).toLowerCase().split(' ').filter(Boolean))
  const mineNames = names(mine.touches)
  const sharesName = (c: ClaimLike) => [...names(c.touches)].some((n) => mineNames.has(n))
  return rankDocs(query, docs, { now: 0, limit: docs.length })
    .filter((h) => h.matched.length >= 2 || h.matched.length / total >= 0.5 || sharesName(h.doc.claim))
    .slice(0, 3)
    .map((h) => ({ ...h.doc.claim, matched: h.matched, score: h.score }))
}
// #endregion board-search
