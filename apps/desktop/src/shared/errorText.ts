// What a failure looks like to the operator (M106c).
//
// Forty-eight sites call `onError(String(e))` — the row said "roughly
// fourteen" — and EVERY ONE of them is the same `setError`, so all forty-eight
// reach the person through a single banner. That is why this is fixed at the
// display, not at the call sites: the sites know what failed, and the display
// is what owes a person words.
//
// The exact text the row complains about is Electron's own:
// `Error invoking remote method 'memory:search': …`. It names a mechanism the
// operator has no relationship with, and it is the first thing they read.
//
// TWO COPIES OF A RULE IS HOW A RULE STOPS BEING ONE. The infrastructure
// failures a running app hits — the stack stopped, the migrations are not
// there — are the same failures `startupFailure.ts` already classifies for the
// startup dialog, so this DELEGATES to it rather than keeping a second set of
// patterns. A cause added there is named here without touching this file. Only
// the runtime-specific kinds live here, and they are checked first.

import { classifyStartupFailure } from './startupFailure.ts'

export type ErrorKind =
  | 'session-would-not-start'
  | 'supabase-cli-missing'
  | 'stack-start-timed-out'
  | 'stack-would-not-start'
  | 'stack-up-but-silent'
  | 'repository-not-found'
  | 'schema-missing'
  | 'database-unreachable'

export interface OperatorMessage {
  /** A cause we can name in our own words, or null when we cannot. */
  kind: ErrorKind | null
  /**
   * The machine's own words, cleaned of transport wrapping — never empty, and
   * never hidden behind our sentence. A named cause without its evidence is
   * undiagnosable the first time the cause is named wrongly, which is the rule
   * the startup dialog follows for the same reason.
   */
  detail: string
}

/** Long enough to diagnose, short enough not to become the screen. */
const MAX_DETAIL = 500

function textOf(e: unknown): string {
  if (e === null || e === undefined) return ''
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

/** Removes what the transport added, leaving what actually went wrong. */
export function unwrap(raw: string): string {
  let text = raw.trim()
  // Electron wraps every rejected `ipcMain.handle` like this, and the inner
  // text is the only part that describes the failure.
  text = text.replace(/^Error:\s*Error invoking remote method '[^']*':\s*/i, '')
  text = text.replace(/^Error invoking remote method '[^']*':\s*/i, '')
  // Then any number of `Error:` / `TypeError:` prefixes the layers stacked up.
  let previous: string
  do {
    previous = text
    text = text.replace(/^(?:[A-Za-z]*Error):\s*/, '').trim()
  } while (text !== previous)
  return text
}

export function humaniseError(e: unknown): OperatorMessage {
  const cleaned = unwrap(textOf(e))
  const detail =
    cleaned.length === 0
      ? 'The failure carried no description.'
      : cleaned.length > MAX_DETAIL
        ? cleaned.slice(0, MAX_DETAIL - 1) + '…'
        : cleaned

  // Runtime-specific first: `SpawnFailure` composes its own sentence naming the
  // program and the directory, and that is more useful than anything the
  // startup classifier would say about the ENOENT inside it.
  if (/ could not start in /.test(detail)) return { kind: 'session-would-not-start', detail }

  const cause = classifyStartupFailure({ message: detail }).cause
  // Both code-only causes are unreachable from a message alone; they are never an operator kind.
  return { kind: cause === 'unknown' || cause === 'schema-not-ready' || cause === 'active-estate-unreadable' ? null : cause, detail }
}
