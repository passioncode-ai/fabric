// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// project-board-db.test.mjs: the project board's durable core, COM-02.1 (ADR-0117).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'project_board', port: 58482, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./project-board-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, the project board core on isolated PostgreSQL')
})
