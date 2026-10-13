// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// project-board-responders-db.test.mjs: the project board's responders, COM-03 (ADR-0149, migration 87).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'project_board_responders', port: 58487, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./project-board-responders-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, the project board responders on isolated PostgreSQL')
})
