// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// schema-0313-db.test.mjs: Fabric 0.3.13's one schema step (migration 124, schema 97).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'schema_0313', port: 58491, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./schema-0313-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, 0.3.13\'s one schema step on isolated PostgreSQL')
})
