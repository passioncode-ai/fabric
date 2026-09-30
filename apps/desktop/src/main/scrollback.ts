/**
 * The live view of one session's output: bounded in memory, and cheap per chunk.
 *
 * FA-08. The shape this replaces did the same two things on EVERY chunk a PTY
 * emitted — concatenated the whole buffer and re-sliced it to the cap, then read
 * the entire capped buffer to learn its LAST line: a regular expression over
 * 400 000 characters and three intermediate arrays, to produce 120 characters
 * that had not changed for most of them. An agent emits output in small chunks
 * at high frequency, so that cost was paid per chunk, per session, on the main
 * process's only thread.
 *
 * Two properties make it cheap without changing what anyone sees:
 *
 * - **Chunks are never cut.** The buffer is the chunks the terminal delivered,
 *   with whole chunks dropped from the front. The previous shape cut at an
 *   arbitrary character, which could split a UTF-16 surrogate pair or an escape
 *   sequence in half; dropping at a delivery boundary cannot make a pair worse
 *   than the terminal itself sent it.
 * - **The tail is read from the tail.** The last non-empty line is found by
 *   walking backwards in windows, so the common case touches a few kilobytes.
 *   The window GROWS rather than giving up, because a bounded scan that stops
 *   early would answer "no line" for a buffer that has one, and a tile showing
 *   nothing is a claim that nothing was said.
 */

/** Characters kept per session for reattach. */
export const SCROLLBACK_CAP = 400_000

/** How far back the tail scan looks before widening. One redraw's worth. */
const TAIL_WINDOW = 8_192

/** How much of the last line a caller is shown. */
const TAIL_CHARS = 120

const ESC = String.fromCharCode(27)
/** Colour and cursor sequences, so a tile shows words rather than escape codes. */
const ANSI = new RegExp(ESC + '\\[[0-9;?]*[a-zA-Z]', 'g')

export interface BoundedScrollback {
  /** Add what the terminal just delivered. */
  push(chunk: string): void
  /** Everything retained, oldest first — what a reattaching view replays. */
  text(): string
  /** The last non-empty line, ANSI stripped and trimmed, capped for display. */
  tailLine(): string
  /** Characters currently retained. Bounded by the cap plus one chunk. */
  size(): number
}

export function createBoundedScrollback(cap: number = SCROLLBACK_CAP): BoundedScrollback {
  const chunks: string[] = []
  let total = 0
  // The joined form is what a reattach needs and nothing else does, so it is
  // built when asked and dropped when the buffer moves. Rebuilding it per chunk
  // is the cost this module exists to remove.
  let joined: string | null = null
  let tail = ''
  let tailFresh = false

  const drop = (): void => {
    while (total > cap && chunks.length > 1) {
      total -= chunks[0].length
      chunks.shift()
    }
    // A single chunk larger than the whole cap is a screen dump, not a line;
    // cutting it is the one place a boundary is invented, and 400 000
    // characters back from the end is far past any escape sequence.
    if (total > cap && chunks.length === 1) {
      chunks[0] = chunks[0].slice(-cap)
      total = chunks[0].length
    }
  }

  return {
    push(chunk: string): void {
      if (!chunk) return
      chunks.push(chunk)
      total += chunk.length
      drop()
      joined = null
      tailFresh = false
    },

    text(): string {
      if (joined === null) joined = chunks.join('')
      return joined
    },

    tailLine(): string {
      // Read lazily: a session producing output nobody is looking at should not
      // pay to keep a string current for a tile that is not on screen.
      if (tailFresh) return tail
      tailFresh = true
      let window = TAIL_WINDOW
      for (;;) {
        // Walk back over whole chunks until the window is covered, so the slice
        // is built from the end rather than from a join of everything.
        const parts: string[] = []
        let have = 0
        for (let i = chunks.length - 1; i >= 0 && have < window; i--) {
          parts.push(chunks[i])
          have += chunks[i].length
        }
        parts.reverse()
        const region = parts.join('')
        const lines = region
          .replace(ANSI, '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
        // The FIRST line of a window may be a fragment of a longer one, so it is
        // only trusted when the window reached the start of the buffer.
        const whole = have >= total
        const usable = whole ? lines : lines.slice(1)
        if (usable.length) {
          tail = usable[usable.length - 1].slice(0, TAIL_CHARS)
          return tail
        }
        if (whole) {
          // Nothing but blanks and escape codes has ever been written. Keeping
          // the previous line would be a claim about output that is not there.
          tail = ''
          return tail
        }
        window *= 4
      }
    },

    size(): number {
      return total
    }
  }
}
