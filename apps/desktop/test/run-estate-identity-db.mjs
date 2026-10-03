// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Applies the whole migration chain, then runs estate-identity-db.test.mjs against it.
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'estate_identity', port: 58470 }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./estate-identity-db.test.mjs', import.meta.url).pathname)
  console.log("PASS full migration chain, an id names one estate's row on isolated PostgreSQL")
})
