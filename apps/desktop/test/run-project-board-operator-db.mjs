// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// project-board-operator-db.test.mjs: the operator's reads of the project board, wave 4 (migration 89, ADR-0156 §8).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'project_board_operator', port: 58488, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./project-board-operator-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, the operator\'s reads of the project board on isolated PostgreSQL')
})
