// #region session-status-pill — docs: docs/ux/2026-10-26-simple-fabric-v2.md#45-session-status-r-19
/**
 * A session's status as the mockup's pill (R-19): its colour and shape beside the word, never the colour alone. One
 * component for the agent page and the console's header, so one agent reads one word in both (CO-472, UX-10).
 */
import type { SessionStatus } from '../../../shared/sessionStatus.ts'

export function StatusPill({ status, words }: { status: SessionStatus; words: string }): React.JSX.Element {
  return <span className={`as-status s-${status}`}><span className={`rail-dot s-${status}`} aria-hidden="true" />{words}</span>
}
// #endregion session-status-pill
