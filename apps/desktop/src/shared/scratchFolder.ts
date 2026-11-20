// #region scratch-folder — docs: docs/reports/2026-11-20-voice-ceo-retro/fixes.md#5-the-project-registry
/**
 * A cache or temporary folder is never a project's folder (voice CEO retro 2026-11-20, finding 5). The registry held
 * projects made from agents' probes and scratch clones there: `~/.cache/<probe>`, `/private/tmp`, the system's
 * per-user temporary folder (`/private/var/folders/…/T/tmp.XXXX`), whose names then answered the voice's lookups
 * («fabric-agents-database» named two projects, one of them in `~/.cache`). Enrollment refuses such a folder
 * (`main/sessionEnroll.ts`), and a lookup prefers a project outside one (`ceoAgent.ts#findProject`).
 *
 * Pure: the home folder and the system's temporary folder are given; by spelling only, real paths expected.
 */

/** Folders under the home folder that hold caches, never work. */
const HOME_SCRATCH = ['.cache', 'Library/Caches', '.npm', '.pnpm-store', '.Trash']
/** System folders that hold temporary files. */
const SYSTEM_SCRATCH = ['/tmp', '/private/tmp', '/var/tmp', '/private/var/tmp', '/var/folders', '/private/var/folders']

const under = (p: string, root: string): boolean => p === root || p.startsWith(root.endsWith('/') ? root : root + '/')

/** `folder` is a cache or temporary folder, or lies inside one. `home` and `tmp` default to none (spelling of the
 *  common Unix and macOS places only). */
export function isScratchFolder(folder: string, home?: string, tmp?: string): boolean {
  const p = String(folder ?? '').replace(/\/+$/, '')
  if (!p) return false
  if (SYSTEM_SCRATCH.some((r) => under(p, r))) return true
  if (tmp && under(p, tmp.replace(/\/+$/, ''))) return true
  // Without a home folder given, any user's cache folder is recognised by its place under /Users or /home.
  if (home) return HOME_SCRATCH.some((r) => under(p, `${home.replace(/\/+$/, '')}/${r}`))
  return /^\/(Users|home)\/[^/]+\/(\.cache|Library\/Caches|\.npm|\.pnpm-store|\.Trash)(\/|$)/.test(p)
}
// #endregion scratch-folder
