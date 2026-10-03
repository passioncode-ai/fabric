// #region git-run — docs: docs/adr/0100-first-run-and-start-paths.md#scan
// One hardened way to run git, used by everything that reads a repository:
// the repo-state watcher, the code statistics, and the start paths' folder
// inspection and scan (ADR-0100 §3: "the walk runs git with every
// config-driven program switched off").
//
// IT IS ONE FILE BECAUSE IT IS A SECURITY CONTROL. `repoState.ts` had it, and
// when a second reader needed git the obvious move was to copy the constant —
// which is how a rule stops being one, and the copy that drifts is always the
// one nobody is looking at. This particular rule was already exploited once
// (see below), so a drifting copy is not a hypothetical: iteration 2 found
// `projectDiscovery.ts` carrying its own copy, and neither copy closed lazy
// fetch.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/**
 * Configuration that lets a REPOSITORY execute code, neutralised on every call.
 *
 * `git status` runs the program named by `core.fsmonitor`, and that program is
 * read from the repository's own `.git/config` — which every agent working in
 * that repository can write. Reproduced 2026-09-01: one line in `.git/config`
 * and arbitrary code ran as the operator inside Fabric's main process, the
 * process holding the Supabase service key and the operator's Anthropic OAuth
 * token — while the reading came back `error: null`, so the panel showed a
 * healthy repository.
 *
 * The same door, found again (iteration 1, iteration 2): `log.showSignature` +
 * `gpg.program` ran a planted verifier under a plain `git log`; a PARTIAL CLONE
 * (`extensions.partialClone`, a promisor remote, HEAD at a missing commit) made
 * `git log -1` lazy-fetch the commit by running `remote.origin.uploadpack` —
 * five times per read. `protocol.allow=never` refuses every transport, so no
 * read can reach a remote at all; `--no-lazy-fetch` / `GIT_NO_LAZY_FETCH`
 * stop the attempt before it starts.
 *
 * These are passed as `-c` before the subcommand rather than set in the
 * environment, because `-c` outranks every config file and cannot be overridden
 * by the repository being read. Global config is deliberately left alone: it
 * belongs to the operator, and taking it away would break credential helpers
 * and aliases they rely on elsewhere.
 */
export const HARDENED_GIT_ARGS: readonly string[] = [
  '-c', 'core.fsmonitor=false',
  '-c', 'core.hooksPath=/dev/null',
  '-c', 'core.pager=cat',
  '-c', 'core.sshCommand=false',
  '-c', 'log.showSignature=false',
  '-c', 'gpg.program=false',
  '-c', 'gpg.ssh.program=false',
  '-c', 'gpg.x509.program=false',
  '-c', 'diff.external=',
  // A submodule is another repository with its own config (`.git/modules/<name>/config`), which the
  // driver neutralisation below never reads: `git status` spawns a child status per submodule, and that
  // child ran the submodule's own clean filter (iteration 3). These are the defaults; the per-command
  // `--ignore-submodules=all` (SUBMODULE_FLAG_COMMANDS) is what outranks `submodule.<name>.ignore`.
  '-c', 'diff.ignoreSubmodules=all',
  '-c', 'submodule.recurse=false',
  '-c', 'status.submoduleSummary=false',
  // No read touches a remote: every transport is refused, which also closes `ext::` URLs and the
  // local-path fetch a partial clone's lazy fetch would make.
  '-c', 'protocol.allow=never',
  '-c', 'protocol.ext.allow=never'
]

/**
 * The environment of every git read. Lazy fetch off (git ≥ 2.44 reads it; older git ignores it and is
 * held by `protocol.allow=never`); no prompt, no pager, no optional index lock (a read must not take the
 * lock the operator's own git needs); no system config, which no repository chooses but which is not the
 * operator's either.
 */
export const HARDENED_GIT_ENV: Readonly<Record<string, string>> = {
  GIT_NO_LAZY_FETCH: '1',
  GIT_TERMINAL_PROMPT: '0',
  GIT_PAGER: 'cat',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_CONFIG_NOSYSTEM: '1'
}

/**
 * Inherited variables that would point a read at a DIFFERENT repository than the one asked about (a
 * Fabric started from a git hook inherits `GIT_DIR`), or splice in configuration nobody can see here.
 */
const REDIRECTING_ENV = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR', 'GIT_NAMESPACE', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT'
]

/** The process environment with the redirecting variables removed and the hardening applied. */
export function hardenedGitEnv(base: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined || REDIRECTING_ENV.includes(k) || /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(k)) continue
    env[k] = v
  }
  return { ...env, ...HARDENED_GIT_ENV }
}

