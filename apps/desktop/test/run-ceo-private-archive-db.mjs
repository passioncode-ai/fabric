// Own the entire database lifetime. No caller URL, existing cluster or TCP listener.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { pgEnv } from './helpers/pg-env.mjs'

const bin = process.env.FABRIC_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
if (!existsSync(path.join(bin, 'initdb'))) {
  console.error('NOT_RUN: set FABRIC_PG_BIN to installed PostgreSQL binaries')
  process.exit(2)
}
const dir = mkdtempSync(path.join(tmpdir(), 'fabric-ceo-private-archive-'))
const data = path.join(dir, 'data'), nonce = randomUUID(), port = '58467'
const run = (name, args) => execFileSync(path.join(bin, name), args, {
  encoding: 'utf8', env: pgEnv(), stdio: ['ignore', 'pipe', 'pipe']
})
let started = false
try {
  writeFileSync(path.join(dir, 'owner'), nonce, { mode: 0o600 })
  run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'])
  run('pg_ctl', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o',
    `-F -k '${dir.replaceAll("'", "'\\''")}' -c listen_addresses='' -p ${port}`, '-w', 'start'])
  started = true
  // One fresh database per test file inside this one owned cluster: each applies the
  // whole chain itself, and none can see what another left behind.
  for (const [test, db] of [['ceo-private-archive-db.test.mjs', 'fabric_ceo_private_archive_owned'],
    ['restore-verified-db.test.mjs', 'fabric_restore_verified_owned'],
    ['private-history-db.test.mjs', 'fabric_private_history_owned'],
    ['private-history-native-db.test.mjs', 'fabric_private_history_native_owned']]) {
    run('createdb', ['-h', dir, '-p', port, '-U', 'postgres', db])
    execFileSync(process.execPath, ['--experimental-strip-types',
      new URL('./' + test, import.meta.url).pathname], {
      stdio: 'inherit', env: { ...process.env,
        FABRIC_ARCHIVE_DB_DIR: dir, FABRIC_ARCHIVE_DB_NONCE: nonce, FABRIC_ARCHIVE_PG_BIN: bin, FABRIC_ARCHIVE_DB_NAME: db }
    })
  }
} finally {
  // A failed start may still have created a postmaster. Stop only this owned data directory.
  if (started || existsSync(path.join(data, 'postmaster.pid')))
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  rmSync(dir, { recursive: true, force: true })
  if (existsSync(dir)) throw new Error('Owned PostgreSQL directory was not removed')
  console.log('PASS cleanup: owned PostgreSQL stopped; socket and data directory removed')
}
