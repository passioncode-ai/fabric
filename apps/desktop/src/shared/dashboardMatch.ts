// #region ceo-dashboard-match — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#amendment-3-2026-11-19-the-ceo-closes-and-arranges-windows-and-opens-dashboards
/**
 * Which dashboard the owner's words name («открой Аню», «покажи Growth», «Фрейм агент»), for the CEO's voice and text
 * (board request 374f27bf). Pure, so the tests read it as it runs (0.3.26 review, UX-1, UX-2):
 * - every word that is not a filler («открой», «дашборд», «на весь экран») must match the start of a word of the
 *   dashboard's name or key; a word of its description never chooses one;
 * - a Cyrillic word also matches the Latin name it sounds like («аналитику» finds Analytics, «фрейм» Frame), by the
 *   consonants of its transliteration;
 * - among the dashboards that match as well, the operator's own copy (instance `default`) beats an organisation's or
 *   a showcase, and a local one an online one; what is still tied is not guessed: the caller asks which.
 */
export interface DashboardLike { key: string; name: string; summary: string | null; placement: 'local' | 'remote' }

const FILLERS = new Set([
  'открой', 'открыть', 'откройте', 'покажи', 'показать', 'покажите', 'включи', 'включить', 'переключи', 'переключись', 'перейди',
  'дашборд', 'дашборды', 'дашборда', 'дашборде', 'панель', 'панели', 'страницу', 'страница', 'окно', 'мне', 'пожалуйста', 'на', 'в', 'во',
  'весь', 'экран', 'полный', 'полноэкранный', 'и', 'с', 'со', 'к', 'по', 'его', 'её', 'ее', 'это', 'этот', 'эту', 'агента', 'агент', 'агенту',
  'open', 'show', 'switch', 'to', 'the', 'a', 'an', 'dashboard', 'dashboards', 'page', 'please', 'me', 'full', 'screen', 'agent', 'on', 'of', 'in'
])

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
}
const translit = (w: string) => [...w].map((c) => CYR[c] ?? c).join('')
/** One spelling for letters that sound alike (y and i, c and k, ph and f, w and v, x and ks): «аналитику» and «analytics» meet. */
const plain = (latin: string) => latin.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/[cq]/g, 'k').replace(/w/g, 'v').replace(/x/g, 'ks').replace(/y/g, 'i').replace(/(.)\1+/g, '$1')
/** Consonants only: «фрейм» and «frame» meet, and so do many words that only sound near (UX-11), so a match on it alone is asked about. */
const skeleton = (latin: string) => plain(latin).replace(/[aeiou]/g, '')
const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
/** A word's start as the owner says it in any case: «Аню», «Ани» and «Аня» meet at «ан». */
const stem = (w: string) => (w.length <= 3 ? w.slice(0, Math.max(2, w.length - 1)) : w.length <= 5 ? w.slice(0, w.length - 1) : w.slice(0, w.length - 2))
const cyrillic = (w: string) => /[Ѐ-ӿ]/.test(w)

/** How a query word meets a dashboard's word: `sure` by its letters (in either script), `near` by its consonants only. */
function wordMatch(query: string, token: string): 'sure' | 'near' | null {
  if (token.startsWith(stem(query))) return 'sure'
  // A word in one script against a name in the other: by its spelling there, then by its consonants (UX-14, UX-11).
  if (cyrillic(query) === cyrillic(token)) return null
  const q = cyrillic(query) ? plain(translit(query)) : plain(query)
  const t = cyrillic(token) ? plain(translit(token)) : plain(token)
  // By letters across scripts only on four letters or more, or the whole word: «ан» meets far too much (UX-11).
  const qStem = plain(cyrillic(query) ? translit(stem(query)) : stem(query))
  if (t === q || (qStem.length >= 4 && t.startsWith(qStem))) return 'sure'
  const qs = skeleton(q), ts = skeleton(t)
  // The whole word's consonants, all of them: «рост» (rst) never meets «research» (rsrk).
  if (qs.length >= 3 && (ts === qs || (qs.length >= 4 && ts.startsWith(qs) && ts.length - qs.length <= 1))) return 'near'
  return null
}

