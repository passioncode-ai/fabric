// The local stack's project, shipped inside the app (release packaging, 2026-09-29).
//
// A packaged Fabric used to look for its own source checkout at ~/DATA/fabric to run
// `supabase start` there — true of the operator's Mac and of no other. The app now carries the
// stack's project (config.toml, seed.sql, the migrations) in its resources and keeps a working
// copy in its data folder, because the Supabase CLI writes beside its config (`.temp/`) and a
// signed bundle is read-only.
//
// Only the files the bundle owns are written, each through a temporary file and a rename, and
// only when their bytes differ; a migration the bundle no longer carries is removed from the copy
// so the CLI never applies a file this build does not know. Nothing else in the folder is touched,
// and the database itself lives in Docker's volume, keyed by the project id — never here.
//
// Free of Electron so it can be probed (see `repoRoot.ts` for why that matters).

import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const MIGRATION = /^\d{14}_[a-z0-9_]+\.sql$/
export interface MaterializedStack { root: string; written: number; removed: number }

/** The bundled project copied into `target`; null when this build carries no stack. */
export function materializeStack(opts: { source: string; target: string }): MaterializedStack | null {
  const from = path.join(opts.source, 'supabase')
  if (!existsSync(path.join(from, 'config.toml')) || !existsSync(path.join(from, 'migrations'))) return null
  const migrations = readdirSync(path.join(from, 'migrations')).filter(f => MIGRATION.test(f)).sort()
  if (!migrations.length) return null
  const to = path.join(opts.target, 'supabase')
  for (const dir of [opts.target, to, path.join(to, 'migrations')]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const s = lstatSync(dir)
    if (!s.isDirectory() || s.isSymbolicLink()) throw new Error(`the local stack folder is not a plain directory: ${dir}`)
    chmodSync(dir, 0o700)
  }
  let written = 0, removed = 0
  const put = (rel: string) => {
    const bytes = readFileSync(path.join(from, rel)), dest = path.join(to, rel)
    if (existsSync(dest) && readFileSync(dest).equals(bytes)) return
    const tmp = dest + '.tmp'
    writeFileSync(tmp, bytes, { mode: 0o600 })
    renameSync(tmp, dest)
    written++
  }
  put('config.toml')
  if (existsSync(path.join(from, 'seed.sql'))) put('seed.sql')
  for (const m of migrations) put(path.join('migrations', m))
  const keep = new Set(migrations)
  for (const f of readdirSync(path.join(to, 'migrations'))) {
    if (keep.has(f)) continue
    // Only files that look like migrations are ours to remove; anything else is left alone.
    if (MIGRATION.test(f) || f.endsWith('.sql.tmp')) { rmSync(path.join(to, 'migrations', f), { force: true }); removed++ }
  }
  return { root: opts.target, written, removed }
}
