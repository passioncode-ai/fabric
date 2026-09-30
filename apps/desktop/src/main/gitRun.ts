// One hardened way to run git, used by everything that reads a repository.
//
// IT IS ONE FILE BECAUSE IT IS A SECURITY CONTROL. `repoState.ts` had it, and
// when a second reader needed git the obvious move was to copy the constant —
// which is how a rule stops being one, and the copy that drifts is always the
// one nobody is looking at. This particular rule was already exploited once
// (see below), so a drifting copy is not a hypothetical.

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
 * These are passed as `-c` before the subcommand rather than set in the
 * environment, because `-c` outranks every config file and cannot be overridden
 * by the repository being read. Global config is deliberately left alone: it
 * belongs to the operator, and taking it away would break credential helpers
 * and aliases they rely on elsewhere.
 */
const HARDENED = [
  '-c',
  'core.fsmonitor=',
  '-c',
  'core.hooksPath=/dev/null',
  // Nothing here touches a remote, but an `ext::` URL is a second exec path and
  // costs nothing to close.
  '-c',
  'protocol.ext.allow=never'
]

export async function gitRun(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', [...HARDENED, ...args], {
    cwd: repoPath,
    timeout: 5_000,
    maxBuffer: 8_000_000,
    // A repository the operator is working in must not have its state read
    // through a pager or a hook that expects a terminal.
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' }
  })
  return stdout
}
