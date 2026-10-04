// Owns a disposable local PostgreSQL cluster; never targets an existing DB.
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pgEnv } from './helpers/pg-env.mjs'
const bin = process.env.FABRIC_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
if (!existsSync(path.join(bin, 'initdb'))) {
  console.error('NOT_RUN: set FABRIC_PG_BIN to installed PostgreSQL binaries'); process.exit(2)
}
const dir = mkdtempSync(path.join(tmpdir(), 'fabric-managed-launch-'))
const data = path.join(dir, 'data')
let started = false
const run = (name, args) => execFileSync(path.join(bin, name), args, { encoding: 'utf8', env: pgEnv(), stdio: ['ignore', 'pipe', 'pipe'] })
try {
  run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'])
  run('pg_ctl', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', `-F -k ${dir} -c listen_addresses='' -p 58437`, '-w', 'start'])
  started = true
  run('createdb', ['-h', dir, '-p', '58437', '-U', 'postgres', 'fabric_dispatch_test_full'])
  const url = `postgresql://postgres@localhost:58437/fabric_dispatch_test_full?host=${encodeURIComponent(dir)}`
  execFileSync(process.execPath, [new URL('./continuation-dispatch-db.test.mjs', import.meta.url).pathname], {
    stdio: 'inherit', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
      FABRIC_DISPATCH_TEST_DATABASE_URL: url, FABRIC_DISPATCH_TEST_FULL_SCHEMA: '1' }
  })
  execFileSync(process.execPath, [new URL('./managed-launch-db.test.mjs', import.meta.url).pathname], {
    stdio: 'inherit', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FABRIC_DISPATCH_TEST_DATABASE_URL: url }
  })
  console.log('PASS full migration chain and managed launch lifecycle on isolated PostgreSQL')
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  rmSync(dir, { recursive: true, force: true })
}
