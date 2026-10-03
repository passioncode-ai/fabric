// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// hub-access-db.test.mjs against it (migration 76, ADR-0115).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'hub_access', port: 58476, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./hub-access-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, the hub access projection refuses impossible transitions on isolated PostgreSQL')
})
