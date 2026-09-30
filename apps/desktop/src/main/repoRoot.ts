// Which directory the local stack's configuration lives in (M100).
//
// ITS OWN FILE, and that is the whole reason it is not in `env.ts`: that module
// imports `app` from Electron at the top level, so nothing inside it can be
// loaded by a probe — a pure function in a file with an Electron import is not
// testable, only tidier. `menuTemplate.ts` was split from `menu.ts` for exactly
// this, and the first attempt at this change repeated the mistake before the
// probe refused to load.

import path from 'node:path'

/**
 * Which directory the local stack's configuration lives in.
 *
 * Split from `repoRoot` and free of Electron so it can be probed — the same
 * move `menuTemplate.ts` made, and for the same reason: this decides where a
 * subprocess runs, which is the kind of thing that should be readable without
 * launching an app.
 *
 * FABRIC_REPO IS CHECKED FOR EXISTENCE, and that check is the point.
 * `execFileSync` reports a missing WORKING DIRECTORY and a missing BINARY with
 * the identical `spawnSync <cmd> ENOENT` (measured 2026-09-05), so a
 * FABRIC_REPO pointing at nothing would have been diagnosed as "the Supabase
 * command-line tool is not installed" — sending the operator to install
 * software they already have. The ambiguity is removed HERE, where the
 * knowledge to resolve it exists, rather than guessed at by the classifier.
 */
export function chooseRepoRoot(opts: {
  fromEnv: string | undefined
  packaged: boolean
  appPath: string
  home: string
  exists: (p: string) => boolean
  /** The stack project this build ships, already copied into the app's data folder; null if none. */
  bundled?: string | null
}): string {
  if (opts.fromEnv) {
    if (opts.exists(opts.fromEnv)) return opts.fromEnv
    throw new Error(
      `Cannot locate the fabric repository (needed for the local Supabase stack). ` +
        `FABRIC_REPO is set to ${opts.fromEnv}, and there is nothing there.`
    )
  }
  if (!opts.packaged) return path.resolve(opts.appPath, '..', '..')
  // A packaged app runs the stack project it ships (bundledStack.ts), so it starts on any Mac.
  if (opts.bundled) return opts.bundled
  // Builds from before the stack shipped, on the operator's machine.
  const fallback = path.join(opts.home, 'DATA', 'fabric')
  if (opts.exists(fallback)) return fallback
  throw new Error(
    'Cannot locate the fabric repository (needed for the local Supabase stack). Set FABRIC_REPO.'
  )
}
