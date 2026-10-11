// #region fabric-mcp-registration — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#4-connected-is-a-probe-result-not-a-flag
// How each coding agent of the catalogue (shared/agents.ts) registers `fabric-mcp` (ADR-0134 §1, amendment 2), where
// it keeps that registration, and how Fabric reads it back (REQ-03 of 0.4.0). Pure: no Node import, so the renderer
// shows the same command the probe compares against, and the readers are tested on text alone.
//
// «CONNECTED» IS A PROBE RESULT (ADR-0119 §4). A runner is connected in a terminal only when its own config holds a
// `fabric` server whose command is THIS Fabric's `bin/fabric-mcp` with `--runner <its id>`, the entry is enabled, and
// that registered command answered MCP `initialize` as `fabric` and listed `fabric_whoami` (main/fabricMcpProbe.ts).
// A catalogue row claims nothing by being here.
//
// EVERY ROW WAS MEASURED, not read from documentation, on 2026-10-11 on the operator's Mac, each CLI writing into a
// throwaway home so the person's own config was never touched: the command below, then the file it wrote.
//   Claude Code 2.1.296  CLAUDE_CONFIG_DIR=<tmp> claude mcp add --scope user fabric -- <bin> --runner claude-code
//                        → <tmp>/.claude.json  mcpServers.fabric = {type: "stdio", command, args}
//   Codex 0.162.1        CODEX_HOME=<tmp> codex mcp add fabric -- <bin> --runner codex
//                        → <tmp>/config.toml   [mcp_servers.fabric] command = "…" / args = ["--runner", "codex"]
//   Kilo 7.4.17          KILO_CONFIG_DIR=<tmp>/kilo kilo mcp add fabric -- <bin> --runner kilo
//                        → <tmp>/kilo/kilo.json  mcp.fabric = {type: "local", command: [<bin>, "--runner", "kilo"]}
//   Hermes 0.21.4        HERMES_HOME=<tmp> hermes mcp add fabric --command <bin> --args --runner hermes
//                        → <tmp>/config.yaml   mcp_servers: / fabric: / command / args (a block list) / enabled
//                        (Hermes connects first; when that fails it asks, and saves the entry `enabled: false`)
//   Kimi Code 2.1.1      has no `mcp` command (`kimi --help`); its servers live in ~/.kimi-code/mcp.json as
//                        mcpServers.<name> = {command, args} — the shape of the entries already in that file here
//   Cline                not installed on this Mac (its package vanished twice after a run, report
//                        docs/reports/2026-10-05-openrouter-agent-support/raw/probes/README.txt): no measurement,
//                        so no file is guessed and the row says so.
//
// THE READERS ARE NOT GENERAL PARSERS, and say so: each reads exactly the `fabric` entry of the one dialect its runner
// writes, and nothing else. A config file holds other servers' keys and headers; nothing here returns, logs or names
// a value it read except the fabric entry's command and arguments. A file that cannot be read is a CODE
// (`not-json`, `too-large`, …) and never the parser's message: V8's JSON.parse quotes the text around the error, and
// that text can be a secret (a header two lines from a typo).

/** The id of the server entry every coding agent registers Fabric under. */
export const FABRIC_SERVER = 'fabric'

export type ConfigDialect = 'claude-json' | 'codex-toml' | 'kilo-json' | 'hermes-yaml' | 'kimi-json'

/** One place a runner reads its user-scope MCP servers from. `~` is the home folder; `dirEnv`, when set in the
 *  environment, replaces `dir` (the runner's own override, measured above). Files are read in order, the first
 *  holding a fabric entry wins. */
export interface ConfigLocation {
  dir: string
  dirEnv?: string
  files: readonly string[]
}

export type Registration =
  | {
      supported: true
      dialect: ConfigDialect
      locations: readonly ConfigLocation[]
      /** How the person registers fabric-mcp: a command to run, or a fragment to add to a file. */
      how: { kind: 'command'; argv: (launcher: string) => readonly string[] } | { kind: 'file-entry'; file: string; fragment: (launcher: string) => string }
      /** What was measured, and when: the evidence for this row. */
      measured: string
    }
  | { supported: false; reason: string }

const args = (runner: string): string[] => ['--runner', runner]

/** One row per catalogued runner that has a program (shared/agents.ts). A runner without a row is a defect the
 *  catalogue test refuses (`fabricMcpRegistration.test.ts`). */
