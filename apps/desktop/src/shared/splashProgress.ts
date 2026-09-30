// What the splash says while the local stack starts (M101).
//
// It had one sentence and, until this change, NOBODY EVER SAW IT. `startStack()`
// was `execFileSync` with a 240-second timeout called immediately after the
// window was created, and Electron's main thread is the browser process message
// loop. Measured with the page reporting its OWN clock: against a six-second
// block starting at +285ms, the page's script ran at +6387ms — 59ms after the
// block ended. The renderer did not execute the page at any point during the
// wait, so the text was not late, it was absent.
//
// With the start moved off the main thread the window paints, and then the
// question becomes what it should say. Four minutes of one static sentence is
// how a person decides an app has hung and force-quits a process that was
// working — so this shows the elapsed time once a wait is long enough to be
// doubted, says plainly that a first run is expected to be slow, and passes
// through the stack's own last line, which is usually the most informative
// thing on the machine.

export interface SplashState {
  elapsedMs: number
  /** The last line the stack printed, or null when it has printed nothing. */
  lastLine: string | null
}

/** Below this a wait is ordinary; above it, silence starts to read as a hang. */
export const DOUBT_MS = 5_000
/** Past this the wait needs explaining, not just counting. */
export const PATIENCE_MS = 30_000

const MAX_LINE = 90

export function splashProgress(state: SplashState): string {
  const parts = ['Starting the local stack']
  if (state.elapsedMs >= DOUBT_MS) parts.push(`${Math.floor(state.elapsedMs / 1000)}s`)

  let text = parts.join(' · ')
  if (state.elapsedMs >= PATIENCE_MS) text += ' — a first run downloads images and is expected to be slow'

  const line = (state.lastLine ?? '').trim()
  if (line) {
    // Stripped, not escaped. The main process writes this into a page, and a
    // stack that printed a tag could otherwise put markup on the screen — a
    // small hole, but one nobody would think to look for in a splash.
    const safe = line.replace(/[<>&"']/g, ' ').replace(/\s+/g, ' ').trim()
    if (safe) text += ` — ${safe.length > MAX_LINE ? safe.slice(0, MAX_LINE - 1) + '…' : safe}`
  }
  return text
}