/** The product a dashboard is a copy of: `id` of `id.instance`; a showcase shows the product it names. */
const productOf = (key: string) => {
  const [id, instance] = key.split('.', 2)
  return id === 'studio-showcase' && instance ? instance : id
}
/** Among copies of ONE product only (UX-10): the owner's own (`default`) first, then a local one, a showcase last. */
const rank = (d: DashboardLike) =>
  (d.key.endsWith('.default') || !d.key.includes('.') ? 0 : 2) + (d.key.startsWith('studio-showcase.') ? 4 : 0) + (d.placement === 'local' ? 0 : 1)

export type DashboardPick = { found: DashboardLike } | { ambiguous: DashboardLike[] } | { missing: true }

export function pickDashboard(all: readonly DashboardLike[], query: string): DashboardPick {
  const q = query.trim()
  const exact = all.find((d) => d.key === q)
  if (exact) return { found: exact }
  const lower = q.toLowerCase()
  // A whole name or a product's id is the owner naming it: «Research Agent», «research-agent» (UX-10).
  const named = all.filter((d) => d.name.toLowerCase() === lower || productOf(d.key) === lower)
  const pool = named.length ? named : null
  const asked = words(q).filter((w) => !FILLERS.has(w) && w.length >= 2)
  if (!pool && !asked.length) return { missing: true }
  const scored = (pool ?? all).flatMap((d) => {
    if (pool) return [{ d, near: false }]
    // A showcase's own word in its key names no product: «студию» means Studio, not every showcase.
    const tokens = words(`${d.key.replace(/^studio-showcase\./, '').replace(/[._-]/g, ' ')} ${d.name}`)
    let near = false
    for (const w of asked) {
      const m = tokens.map((t) => wordMatch(w, t))
      if (m.includes('sure')) continue
      if (m.includes('near')) { near = true; continue }
      return []
    }
    return [{ d, near }]
  })
  if (!scored.length) return { missing: true }
  // A dashboard found by its letters beats one found only by sound.
  const sure = scored.filter((x) => !x.near)
  const hits = (sure.length ? sure : scored).map((x) => x.d)
  // An organisation's copy whose id carries its prefix («org-tool») is a copy of the product it ends with
  // when that product is installed too (UX-17).
  const ids = new Set(all.map((d) => productOf(d.key)))
  const canonical = (key: string) => { const id = productOf(key); for (const other of ids) if (other !== id && id.endsWith(`-${other}`)) return other; return id }
  const products = new Set(hits.map((d) => canonical(d.key)))
  const sorted = [...hits].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  // Several products, or a match by sound only: asked about, never guessed.
  if (products.size > 1 || !sure.length) return { ambiguous: products.size > 1 ? sorted : sorted.slice(0, 1) }
  // Copies of one product with none of them the owner's own and two as good: which organisation's is asked (UX-1).
  const tied = sorted.filter((d) => rank(d) === rank(sorted[0]))
  if (tied.length > 1 && rank(sorted[0]) > 0) return { ambiguous: tied }
  return { found: sorted[0] }
}

/** Every dashboard whose name, key or description holds the words: the list the owner looks through. */
export function listDashboards<D extends DashboardLike>(all: readonly D[], query: string | undefined): D[] {
  const asked = words(query ?? '').filter((w) => !FILLERS.has(w) && w.length >= 2)
  if (!asked.length) return [...all]
  return all.filter((d) => {
    const tokens = words(`${d.key.replace(/[._-]/g, ' ')} ${d.name} ${d.summary ?? ''}`)
    return asked.every((q) => tokens.some((t) => wordMatch(q, t) !== null))
  }).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
// #endregion ceo-dashboard-match
