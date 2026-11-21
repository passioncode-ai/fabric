// #region approval-mode — docs: docs/adr/0203-the-owners-approval-mode-says-which-acts-wait-for-him.md#decision
/**
 * The owner's approval mode (ADR-0203; the owner, 2026-11-20, package D: «одобрять важные», «только критичные»,
 * «только траты», «только нестандартные», «ничего, полная автоматика»). It says which acts above the floor (ADR-0028:
 * money, deletion, publication) wait for the owner's yes, and it is the one rule handed to every session, the CEO and
 * its voice. What the owner ordered is done to the end in every mode: a session never sits waiting, a decision that is
 * not the owner's goes to the board.
 *
 * The human gates are outside any mode: a sign-in, a one-time code, a payment or top-up, a typed secret and a consent
 * screen need the person's own hands, so they wait in every mode, «полная автоматика» included.
 *
 * Pure: the host reads the setting (`settings.json` `approvalMode`) and the act's history.
 */

export type ApprovalMode = 'important' | 'critical' | 'spending' | 'unusual' | 'none'

export const APPROVAL_MODES: readonly ApprovalMode[] = ['important', 'critical', 'spending', 'unusual', 'none']

/** Today's floor: every act above it waits. A missing or unknown value is this, never a looser mode. */
export const DEFAULT_APPROVAL_MODE: ApprovalMode = 'important'

export function approvalModeOf(raw: unknown): ApprovalMode {
  return typeof raw === 'string' && (APPROVAL_MODES as readonly string[]).includes(raw) ? (raw as ApprovalMode) : DEFAULT_APPROVAL_MODE
}

type Locale = 'ru' | 'en'
const loc = (l: string | undefined): Locale => (l === 'en' ? 'en' : 'ru')

const LABELS: Record<Locale, Record<ApprovalMode, string>> = {
  ru: { important: 'одобрять важные', critical: 'только критичные', spending: 'только траты', unusual: 'только нестандартные', none: 'ничего, полная автоматика' },
  en: { important: 'approve what matters', critical: 'only critical', spending: 'only spending', unusual: 'only unusual', none: 'nothing, full automation' }
}

export function approvalModeLabel(mode: ApprovalMode, locale?: string): string {
  return LABELS[loc(locale)][mode]
}

/** The gates that need the person in every mode. */
export const HUMAN_GATES: Readonly<Record<Locale, readonly string[]>> = {
  ru: ['вход в аккаунт', 'одноразовый код', 'оплата или пополнение', 'секрет, который вводит человек', 'экран согласия'],
  en: ['a sign-in', 'a one-time code', 'a payment or top-up', 'a secret a person types', 'a consent screen']
}

const FLOOR = new Set(['money', 'deletion', 'publication'])

/**
 * Whether an act of `floorClass` waits for the owner under `mode`. `firstTime` is whether this project has never done
 * an act of this class on this target before (null: unknown, read as a first time). An unknown class always waits.
 */
export function waitsForOwner(mode: ApprovalMode, floorClass: string, history: { firstTime: boolean | null }): boolean {
  if (!FLOOR.has(floorClass)) return true
  switch (mode) {
    case 'important': return true
    case 'critical': return floorClass === 'deletion' || floorClass === 'publication'
    case 'spending': return floorClass === 'money'
    case 'unusual': return history.firstTime !== false
    case 'none': return false
  }
}

const WAITS: Record<Locale, Record<ApprovalMode, string>> = {
  ru: {
    important: 'Ждут одобрения владельца: траты, удаление того, что не восстановить, и публикация наружу.',
    critical: 'Ждут одобрения владельца только критичные действия: удаление того, что не восстановить, и публикация наружу. Траты в пределах лимитов идут сами.',
    spending: 'Ждут одобрения владельца только траты. Удаление и публикация идут сами.',
    unusual: 'Ждёт одобрения владельца только нестандартное: действие, которого проект ещё не делал с этой целью. Повтор уже одобренного идёт сам.',
    none: 'Одобрения владельца не ждёт ничего: Fabric сама выдаёт разрешение на действие и записывает, по какому режиму.'
  },
  en: {
    important: 'Waiting for the owner: spending, deleting what cannot be recovered, and publishing outward.',
    critical: 'Only critical acts wait for the owner: deleting what cannot be recovered and publishing outward. Spending within the limits goes ahead.',
    spending: 'Only spending waits for the owner. Deletion and publication go ahead.',
    unusual: 'Only the unusual waits for the owner: an act this project has not done on this target before. A repeat of an approved act goes ahead.',
    none: 'Nothing waits for the owner: Fabric issues the permission itself and records which mode allowed it.'
  }
}

/** The rule handed to every session, the CEO and its voice: the mode, what waits, delegation, the human gates. */
/** What a mode makes wait for the owner, in one sentence, for the place the owner switches it (Settings). */
export function approvalModeWaits(mode: ApprovalMode, locale?: string): string {
  return WAITS[loc(locale)][mode]
}

export function approvalRule(mode: ApprovalMode, locale?: string): string {
  const l = loc(locale)
  const gates = HUMAN_GATES[l].join(', ')
  return l === 'ru'
    ? `Режим одобрения владельца: «${LABELS.ru[mode]}». ${WAITS.ru[mode]} Действие выше порога всё равно проходит через fabric_effect_request: Fabric сама решает по режиму. Что владелец поручил, делается до конца: не сиди в ожидании, решение, которое не его, оформи на доске и продолжай. Всегда ждут человека: ${gates}.`
    : `The owner's approval mode: «${LABELS.en[mode]}». ${WAITS.en[mode]} An act above the floor still goes through fabric_effect_request: Fabric decides by the mode. What the owner ordered is done to the end: never stop to wait, put a decision that is not his on the board and go on. Always waiting for the person: ${gates}.`
}
// #endregion approval-mode
