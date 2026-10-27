// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// journal-indexes-db.test.mjs: the home's journal reads use indexes (migration 126, CO-469, CO-477).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'journal_indexes', port: 58493, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./journal-indexes-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, the home\'s journal reads on their indexes')
})
