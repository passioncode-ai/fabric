// The environment a test hands to PostgreSQL's own programs (initdb, pg_ctl, createdb, psql).
//
// On macOS a postmaster started with no locale in its environment refuses to start: "FATAL: postmaster
// became multithreaded during startup — Set the LC_ALL environment variable to a valid locale". An
// interactive shell sets LANG, so the runners passed there; the scheduled workspace sync runs under
// launchd with a minimal environment and every owned-cluster runner failed (2026-10-03 13:12Z to
// 2026-10-04 01:05Z). A locale the caller already set is kept; with none, `C` — the clusters are
// created `--no-locale` anyway, so `C` changes nothing they store.
export function pgEnv(env = process.env) {
  if (env.LC_ALL || env.LC_CTYPE || env.LANG) return env
  return { ...env, LC_ALL: 'C' }
}
