// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Applies the whole migration chain, then runs read-schema-db.test.mjs against it.
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'read_schema', port: 58471 }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./read-schema-db.test.mjs', import.meta.url).pathname)
  console.log("PASS full migration chain, the main process reads name columns the schema has, on isolated PostgreSQL")
})
