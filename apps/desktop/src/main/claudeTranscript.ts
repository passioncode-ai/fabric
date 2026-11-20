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

export function hasPersonTurn(text: string): boolean {
  return /"type"\s*:\s*"user"/.test(text)
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
