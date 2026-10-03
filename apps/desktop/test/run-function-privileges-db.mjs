// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// function-privileges-db.test.mjs against it (migration 75).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'function_privileges', port: 58472, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./function-privileges-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, no projector and no host-only command is open to an API role on isolated PostgreSQL')
})
