// #region claude-transcript — docs: docs/ux/scenarios.md#scn-183-the-ceo-manages-the-sessions-of-this-computer
/**
 * Whether a Claude Code session took a turn from the person (2026-11-20, the first task lost at the start of 0daa75f1
 * and e150fe59): its own transcript (`<home>/projects/<folder>/<session id>.jsonl`, the folder every character but a
 * letter or a digit made `-`) holds a `"type":"user"` line once a typed message became a turn. True, false when the file
 * was read and holds none, null when no transcript could be read (another home, not written yet): an unknown is never
 * taken for «not delivered».
 */
import { open } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

/** At most this much of a young transcript is read: the first turn is near its start. */
const READ_BYTES = 2 * 1024 * 1024

export function claudeTranscriptPaths(cwd: string, runnerSessionId: string, env: Record<string, string | undefined> = process.env, home = homedir()): string[] {
  const slug = cwd.replace(/[^A-Za-z0-9]/g, '-')
  const homes = [env.CLAUDE_CONFIG_DIR, path.join(home, '.claude')].filter((h): h is string => Boolean(h))
  return [...new Set(homes)].map((h) => path.join(h, 'projects', slug, `${runnerSessionId}.jsonl`))
}

/** Whether a transcript's first part shows Claude Code took a person's message: a line of `queue-operation` that took a
 *  message in (`enqueue`, `dequeue`), or a `user` line that is the person's own (0.3.27 review, run four, ER-44, ER-45,
 *  DA-36, UX-47): not a meta line Claude Code writes itself (`isMeta`: another session's message, a command caveat) and
 *  not only tool results. A line that does not parse (the read's cut end) is skipped. */
export function hasPersonTurn(text: string): boolean {
  for (const raw of text.split('\n')) {
    if (!raw.includes('"type"')) continue
    let line: { type?: unknown; operation?: unknown; isMeta?: unknown; message?: { content?: unknown } }
    try { line = JSON.parse(raw) } catch { /* the 2 MB read's cut last line, or not JSON: not a turn */ continue }
    if (line.type === 'queue-operation' && (line.operation === 'enqueue' || line.operation === 'dequeue')) return true
    if (line.type !== 'user' || line.isMeta === true) continue
    const content = line.message?.content
    if (Array.isArray(content) && content.length > 0 && content.every((c) => (c as { type?: unknown })?.type === 'tool_result')) continue
    return true
  }
  return false
}

export async function claudeTurnTaken(cwd: string, runnerSessionId: string, files = claudeTranscriptPaths(cwd, runnerSessionId)): Promise<boolean | null> {
  for (const file of files) {
    let fh
    try {
      fh = await open(file, 'r')
      const buf = Buffer.alloc(READ_BYTES)
      const { bytesRead } = await fh.read(buf, 0, READ_BYTES, 0)
      return hasPersonTurn(buf.subarray(0, bytesRead).toString('utf8'))
    } catch {
      // Not in this home: the next one is tried; none read is an unknown.
    } finally {
      await fh?.close().catch(() => undefined)
    }
  }
  return null
}
// #endregion claude-transcript
