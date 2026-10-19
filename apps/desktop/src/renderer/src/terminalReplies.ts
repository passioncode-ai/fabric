// What a terminal sends to the program by itself, as opposed to what a person types (2026-10-19).
//
// Re-mounting a console replays the session's saved output into a fresh xterm. That output still carries the queries
// the program made when it started (device attributes, cursor position, mode reports, colours), and xterm answers them
// again, into the live program. Claude Code read the ESC of such an answer as «Esc to cancel» on its trust prompt and
// ended with exit 1. While a replay is parsed, these answers are dropped; a person's keys always pass.

// One answer: DA1/DA2/DA3 (`CSI ? … c`, `CSI > … c`, `CSI = … c`), focus in/out (`CSI I`, `CSI O`), cursor position
// (`CSI row;col R`), a mode report (`CSI ? …$y`), and an OSC or DCS reply ending in BEL or ST.
const ONE = String.raw`\x1b\[[?>=][\d;]*c|\x1b\[[IO]|\x1b\[\d+;\d+R|\x1b\[\??[\d;]+\$y|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1bP[^\x1b]*\x1b\\`
const REPLIES = new RegExp(`^(?:${ONE})+$`)

export function isTerminalReply(data: string): boolean {
  return REPLIES.test(data)
}

/** Forwards input, except the terminal's own replies until the replay has been parsed. */
export class ReplayGate {
  private replaying = true
  constructor(private readonly send: (data: string) => void) {}
  input(data: string): void {
    if (this.replaying && isTerminalReply(data)) return
    this.send(data)
  }
  replayed(): void {
    this.replaying = false
  }
}
