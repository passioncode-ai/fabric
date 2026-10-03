// #region runner-label — docs: CONTEXT.md#coding-agent
// What a coding agent (a runner: Claude Code, Codex, the login shell) or a created agent is CALLED on
// screen — one rule for every select, row and header (release review iteration 2: five call sites
// called Codex "Terminal", and a created agent's row showed the raw id `CLAUDE-CODE`). The names come
// from the runner registry (`shared/agents.ts`), so a new runner is named everywhere at once.
import { AGENTS } from '../../shared/agents.ts'
import type { Translate } from './i18n'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `id` is a runner id or a created agent's uuid (a launch option is either). `names` maps created agents'
 * ids to their names when the caller has them; without it a created agent is called that, never a uuid.
 */
export function runnerLabel(id: string | null | undefined, t: Translate, names?: Readonly<Record<string, string>>): string {
  if (!id) return t('agents.unknownRunner')
  if (id === 'claude-code') return t('agents.claudeCode')
  if (id === 'shell') return t('agents.terminal')
  const runner = AGENTS.find((a) => a.id === id)
  if (runner) return runner.label
  if (names?.[id]) return names[id]
  return UUID.test(id) ? t('agents.createdAgent') : id
}
// #endregion runner-label
