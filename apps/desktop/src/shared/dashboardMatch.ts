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
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'u', я: 'a'
}
const translit = (w: string) => [...w].map((c) => CYR[c] ?? c).join('')
/** Consonants only, with the letters that sound alike made one (c and k, ph and f, w and v): «фрейм» and «frame» meet. */
const skeleton = (latin: string) => latin.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/[cq]/g, 'k').replace(/w/g, 'v').replace(/x/g, 'ks').replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1')
const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
/** A word's start as the owner says it in any case: «Аню», «Ани» and «Аня» meet at «ан». */
const stem = (w: string) => (w.length <= 3 ? w.slice(0, Math.max(2, w.length - 1)) : w.length <= 5 ? w.slice(0, w.length - 1) : w.slice(0, w.length - 2))
const cyrillic = (w: string) => /[Ѐ-ӿ]/.test(w)

function wordMatches(query: string, token: string): boolean {
  if (token.startsWith(stem(query))) return true
  if (cyrillic(query) && !cyrillic(token)) {
    const q = skeleton(translit(stem(query)))
    return q.length >= 2 && skeleton(token).startsWith(q)
  }
  return false
}

const rank = (d: DashboardLike) =>
  (d.key.endsWith('.default') || !d.key.includes('.') ? 0 : 2) + (d.key.startsWith('studio-showcase.') ? 4 : 0) + (d.placement === 'local' ? 0 : 1)

export type DashboardPick = { found: DashboardLike } | { ambiguous: DashboardLike[] } | { missing: true }

export function pickDashboard(all: readonly DashboardLike[], query: string): DashboardPick {
  const exact = all.find((d) => d.key === query.trim())
  if (exact) return { found: exact }
  const asked = words(query).filter((w) => !FILLERS.has(w) && w.length >= 2)
  if (!asked.length) return { missing: true }
  const hits = all.filter((d) => {
    const tokens = words(`${d.key.replace(/[._-]/g, ' ')} ${d.name}`)
    return asked.every((q) => tokens.some((t) => wordMatches(q, t)))
  })
  if (!hits.length) return { missing: true }
  const best = Math.min(...hits.map(rank))
  const top = hits.filter((d) => rank(d) === best)
  return top.length === 1 ? { found: top[0] } : { ambiguous: [...top].sort((a, b) => a.name.localeCompare(b.name)) }
}

/** Every dashboard whose name, key or description holds the words: the list the owner looks through. */
export function listDashboards<D extends DashboardLike>(all: readonly D[], query: string | undefined): D[] {
  const asked = words(query ?? '').filter((w) => !FILLERS.has(w) && w.length >= 2)
  if (!asked.length) return [...all]
  return all.filter((d) => {
    const tokens = words(`${d.key.replace(/[._-]/g, ' ')} ${d.name} ${d.summary ?? ''}`)
    return asked.every((q) => tokens.some((t) => wordMatches(q, t)))
  }).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
// #endregion ceo-dashboard-match