export const REGISTRATIONS: Readonly<Record<string, Registration>> = {
  'claude-code': {
    supported: true,
    dialect: 'claude-json',
    locations: [{ dir: '~', dirEnv: 'CLAUDE_CONFIG_DIR', files: ['.claude.json'] }],
    how: { kind: 'command', argv: (bin) => ['claude', 'mcp', 'add', '--scope', 'user', FABRIC_SERVER, '--', bin, ...args('claude-code')] },
    measured: 'Claude Code 2.1.296, 2026-10-11'
  },
  codex: {
    supported: true,
    dialect: 'codex-toml',
    locations: [{ dir: '~/.codex', dirEnv: 'CODEX_HOME', files: ['config.toml'] }],
    how: { kind: 'command', argv: (bin) => ['codex', 'mcp', 'add', FABRIC_SERVER, '--', bin, ...args('codex')] },
    measured: 'Codex 0.162.1, 2026-10-11'
  },
  kilo: {
    supported: true,
    dialect: 'kilo-json',
    // KILO_CONFIG_DIR measured; without it Kilo reads ~/.config/kilo, where this Mac keeps its kilo.jsonc.
    locations: [{ dir: '~/.config/kilo', dirEnv: 'KILO_CONFIG_DIR', files: ['kilo.json', 'kilo.jsonc'] }],
    how: { kind: 'command', argv: (bin) => ['kilo', 'mcp', 'add', FABRIC_SERVER, '--', bin, ...args('kilo')] },
    measured: 'Kilo 7.4.17, 2026-10-11'
  },
  hermes: {
    supported: true,
    dialect: 'hermes-yaml',
    locations: [{ dir: '~/.hermes', dirEnv: 'HERMES_HOME', files: ['config.yaml'] }],
    how: { kind: 'command', argv: (bin) => ['hermes', 'mcp', 'add', FABRIC_SERVER, '--command', bin, '--args', ...args('hermes')] },
    measured: 'Hermes Agent 0.21.4, 2026-10-11'
  },
  'kimi-code': {
    supported: true,
    dialect: 'kimi-json',
    locations: [{ dir: '~/.kimi-code', files: ['mcp.json'] }],
    how: {
      kind: 'file-entry',
      file: '~/.kimi-code/mcp.json',
      fragment: (bin) => JSON.stringify({ mcpServers: { [FABRIC_SERVER]: { command: bin, args: args('kimi-code') } } }, null, 2)
    },
    measured: 'Kimi Code 2.1.1, 2026-10-11 (no mcp command; the file shape of its existing entries)'
  },
  cline: {
    supported: false,
    reason: 'Cline is not installed on this Mac and how its CLI registers a stdio MCP server has not been measured, so Fabric reads no file for it'
  }
}

/** The registration row of a runner, or an explicit refusal for one the table does not know. */
export function registrationOf(runner: string): Registration {
  return Object.prototype.hasOwnProperty.call(REGISTRATIONS, runner)
    ? REGISTRATIONS[runner]
    : { supported: false, reason: `${runner} has no fabric-mcp registration row` }
}

/** A shell line for the person to copy: each argument quoted when it needs to be (POSIX single quotes). */
export function shellLine(argv: readonly string[]): string {
  return argv.map((a) => (/^[A-Za-z0-9_./:=@%+-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' ')
}

// ── the readers ─────────────────────────────────────────────────────────────────────────────────────────────

/** What a config file says about Fabric's entry. `command` null: the entry exists and names no program. */
export type FabricEntry =
  | { found: false }
  | { found: true; command: string | null; args: string[]; enabled: boolean }

export type ReadProblem = 'not-json' | 'not-toml' | 'not-yaml' | 'not-an-object'

export type EntryRead = { ok: true; entry: FabricEntry } | { ok: false; problem: ReadProblem }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const own = (o: Record<string, unknown>, k: string): unknown => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    // Never the message: it quotes the file around the error (see the head of this file).
    return { ok: false }
  }
}

/** One pass over JSON-like text that copies strings exactly and hands everything outside them to `outside`. */
function outsideStrings(text: string, outside: (text: string, i: number) => { emit: string; next: number } | null): string {
  let out = ''
  let i = 0
  let inString = false
  while (i < text.length) {
    const c = text[i]
    if (inString) {
      out += c
      if (c === '\\' && i + 1 < text.length) { out += text[i + 1]; i += 2; continue }
      if (c === '"') inString = false
      i++
      continue
    }
    if (c === '"') { inString = true; out += c; i++; continue }
    const step = outside(text, i)
    if (step) { out += step.emit; i = step.next; continue }
    out += c
    i++
  }
  return out
}

