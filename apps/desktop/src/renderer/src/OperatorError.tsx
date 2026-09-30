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

import { humaniseError, type ErrorKind } from '../../shared/errorText'
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

export function OperatorError({ raw }: { raw: string }): React.JSX.Element {
  const t = useT()
  const message = humaniseError(raw)
  return (
    <>
      <strong>{message.kind ? t(KEYS[message.kind]) : t('error.title')}</strong>
      <p className="muted mono error-detail">{message.detail}</p>
    </>
  )
}

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
