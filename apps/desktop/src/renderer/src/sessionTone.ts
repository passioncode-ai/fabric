import type { ChipTone } from './components'
import type { SessionState } from '../../shared/types'

/**
 * One mapping from an observed session state to a chip tone (M117).
 *
 * It lives here rather than inside `StateChip` on purpose: the component set is
 * generic and must not know what a session is, while the mapping is product
 * semantics that every screen has to agree on. Before this, `Workspace`,
 * `SessionWindow` and `ProjectHome` each spelled `state-badge ${state}` and
 * relied on CSS to agree with them.
 *
 * `ended` is quiet rather than red: a session that finished is an absence, not a
 * failure, and colouring it like one is the misreading `docs/brand/ui.md` warns
 * about when it says a state is carried by its word.
 */
export function sessionTone(state: SessionState): ChipTone {
  switch (state) {
    case 'running':
      return 'info'
    case 'idle':
      return 'warn'
    case 'ended':
      return 'quiet'
  }
}
