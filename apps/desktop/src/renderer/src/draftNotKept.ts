// #region draft-not-kept — docs: docs/adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md#decision
// A filled-in draft closed at once (ADR-0160 §1) whose words could not be kept to bring back: our sentence, its reason
// worded the way the act line words it, and the machine's words on their own line (0.3.7 review UX-16).
import type { Translate } from './i18n'
import { whyWords } from './launch/actWords'
import { withDetail } from './OperatorError'

export function draftNotKept(t: Translate, refusal: { reason: string; says?: string } | unknown): string {
  if (refusal instanceof Error || typeof refusal !== 'object' || refusal === null || !('reason' in refusal))
    return withDetail(t('drafts.notKept', { reason: whyWords(t, 'failed') }), refusal instanceof Error ? refusal.message : String(refusal))
  const r = refusal as { reason: string; says?: string }
  return withDetail(t('drafts.notKept', { reason: whyWords(t, r.reason) }), r.says)
}
// #endregion draft-not-kept
