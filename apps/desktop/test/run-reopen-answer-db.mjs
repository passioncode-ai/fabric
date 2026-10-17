// Owns a disposable local PostgreSQL cluster; never targets an existing DB (0.3.7 wave 2, migration 90).
// Applies the whole migration chain, then runs reopen-answer-db.test.mjs against it.
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'reopen_answer', port: 58442 }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./reopen-answer-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, answered question reopened and the act record on isolated PostgreSQL')
})
