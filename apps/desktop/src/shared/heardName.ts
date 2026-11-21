// #region heard-name — docs: docs/reports/2026-11-20-voice-ceo-retro/fixes.md#4-project-names-heard-by-voice
/**
 * A name as it is heard, not as it is spelt (voice CEO retro 2026-11-20, finding 4). The voice call's transcription
 * wrote «DC» for «Диззи» (the project dissy), Cyrillic for Latin names («ПлейТюн», «Саунд энджин») and words for a
 * hyphen. `soundKey` folds a name into a rough sound: Cyrillic to Latin, a spelt acronym to its letters' names, the
 * spellings English writes one sound with to one letter, doubled letters to one. `heardDistance` compares two keys by
 * edit distance over the longer one, so «fabrik» and «fabric» meet while «dissy» and «disk» do not.
 *
 * Pure: no project list here; `ceoAgent.ts#findProject` ranks with it.
 */

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'G', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'i', є: 'e', ґ: 'g'
}

/** How an English speaker names each letter, as Russian transcription writes it back («ди си» for DC). */
const LETTER_NAMES: Record<string, string> = {
  a: 'ei', b: 'bi', c: 'si', d: 'di', e: 'i', f: 'ef', g: 'dzhi', h: 'eich', i: 'ai', j: 'dzhei', k: 'kei', l: 'el',
  m: 'em', n: 'en', o: 'ou', p: 'pi', q: 'kyu', r: 'ar', s: 'es', t: 'ti', u: 'yu', v: 'vi', w: 'dablyu', x: 'eks',
  y: 'uai', z: 'zi'
}

/** Cyrillic letters in their Latin transcription; everything else as it is, lower case. Russian «г» is always a hard
 *  g, so it is kept apart (`G`) from a Latin g that softens before e and i, and folded back by the caller. */
function transcribe(text: string): string {
  let out = ''
  for (const ch of String(text ?? '').toLowerCase()) out += CYRILLIC[ch] ?? ch
  return out
}
export function transliterate(text: string): string {
  return transcribe(text).toLowerCase()
}

/** A spelt acronym (two to four capitals, «DC», «AI») read as its letters' names; any other word as it is. */
export function spellAcronyms(text: string): string {
  return String(text ?? '').replace(/\b[A-Z]{2,4}\b/g, (w) => [...w.toLowerCase()].map((c) => LETTER_NAMES[c] ?? c).join(''))
}

/** The rough sound of a name: one key per name, separators gone. */
export function soundKey(text: string): string {
  let s = transcribe(text).replace(/[^a-zG0-9]+/g, ' ').trim()
  const rules: Array<[RegExp, string]> = [
    // English spellings first, while their letters are still there.
    [/dzh|dj/g, 'j'], [/zh/g, 'j'], [/g(?=[eiy])/g, 'j'], [/c(?=[eiy])/g, 's'],
    // A magic e: «frame», «gateway» say the a as «ei»; «icebox» says the i as «ai» inside a word.
    [/a([bdfklmnprstvz])e/g, 'ei$1'], [/ise(?=[a-z])/g, 'ais'],
    // A final silent e of a word («engine», «sound engine») is not heard.
    [/([a-z]{2,})e\b/g, '$1'],
    [/\s+/g, ''],
    [/sch|shch/g, 'sh'], [/tch/g, 'ch'], [/ph/g, 'f'], [/th/g, 't'], [/ck/g, 'k'], [/qu/g, 'kv'], [/q/g, 'k'],
    [/c(?!h)/g, 'k'], [/x/g, 'ks'], [/w/g, 'v'], [/ts/g, 'c'], [/z/g, 's'],
    [/ay|ey|ei|ai/g, 'ei'], [/ou|ow|au|aw/g, 'au'], [/ee|ea|ie/g, 'i'], [/oo/g, 'u'],
    [/yu|iu/g, 'u'], [/ya|ia/g, 'a'], [/y/g, 'i'], [/h/g, '']
  ]
  for (const [re, to] of rules) s = s.replace(re, to)
  return s.toLowerCase().replace(/(.)\1+/g, '$1')
}

/** Every key a heard query may stand for: as written, and with a spelt acronym read as its letters. */
export function heardKeys(query: string): string[] {
  const keys = new Set([soundKey(query), soundKey(spellAcronyms(query))])
  keys.delete('')
  return [...keys]
}

/** Levenshtein distance between two strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]!
}

/** How far a heard key is from a name's key: 0 the same sound, 1 nothing alike (edits over the longer key). */
export function heardDistance(a: string, b: string): number {
  if (!a || !b) return 1
  return editDistance(a, b) / Math.max(a.length, b.length)
}

/** Close enough to be the name that was meant: the same sound for a key of four or fewer («disk» is not «dissy»),
 *  one edit up to seven, else a quarter of the longer key. */
export function heardClose(a: string, b: string): boolean {
  if (!a || !b) return false
  const d = editDistance(a, b)
  const n = Math.max(a.length, b.length)
  return n <= 4 ? d === 0 : n <= 7 ? d <= 1 : d / n <= 0.25
}

/** The keys a project answers to: its name, its folder's last part, and each run of its words of four letters or more
 *  («project-observatory» also answers to «observatory», «telegram-gateway-agent» to «telegram gateway»), plus each
 *  alias the owner gave it. */
export function nameKeys(name: string, folder: string | null, aliases: readonly string[] = []): string[] {
  const keys = new Set<string>()
  const add = (s: string): void => {
    const k = soundKey(s)
    if (k) keys.add(k)
    const words = transliterate(s).split(/[^a-z0-9]+/).filter(Boolean)
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= words.length; j++) {
        if (i === 0 && j === words.length) continue
        const run = soundKey(words.slice(i, j).join(' '))
        if (run.length >= 4) keys.add(run)
      }
    }
  }
  add(name)
  if (folder) add(folder.replace(/\/+$/, '').split('/').pop() ?? '')
  for (const a of aliases) { const k = soundKey(a); if (k) keys.add(k) }
  return [...keys]
}
// #endregion heard-name
