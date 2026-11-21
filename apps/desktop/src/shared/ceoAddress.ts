// #region ceo-address — docs: docs/ux/scenarios.md#scn-191-the-ceos-voice-reads-the-board-itself
/**
 * The words the owner uses for the CEO itself (the owner, 2026-11-21: «Любое из слов директор, шеф, босс, менеджер,
 * главный, SEO должно сразу пониматься как обращение к CEO-агенту»). «SEO» is how the dictation hears «CEO»; the SEO
 * agent is called by its full name. Such a word is the CEO: never a project to look up and never another agent.
 *
 * A word alone, or the word with a case ending («шефу», «директора»), counts; a phrase that only contains one («SEO
 * агент», «главный экран») does not.
 */
const WORDS: readonly RegExp[] = [
  /^директор(а|у|ом|е)?$/u,
  /^шеф(а|у|ом|е)?$/u,
  /^босс(а|у|ом|е)?$/u,
  /^менеджер(а|у|ом|е)?$/u,
  /^главн(ый|ого|ому|ым|ом)$/u,
  /^(seo|ceo|сео|сиио|сио|си-и-о)$/u
]

/** The words as said to the voice, for its instructions and transcription hints. */
export const CEO_ADDRESS_WORDS: readonly string[] = ['директор', 'шеф', 'босс', 'менеджер', 'главный', 'SEO', 'СЕО', 'CEO']

export function isCeoAddress(text: string): boolean {
  const w = String(text ?? '').trim().toLowerCase().replace(/^[«"'(]+|[»"'),.!?:;]+$/gu, '')
  if (!w || /\s/.test(w)) return false
  return WORDS.some((re) => re.test(w))
}

/** The rule as the voice reads it, in the call's language. */
export function ceoAddressRule(locale: string): string {
  return locale === 'en'
    ? `The words ${CEO_ADDRESS_WORDS.map((w) => `«${w}»`).join(', ')} (and «директор», «шеф» in any case) mean the CEO agent of Fabric, the one you are the voice of: never look them up as a project and never take them for the SEO agent, which the owner calls by its full name.`
    : `Слова ${CEO_ADDRESS_WORDS.map((w) => `«${w}»`).join(', ')} (в любом падеже) означают CEO-агента Fabric, голос которого ты: никогда не ищи их как проект и не путай с SEO-агентом, его владелец называет полным именем.`
}
// #endregion ceo-address