/** JSONC → JSON: comments, then trailing commas, removed outside strings; strings are left exactly as they are. */
export function stripJsonc(text: string): string {
  const noComments = outsideStrings(text, (t, i) => {
    if (t[i] === '/' && t[i + 1] === '/') { let j = i; while (j < t.length && t[j] !== '\n') j++; return { emit: '', next: j } }
    if (t[i] === '/' && t[i + 1] === '*') { const end = t.indexOf('*/', i + 2); return { emit: '', next: end < 0 ? t.length : end + 2 } }
    return null
  })
  return outsideStrings(noComments, (t, i) => {
    if (t[i] !== ',') return null
    let j = i + 1
    while (j < t.length && /\s/.test(t[j])) j++
    return t[j] === '}' || t[j] === ']' ? { emit: '', next: i + 1 } : null
  })
}

function jsonEntry(text: string, dialect: 'claude-json' | 'kimi-json' | 'kilo-json'): EntryRead {
  const parsed = parseJson(dialect === 'kilo-json' ? stripJsonc(text) : text)
  if (!parsed.ok) return { ok: false, problem: 'not-json' }
  if (!isObj(parsed.value)) return { ok: false, problem: 'not-an-object' }
  if (dialect === 'kilo-json') {
    const mcp = own(parsed.value, 'mcp')
    const e = isObj(mcp) ? own(mcp, FABRIC_SERVER) : undefined
    if (!isObj(e)) return { ok: true, entry: { found: false } }
    // Kilo's local server is ONE array: the program and its arguments.
    const command = strings(own(e, 'command'))
    return { ok: true, entry: { found: true, command: command[0] ?? null, args: command.slice(1), enabled: own(e, 'enabled') !== false } }
  }
  const servers = own(parsed.value, 'mcpServers')
  const e = isObj(servers) ? own(servers, FABRIC_SERVER) : undefined
  if (!isObj(e)) return { ok: true, entry: { found: false } }
  const command = own(e, 'command')
  return {
    ok: true,
    entry: { found: true, command: typeof command === 'string' ? command : null, args: strings(own(e, 'args')), enabled: own(e, 'disabled') !== true }
  }
}

/** A TOML basic ("…") or literal ('…') string at the start of `s`; null when there is none. */
function tomlString(s: string): { value: string; rest: string } | null {
  const t = s.trimStart()
  if (t.startsWith("'")) {
    const end = t.indexOf("'", 1)
    return end < 0 ? null : { value: t.slice(1, end), rest: t.slice(end + 1) }
  }
  if (!t.startsWith('"')) return null
  let v = ''
  for (let i = 1; i < t.length; i++) {
    const c = t[i]
    if (c === '"') return { value: v, rest: t.slice(i + 1) }
    if (c === '\\') {
      const n = t[++i]
      const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', b: '\b', f: '\f' }
      if (n === 'u' || n === 'U') {
        const len = n === 'u' ? 4 : 8
        const hex = t.slice(i + 1, i + 1 + len)
        if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== len) return null
        v += String.fromCodePoint(Number.parseInt(hex, 16))
        i += len
      } else if (n !== undefined && n in map) v += map[n]
      else return null
    } else v += c
  }
  return null
}

