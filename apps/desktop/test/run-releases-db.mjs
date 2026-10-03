// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Applies the whole migration chain, then runs releases-db.test.mjs against it.
// Through the shared helper since migration 75, so FABRIC_SKIP_MIGRATION can watch a fix fail.
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'releases', port: 58443 }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./releases-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, releases with their basis on isolated PostgreSQL')
})
