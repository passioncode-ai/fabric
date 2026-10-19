// #region console-catalog — docs: docs/adr/0168-every-catalogue-agent-starts-as-a-console-and-fewer-prompts-is-the-machine-default.md#decision
/**
 * Every coding agent of the catalogue as a console Fabric can start in a project's folder (OF-11, ADR-0168).
 *
 * The ids are Switchboard's (its `switchboard --json agents status`, schema 1), so the agent Settings lists and the
 * agent a console runs are the same row. The program and the argument that skips the agent's own permission prompts
 * are Orca's, read from its settings on 2026-10-19 (the operator's paste; Orca is the reference the operator named).
 * A model choice Switchboard adds to its own command (`-m openrouter/...`) is Switchboard's and is not copied.
 *
 * These agents are consoles, not executors: Fabric does not hand them its surface (`connectsToSurface: false`), so
 * an agent that should speak to the board registers `fabric-mcp --runner <id>` itself (ADR-0134). This table is
 * Fabric's copy until the contract publishes the catalogue as a data file (CT-60); then it is read from there.
 *
 * Left out on purpose: `zed` (an editor) and `warp` (a terminal application). Starting either opens an application
 * window, not an agent in a terminal.
 */
import type { AgentDescriptor, PermissionMode } from './agents.ts'

export interface ConsoleEntry {
  /** Switchboard's catalogue id. */
  id: string
  label: string
  program: string
  /** How the agent runs with fewer prompts; absent when it has no such switch. */
  bypass?: { args?: readonly string[]; env?: Readonly<Record<string, string>> }
  /** What its manual mode sets, when asking is something the mode must set rather than inherit. */
  ask?: { env?: Readonly<Record<string, string>> }
  /**
   * True when the agent asks before a tool by default, measured or documented by its maker. Unknown is false, and
   * then its manual mode is declared as having nothing in the way (FA-09: a gate Fabric cannot name is no gate).
   */
  asksByDefault: boolean
}

export const CONSOLE_CATALOG: readonly ConsoleEntry[] = [
  { id: 'opencode', label: 'OpenCode', program: 'opencode', asksByDefault: false },
  { id: 'gemini-cli', label: 'Gemini CLI', program: 'gemini', bypass: { args: ['--yolo'] }, asksByDefault: true },
  { id: 'goose', label: 'Goose', program: 'goose', bypass: { env: { GOOSE_MODE: 'auto' } }, ask: { env: { GOOSE_MODE: 'approve' } }, asksByDefault: true },
  { id: 'cursor-cli', label: 'Cursor CLI', program: 'cursor-agent', bypass: { args: ['--yolo'] }, asksByDefault: true },
  { id: 'pi', label: 'Pi', program: 'pi', asksByDefault: false },
  { id: 'openclaw', label: 'OpenClaw', program: 'openclaw', asksByDefault: false },
  { id: 'aider', label: 'Aider', program: 'aider', bypass: { args: ['--yes-always'] }, asksByDefault: true },
  { id: 'amp', label: 'Amp', program: 'amp', bypass: { args: ['--dangerously-allow-all'] }, asksByDefault: true },
  { id: 'crush', label: 'Crush', program: 'crush', bypass: { args: ['--yolo'] }, asksByDefault: true },
  { id: 'qwen-code', label: 'Qwen Code', program: 'qwen', bypass: { args: ['--approval-mode', 'yolo'] }, asksByDefault: true },
  { id: 'copilot-cli', label: 'GitHub Copilot CLI', program: 'copilot', bypass: { args: ['--yolo'] }, asksByDefault: true },
  { id: 'factory-droid', label: 'Factory Droid', program: 'droid', bypass: { args: ['--auto', 'high'] }, asksByDefault: true },
  { id: 'kiro-cli', label: 'Kiro CLI', program: 'kiro-cli', bypass: { args: ['--trust-all-tools'] }, asksByDefault: true },
  { id: 'devin', label: 'Devin CLI', program: 'devin', bypass: { args: ['--permission-mode', 'bypass', '--respect-workspace-trust', 'false'] }, asksByDefault: true },
  { id: 'continue', label: 'Continue (cn)', program: 'cn', bypass: { args: ['--allow', '*'] }, asksByDefault: true },
  { id: 'command-code', label: 'Command Code', program: 'command-code', bypass: { args: ['--yolo'] }, asksByDefault: true },
  { id: 'auggie', label: 'Auggie CLI', program: 'auggie', asksByDefault: false },
  { id: 'freebuff', label: 'Freebuff', program: 'freebuff', asksByDefault: false },
  { id: 'omp', label: 'omp (oh-my-pi)', program: 'omp', asksByDefault: false },
  { id: 'zcode', label: 'ZCode', program: 'zcode', asksByDefault: false },
  { id: 'deepseek-harness', label: 'DeepSeek Harness', program: 'dsh-tui', asksByDefault: false },
  { id: 'openhands', label: 'OpenHands CLI', program: 'openhands', asksByDefault: false }
]

function modesOf(entry: ConsoleEntry): PermissionMode[] {
  const ask: PermissionMode = {
    id: 'ask',
    labelKey: 'agent.mode.ask',
    args: [],
    containment: entry.asksByDefault ? 'runner-gated' : 'none',
    ...(entry.ask?.env ? { env: entry.ask.env } : {})
  }
  if (!entry.bypass) return [ask]
  return [
    ask,
    {
      id: 'bypass',
      labelKey: 'agent.mode.bypass',
      args: entry.bypass.args ?? [],
      containment: 'none',
      warnKey: 'agent.mode.bypassWarn',
      ...(entry.bypass.env ? { env: entry.bypass.env } : {})
    }
  ]
}

/** The catalogue as runners, leaving out every id a core descriptor already owns. */
export function consoleDescriptors(coreIds: ReadonlySet<string> = CORE_IDS): AgentDescriptor[] {
  return CONSOLE_CATALOG.filter((e) => !coreIds.has(e.id)).map((entry) => ({
    id: entry.id,
    label: entry.label,
    program: entry.program,
    description: 'A console in the project directory; the agent reaches Fabric through its own fabric-mcp',
    connectsToSurface: false,
    surfaceAdapter: 'none',
    resultChannel: 'none',
    permissionModes: modesOf(entry),
    defaultMode: 'ask'
  }))
}

/** The runners `agents.ts` describes itself; kept here so this module needs no value from it. */
export const CORE_IDS: ReadonlySet<string> = new Set(['claude-code', 'codex', 'kilo', 'hermes', 'cline', 'kimi-code', 'shell'])
// #endregion console-catalog