/** The table a TOML header line names, as its dotted segments with quotes removed; null when the line is none. */
function tomlHeader(line: string): string[] | null {
  const m = /^\s*\[(?!\[)(.*)\]\s*(#.*)?$/.exec(line)
  if (!m) return null
  const parts: string[] = []
  let rest = m[1].trim()
  while (rest.length) {
    if (rest.startsWith('"') || rest.startsWith("'")) {
      const s = tomlString(rest)
      if (!s) return null
      parts.push(s.value)
      rest = s.rest.trim()
    } else {
      const bare = /^[A-Za-z0-9_-]+/.exec(rest)
      if (!bare) return null
      parts.push(bare[0])
      rest = rest.slice(bare[0].length).trim()
    }
    if (rest.startsWith('.')) rest = rest.slice(1).trim()
    else if (rest.length) return null
  }
  return parts
}

/**
 * Codex's `[mcp_servers.fabric]` table, as `codex mcp add` writes it: `command = "…"`, `args = [ … ]` (one line or
 * several), `enabled = false` when switched off. Bare or quoted keys and header segments (`["mcp_servers"."fabric"]`,
 * the spelling this Mac's config uses for its other servers). An inline-table spelling
 * (`mcp_servers.fabric = { … }`) is NOT read and reads as not registered: Codex does not write it.
 */
function codexEntry(text: string): EntryRead {
  const lines = text.split(/\r?\n/)
  let i = lines.findIndex((l) => {
    const h = tomlHeader(l)
    return h !== null && h.length === 2 && h[0] === 'mcp_servers' && h[1] === FABRIC_SERVER
  })
  if (i < 0) return { ok: true, entry: { found: false } }
  let command: string | null = null
  let argv: string[] = []
  let enabled = true
  for (i = i + 1; i < lines.length; i++) {
    const line = lines[i]
    if (tomlHeader(line) !== null) break
    const kv = /^\s*("?)([A-Za-z0-9_-]+)\1\s*=\s*(.*)$/.exec(line)
    if (!kv) continue
    const [, , key, value] = kv
    if (key === 'command') {
      const s = tomlString(value)
      if (!s) return { ok: false, problem: 'not-toml' }
      command = s.value
    } else if (key === 'enabled') enabled = !/^false\b/.test(value.trim())
    else if (key === 'args') {
      // The array may run over several lines: gather until its closing bracket, outside strings.
      let src = value
      while (!closesArray(src) && i + 1 < lines.length) src += '\n' + lines[++i]
      const parsed = tomlArray(src)
      if (!parsed) return { ok: false, problem: 'not-toml' }
      argv = parsed
    }
  }
  return { ok: true, entry: { found: true, command, args: argv, enabled } }
}

function closesArray(src: string): boolean {
  let inS: string | null = null
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inS) {
      if (inS === '"' && c === '\\') { i++; continue }
      if (c === inS) inS = null
    } else if (c === '"' || c === "'") inS = c
    else if (c === ']') return true
  }
  return false
}

function tomlArray(src: string): string[] | null {
  let rest = src.trim()
  if (!rest.startsWith('[')) return null
  rest = rest.slice(1)
  const out: string[] = []
  for (;;) {
    rest = rest.replace(/^(\s|#[^\n]*)+/, '')
    if (rest.startsWith(']')) return out
    const s = tomlString(rest)
    if (!s) return null
    out.push(s.value)
    rest = s.rest.replace(/^(\s|#[^\n]*)+/, '')
    if (rest.startsWith(',')) rest = rest.slice(1)
    else if (!rest.startsWith(']')) return null
  }
}

/** A YAML scalar as Hermes writes one: plain, or single- or double-quoted. */
function yamlScalar(raw: string): string {
  const t = raw.replace(/\s+#.*$/, '').trim()
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    const parsed = parseJson(t)
    return parsed.ok && typeof parsed.value === 'string' ? parsed.value : t.slice(1, -1)
  }
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1).replace(/''/g, "'")
  return t
}

/**
 * Hermes's `mcp_servers:` → `fabric:` block, as `hermes mcp add` writes it (block style, two-space indent):
 * `command: <path>`, `args:` followed by `- item` lines (or a flow list `[a, b]`), `enabled: false`. Only that block
 * is read; anything else in the file — the gateway's keys, other servers' environments — is skipped unparsed.
 */
function hermesEntry(text: string): EntryRead {
  const lines = text.split(/\r?\n/)
  const top = lines.findIndex((l) => /^mcp_servers:\s*(#.*)?$/.test(l))
  if (top < 0) return { ok: true, entry: { found: false } }
  let i = top + 1
  let at = -1
  let indent = 0
  for (; i < lines.length; i++) {
    const l = lines[i]
    if (/^\S/.test(l)) break // back at column zero: the mcp_servers block ended
    const m = /^(\s+)(["']?)([A-Za-z0-9_.-]+)\2:\s*(#.*)?$/.exec(l)
    if (m && m[3] === FABRIC_SERVER) { at = i; indent = m[1].length; break }
  }
  if (at < 0) return { ok: true, entry: { found: false } }
  let command: string | null = null
  let argv: string[] = []
  let enabled = true
  for (i = at + 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim() || /^\s*#/.test(l)) continue
    const lead = /^(\s*)/.exec(l)![1].length
    if (lead <= indent) break // the next server, or the block ended
    const kv = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(l)
    if (!kv || lead !== indent + 2) continue
    const [, key, value] = kv
    if (key === 'command') command = yamlScalar(value) || null
    else if (key === 'enabled') enabled = !/^(false|no|off)$/i.test(yamlScalar(value))
    else if (key === 'args') {
      const v = value.replace(/\s+#.*$/, '').trim()
      if (v.startsWith('[')) {
        if (!v.endsWith(']')) return { ok: false, problem: 'not-yaml' }
        argv = v.slice(1, -1).split(',').map((x) => yamlScalar(x)).filter((x) => x.length > 0)
      } else {
        argv = []
        while (i + 1 < lines.length) {
          const item = /^(\s*)-\s+(.*)$/.exec(lines[i + 1])
          if (!item || item[1].length <= indent) break
          argv.push(yamlScalar(item[2]))
          i++
        }
      }
    }
  }
  return { ok: true, entry: { found: true, command, args: argv, enabled } }
}

/** Fabric's entry in a config file of `dialect`. */
export function readFabricEntry(dialect: ConfigDialect, text: string): EntryRead {
  switch (dialect) {
    case 'claude-json':
    case 'kimi-json':
    case 'kilo-json':
      return jsonEntry(text, dialect)
    case 'codex-toml':
      return codexEntry(text)
    case 'hermes-yaml':
      return hermesEntry(text)
  }
}

// ── the verdict ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What Fabric may say about a runner in a terminal. Only `connected` reads as connected anywhere in Fabric.
 *   not-registered   no fabric entry in any file the runner reads
 *   elsewhere        a fabric entry whose command is not this Fabric's bin/fabric-mcp (another install, an old path)
 *   wrong-runner     this Fabric's launcher, without `--runner <this runner>`
 *   disabled         the entry is switched off in the runner's config
 *   not-answering    the registered command did not answer MCP as Fabric within the bound
 *   unreadable       a config file is there and cannot be read (a code says why)
 *   no-launcher      this Fabric ships no bin/fabric-mcp (a development run), so nothing can point at it
 *   unsupported      no measured way to register (the row's reason)
 */
export type TerminalState =
  | 'connected' | 'not-registered' | 'elsewhere' | 'wrong-runner' | 'disabled' | 'not-answering' | 'unreadable' | 'no-launcher' | 'unsupported'

export interface TerminalProbe {
  runner: string
  state: TerminalState
  /** The file the verdict was read from, `~`-relative where it is under the home folder; null when none. */
  config: string | null
  /** What registers fabric-mcp for this runner, with this Fabric's launcher; null when unsupported or no launcher. */
  register: { kind: 'command'; line: string } | { kind: 'file-entry'; file: string; fragment: string } | null
  /** A code or a short fixed sentence for the log and the screen's detail; never a value read from a file. */
  detail: string | null
}

export function registerLine(reg: Registration, launcher: string | null): TerminalProbe['register'] {
  if (!reg.supported || !launcher) return null
  return reg.how.kind === 'command'
    ? { kind: 'command', line: shellLine(reg.how.argv(launcher)) }
    : { kind: 'file-entry', file: reg.how.file, fragment: reg.how.fragment(launcher) }
}

/** Whether `args` name this runner as `--runner <id>` (or `--runner=<id>`). */
export function namesRunner(argv: readonly string[], runner: string): boolean {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--runner' && argv[i + 1] === runner) return true
    if (argv[i] === `--runner=${runner}`) return true
  }
  return false
}

/**
 * The verdict before the answer check: whether the entry is one Fabric may test. `pointsAtLauncher` is decided by the
 * caller on real paths (symlinks resolved), null when this Fabric has no launcher. Returns `ready-to-answer` when the
 * registered command should now be asked to answer MCP.
 */
export function judgeEntry(input: { entry: FabricEntry; runner: string; pointsAtLauncher: boolean | null }):
  | { state: Exclude<TerminalState, 'connected' | 'not-answering' | 'unreadable' | 'unsupported'>; detail: string | null }
  | { state: 'ready-to-answer' } {
  const { entry } = input
  if (!entry.found) return { state: 'not-registered', detail: null }
  if (input.pointsAtLauncher === null) return { state: 'no-launcher', detail: 'this Fabric build ships no bin/fabric-mcp' }
  if (!entry.command || !input.pointsAtLauncher) return { state: 'elsewhere', detail: entry.command ? 'the fabric entry runs another program' : 'the fabric entry names no program' }
  if (!namesRunner(entry.args, input.runner)) return { state: 'wrong-runner', detail: `the entry does not pass --runner ${input.runner}` }
  if (!entry.enabled) return { state: 'disabled', detail: null }
  return { state: 'ready-to-answer' }
}
// #endregion fabric-mcp-registration
