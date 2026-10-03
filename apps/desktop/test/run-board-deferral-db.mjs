// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L3b, SCR-41).
// Applies the whole migration chain, then runs board-deferral-db.test.mjs against it.
// Through the shared helper since migration 75, so FABRIC_SKIP_MIGRATION can watch a fix fail.
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'board', port: 58441 }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./board-deferral-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, board deferral and operator topics on isolated PostgreSQL')
})
