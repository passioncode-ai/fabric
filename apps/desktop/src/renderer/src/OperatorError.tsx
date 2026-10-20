// The one place a failure becomes words (M106).
//
// Forty-eight sites call `onError(String(e))`, and every one of them is the
// same `setError` on `App` — so all forty-eight reach the operator through the
// single banner below. Fixing it there rather than at the sites is not a
// shortcut: the site knows what failed, and the display is what owes a person
// words. It also means the forty-ninth site is right on the day it is written.
//
// What the operator was reading before this:
//   Error invoking remote method 'memory:search': Error: …
// a mechanism they have no relationship with, named first.
//
// The machine's words are KEPT, subordinate to our sentence rather than
// replaced by it. A named cause with its evidence hidden is undiagnosable the
// first time the cause is named wrongly, and this follows the startup dialog's
// shape for exactly that reason.

import { humaniseError, unwrap, type ErrorKind } from '../../shared/errorText'
import { Button } from './components'
import { useT } from './i18n'
import type { StringKey } from './i18n/en'

const KEYS: Record<ErrorKind, StringKey> = {
  'session-would-not-start': 'error.session-would-not-start',
  'supabase-cli-missing': 'error.supabase-cli-missing',
  'stack-start-timed-out': 'error.stack-start-timed-out',
  'stack-would-not-start': 'error.stack-would-not-start',
  'stack-up-but-silent': 'error.stack-up-but-silent',
  'repository-not-found': 'error.repository-not-found',
  'schema-missing': 'error.schema-missing',
  'database-unreachable': 'error.database-unreachable'
}

/** A failure's machine words as a secondary line under a sentence in the operator's language — never the sentence
 *  itself, and never hidden (0.3.5 review UX-10: Comms, the work screens and the quota said raw English). */
export function MachineDetail({ text }: { text: string | null | undefined }): React.JSX.Element | null {
  return text ? <p className="muted mono error-detail">{text}</p> : null
}

/** A failed read or act on a launch screen: our sentence in the operator's language, the machine's words on their own
 *  line beneath it (2026-10-14 release review UX-5: «Неизвестно, кто работает: the claimed tasks could not be read…»). */
export function FailureNote({ said, detail, role = 'alert' }: { said: string; detail: string | null | undefined; role?: 'alert' | 'status' }): React.JSX.Element {
  return (
    <div className="lp-failure" role={role}>
      <p className="lp-meta">{said}</p>
      <MachineDetail text={detail} />
    </div>
  )
}

// #region failure-with-detail — docs: docs/evidence/reviews/0.3.7/iteration-1/2026-10-20-ux.md
/** A sentence a site already wrote in the person's language, with the machine's words apart, through the one banner
 *  (`setError` carries a string): U+2029, the paragraph separator, never appears in a machine's message, so it marks
 *  where our sentence ends (0.3.7 review UX-16). */
const SENTENCE_END = '\u2029'
export function withDetail(said: string, detail: string | null | undefined): string {
  return `${said}${SENTENCE_END}${detail ? unwrap(detail) : ''}`
}

export function OperatorError({ raw }: { raw: string }): React.JSX.Element {
  const t = useT()
  const cut = raw.indexOf(SENTENCE_END)
  if (cut >= 0) {
    return (
      <>
        <strong>{raw.slice(0, cut)}</strong>
        <MachineDetail text={raw.slice(cut + 1)} />
      </>
    )
  }
  const message = humaniseError(raw)
  return (
    <>
      <strong>{message.kind ? t(KEYS[message.kind]) : t('error.title')}</strong>
      <p className="muted mono error-detail">{message.detail}</p>
    </>
  )
}
// #endregion failure-with-detail

/**
 * M106a — the window could not read what it is for.
 *
 * A separate surface from the banner because nothing else on the screen can be
 * trusted at this point: the window does not know whether it is the estate, a
 * session or a file, and drawing the estate on a guess would be worse than
 * drawing nothing. Before this it drew nothing AND said nothing.
 */
export function BootFailure({
  raw,
  onRetry
}: {
  raw: string
  onRetry: () => void
}): React.JSX.Element {
  const t = useT()
  const message = humaniseError(raw)
  return (
    <div className="booting booting-failed">
      <div className="boot-failure">
        <strong>{t('boot.failedTitle')}</strong>
        <p className="muted">{t('boot.failedLede')}</p>
        <p className="muted">{message.kind ? t(KEYS[message.kind]) : ''}</p>
        <p className="muted mono error-detail">{message.detail}</p>
        <Button onClick={onRetry}>{t('boot.retry')}</Button>
      </div>
    </div>
  )
}