let lazyFetchFlag: Promise<boolean> | null = null
/**
 * Whether this git accepts `--no-lazy-fetch` (2.44+). Asked once per process: an older git refuses an
 * unknown top-level option outright, and a read that always fails is not hardening.
 */
function supportsNoLazyFetch(): Promise<boolean> {
  lazyFetchFlag ??= exec('git', ['--no-lazy-fetch', 'version'], { timeout: 5_000, env: hardenedGitEnv() }).then(
    () => true,
    // Unsupported (or git missing — then every read fails on its own, honestly).
    () => false
  )
  return lazyFetchFlag
}

/** A filter or diff driver key whose value is a program: `filter.<name>.clean`, `diff.<name>.textconv`, … */
const DRIVER_PROGRAM = /^(filter\..+\.(clean|smudge|process)|diff\..+\.(textconv|command))$/i

/**
 * Driver programs the REPOSITORY defines (local or worktree scope, includes followed), each to be
 * overridden with an empty value. A driver name is the repository's choice and can be anything, so no
 * fixed `-c` list closes this: `git status` re-hashes a stat-dirty file through its clean filter, and
 * `.git/info/attributes` assigns a filter without a tracked file. Global and system drivers — git-lfs —
 * are the operator's and stay. Reading config runs nothing.
 */
async function repositoryDrivers(repoPath: string, env: Record<string, string>, args: readonly string[]): Promise<string[]> {
  let out: string
  try {
    ;({ stdout: out } = await exec(
      'git',
      [...args, 'config', '-z', '--name-only', '--show-scope', '--includes', '--get-regexp', '^(filter|diff)\\.'],
      { cwd: repoPath, timeout: 5_000, maxBuffer: 1_000_000, env }
    ))
  } catch (e) {
    // Exit 1 is "no such key" — the ordinary case. Anything else (not a repository, a hung include) is
    // left to the real command, which fails on the same cause and says so.
    const code = (e as { code?: unknown }).code
    if (code === 1) return []
    throw e
  }
  const keys: string[] = []
  // `-z --show-scope --name-only`: scope NUL key NUL, repeated.
  const parts = out.split('\0')
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const scope = parts[i]
    const key = parts[i + 1]
    if ((scope === 'local' || scope === 'worktree') && DRIVER_PROGRAM.test(key) && !keys.includes(key)) keys.push(key)
  }
  return keys
}

/**
 * Subcommands that look into a submodule's working tree, and so would run the submodule's own config.
 * `diff.ignoreSubmodules` is only their default — `submodule.<name>.ignore=none` in the repository's
 * config or its tracked `.gitmodules` outranks it (probed 2026-10-03) — so the flag goes on the command
 * line, right after the subcommand, where nothing the repository writes can override it.
 */
const SUBMODULE_FLAG_COMMANDS = new Set(['status', 'diff', 'diff-index', 'diff-files'])

/** The arguments with `--ignore-submodules=all` placed after any subcommand that would recurse. */
export function withSubmodulesIgnored(args: readonly string[]): string[] {
  if (args.length && SUBMODULE_FLAG_COMMANDS.has(args[0])) return [args[0], '--ignore-submodules=all', ...args.slice(1)]
  return [...args]
}

export interface GitRunOptions {
  /** How long the command may take; the default suits the repo-state watcher. */
  timeoutMs?: number
}

export async function gitRun(repoPath: string, args: string[], opts: GitRunOptions = {}): Promise<string> {
  const timeout = opts.timeoutMs ?? 5_000
  const lead = (await supportsNoLazyFetch()) ? ['--no-lazy-fetch', ...HARDENED_GIT_ARGS] : [...HARDENED_GIT_ARGS]
  const env = hardenedGitEnv()
  // Driver overrides travel as GIT_CONFIG_KEY_n / VALUE_n, not `-c k=v`: a driver name may itself contain
  // `=`, which `-c` would split at the wrong place. Both are command scope and outrank the repository.
  const drivers = await repositoryDrivers(repoPath, env, lead)
  drivers.forEach((key, i) => {
    env[`GIT_CONFIG_KEY_${i}`] = key
    env[`GIT_CONFIG_VALUE_${i}`] = ''
  })
  if (drivers.length) env.GIT_CONFIG_COUNT = String(drivers.length)
  const { stdout } = await exec('git', [...lead, ...withSubmodulesIgnored(args)], {
    cwd: repoPath,
    timeout,
    maxBuffer: 8_000_000,
    // A repository the operator is working in must not have its state read
    // through a pager or a hook that expects a terminal.
    env
  })
  return stdout
}
// #endregion git-run
