// Decoding a PTY stream the way a terminal shows it.
//
// Pure, and therefore here rather than in `main/`: the transcript store decodes
// on the way to disk, and the estate agents screen decodes to put a session's
// recent output on screen. Two callers on opposite sides of the IPC boundary,
// one function — the alternative is a second decoder that renders the same
// bytes slightly differently, which is how one surface starts disagreeing with
// another about what an agent printed.

const CONTROL = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[@-Z\\-_]/g
// eslint-disable-next-line no-control-regex
const REMAINING_CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

/**
 * Decode one PTY stream the way a terminal displays it: drop the control
 * sequences, and on a line rewritten with carriage returns keep what was left
 * standing. Deterministic and lossless with respect to what a person saw.
 */
export function decodePty(raw: string): string {
  const withoutControl = raw.replace(CONTROL, '').replace(/\r\n/g, '\n')
  return withoutControl
    .split('\n')
    .map((line) => {
      if (!line.includes('\r')) return line.replace(REMAINING_CONTROL, '')
      // A progress bar repaints one line many times; only the last paint was ever
      // visible when the line finished.
      const segments = line.split('\r')
      return (segments[segments.length - 1] ?? '').replace(REMAINING_CONTROL, '')
    })
    .join('\n')
}
