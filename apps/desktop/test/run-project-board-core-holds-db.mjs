// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// project-board-core-holds-db.test.mjs: the board part of Fabric 0.3.9 "the core holds" (BD-1 to BD-4).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'project_board_core_holds', port: 58489, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./project-board-core-holds-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, the board holds (0.3.9) on isolated PostgreSQL')
})
