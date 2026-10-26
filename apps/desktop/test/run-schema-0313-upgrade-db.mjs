// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Applies the chain up to schema 96 (it stops before migration 124), lets schema-0313-upgrade-db.test.mjs plant what an
// older build left, applies migrations 124 and 125 the way `supabase migration up` does, and checks what they corrected.
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'schema_0313_upgrade', port: 58492, supabaseDefaults: true, stopBefore: '20261026000124_one_schema_step.sql' }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./schema-0313-upgrade-db.test.mjs', import.meta.url).pathname)
  console.log('PASS 96 to 98: migrations 124 and 125 correct what an older build left, on isolated PostgreSQL')
})
