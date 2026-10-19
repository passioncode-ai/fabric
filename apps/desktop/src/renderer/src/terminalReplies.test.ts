import { describe, expect, it } from 'vitest'
import { isTerminalReply, ReplayGate } from './terminalReplies'

// 2026-10-19, the operator's screenshot: a Claude Code session in Fabric's console printed `^[[I^[[?1;2c` and ended
// with exit 1 at its trust prompt. Re-mounting the console replays the session's saved output into xterm, xterm answers
// the queries in it again (device attributes, focus reporting), and those answers went into the live process: their
// ESC is the prompt's «Esc to cancel».
describe('isTerminalReply', () => {
  it('knows the answers a terminal sends by itself', () => {
    for (const reply of ['\x1b[?1;2c', '\x1b[>0;276;0c', '\x1b[I', '\x1b[O', '\x1b[12;40R', '\x1b[?2004;1$y', '\x1b]11;rgb:1e1e/1e1e/1e1e\x1b\\', '\x1b[I\x1b[?1;2c'])
      expect(isTerminalReply(reply), JSON.stringify(reply)).toBe(true)
  })
  it('never takes a person\'s keys for one', () => {
    for (const key of ['y', '\r', '\x1b', '\x1b[A', '\x1b[B', '\x1b[3~', '\x03', 'hello', '\x1b[200~paste\x1b[201~'])
      expect(isTerminalReply(key), JSON.stringify(key)).toBe(false)
  })
})

describe('ReplayGate', () => {
  it('drops the terminal\'s own replies while the replay is parsed, and lets them through after', () => {
    const sent: string[] = []
    const gate = new ReplayGate((d) => sent.push(d))
    gate.input('\x1b[?1;2c')
    gate.input('\r')
    gate.replayed()
    gate.input('\x1b[I')
    expect(sent).toEqual(['\r', '\x1b[I'])
  })
})
