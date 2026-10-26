// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Applies the chain up to schema 96 (everything but migration 124), lets schema-0313-upgrade-db.test.mjs plant what an
// older build left, applies migration 124 the way `supabase migration up` does, and checks what it corrected.
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

process.env.FABRIC_SKIP_MIGRATION = '20261026000124_one_schema_step.sql'
withOwnedPostgres({ name: 'schema_0313_upgrade', port: 58492, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./schema-0313-upgrade-db.test.mjs', import.meta.url).pathname)
  console.log('PASS 96 to 97: migration 124 corrects what an older build left, on isolated PostgreSQL')
})
