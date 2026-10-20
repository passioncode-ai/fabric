// The platform's temporary and cache roots that exist on this computer (fabric-agent-contract DEC-0089,
// folder-attribution.schema.json `tempRoots`): the OS temp dir, /tmp, /private/tmp, /private/var/folders, /var/tmp,
// ~/.cache, ~/Library/Caches and ~/AppData/Local/Temp, as each exists. A folder under one is never a Project (AT-4).
import { existsSync, realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'

export function existingTempRoots(home = homedir(), temp = tmpdir()): string[] {
  const candidates = [temp, '/tmp', '/private/tmp', '/private/var/folders', '/var/tmp',
    path.join(home, '.cache'), path.join(home, 'Library', 'Caches'), path.join(home, 'AppData', 'Local', 'Temp')]
  const out: string[] = []
  for (const c of candidates) {
    if (!existsSync(c)) continue
    for (const p of [c, realpathSync.native(c)]) if (!out.includes(p)) out.push(p)
  }
  return out
}
