// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Puts Supabase's default privileges in force, applies the whole migration chain, then runs
// project-profile-db.test.mjs: a project's profile (Fabric 0.3.12 wave 2, slice S1, migration 123).
import { withOwnedPostgres, runAgainst } from './helpers/owned-postgres.mjs'

withOwnedPostgres({ name: 'project_profile', port: 58490, supabaseDefaults: true }, ({ url, bin }) => {
  runAgainst(url, bin, new URL('./project-profile-db.test.mjs', import.meta.url).pathname)
  console.log('PASS full migration chain, a project\'s profile (0.3.12) on isolated PostgreSQL')
})
