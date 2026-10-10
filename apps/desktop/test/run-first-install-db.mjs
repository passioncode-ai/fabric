// Owns two disposable local PostgreSQL clusters; never targets an existing DB (L8, ADR-0084).
// Each applies the whole migration chain; first-install-db.test.mjs then applies a seed:
// the current one (a fresh install), and the one 0.3.0–0.3.3 shipped (the database those installs made).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

const test = new URL('./first-install-db.test.mjs', import.meta.url).pathname
withOwnedPostgres({ name: 'first_install', port: 58484 }, ({ url, bin }) => {
  process.env.FIRST_INSTALL_CASE = 'fresh'
  runAgainst(url, bin, test)
})
withOwnedPostgres({ name: 'first_install_legacy', port: 58485 }, ({ url, bin }) => {
  process.env.FIRST_INSTALL_CASE = 'legacy'
  runAgainst(url, bin, test)
})
console.log('PASS full migration chain: a fresh install opens its estate, and a 0.3.3 install\'s database is repaired, on isolated PostgreSQL')
