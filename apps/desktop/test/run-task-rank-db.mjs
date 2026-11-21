// Owns a disposable local PostgreSQL cluster; never targets an existing DB (migration 131, ADR-0208).
// Applies the whole migration chain, then runs task-rank-db.test.mjs against it.
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'task_rank', port: 58451 }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./task-rank-db.test.mjs', import.meta.url).pathname)
  console.log("PASS full migration chain, the queue's rank and an agent's proposal on isolated PostgreSQL")
})
