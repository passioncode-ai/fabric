// CO-364, build step 1: admit a behind database, check the disk, back it up with a receipt. Nothing here changes
// the working database. Spec: docs/evidence/specs/2026-11-07-schema-step-at-start.md §3.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { admitStep, bundledVersions, migrationVersion, parseNumbers, backupBeforeStep, SPACE_MARGIN_BYTES, NUMBERS_SQL, SIZE_SQL } =
  await import(path.resolve(import.meta.dirname, '../src/main/schemaStep.ts'))

const files = ['20260831000001_a.sql', '20260901000002_b.sql', '20260902000003_c.sql', 'README.md', '20260903000004_d.sql']
const bundled = bundledVersions(files)

test('a migration file names its version; other files are not migrations; the order is the one migration up applies', () => {
  assert.equal(migrationVersion('20261030000127_archive_source_schemas_99_100.sql'), '20261030000127')
  assert.equal(migrationVersion('README.md'), null)
  assert.equal(migrationVersion('2026_x.sql'), null)
  assert.deepEqual(bundledVersions(['20260902000003_c.sql', '20260831000001_a.sql']), ['20260831000001', '20260902000003'])
  assert.equal(bundled.length, 4)
})

test('a behind database whose ledger is the start of the build\'s own is admitted with exactly the rest pending', () => {
  assert.deepEqual(admitStep({ found: 2, minimum: 4, bundledStack: true, ledger: bundled.slice(0, 2), bundled }), { ok: true, pending: bundled.slice(2) })
})

test('nothing else is admitted: current, ahead, another stack, another branch, a ledger the count does not match', () => {
  assert.equal(admitStep({ found: 4, minimum: 4, bundledStack: true, ledger: bundled, bundled }).why, 'not-behind')
  assert.equal(admitStep({ found: 5, minimum: 4, bundledStack: true, ledger: bundled, bundled }).why, 'not-behind')
  assert.equal(admitStep({ found: 2, minimum: 4, bundledStack: false, ledger: bundled.slice(0, 2), bundled }).why, 'not-bundled')
  const foreign = admitStep({ found: 2, minimum: 4, bundledStack: true, ledger: [bundled[0], '20260901999999'], bundled })
  assert.equal(foreign.why, 'not-a-prefix')
  assert.match(foreign.says, /another build/)
  assert.equal(admitStep({ found: 3, minimum: 4, bundledStack: true, ledger: bundled.slice(0, 2), bundled }).why, 'not-a-prefix')
  assert.equal(admitStep({ found: 2, minimum: 6, bundledStack: true, ledger: bundled.slice(0, 2), bundled }).why, 'not-a-prefix')
})

test('the numbers read is parsed strictly: schema, journal and each table, or an error', () => {
  assert.deepEqual(parseNumbers('schema|100\njournal|7\nt|estates|1\nt|journal|7\n'), { schemaVersion: 100, journal: 7, tables: { estates: 1, journal: 7 } })
  assert.throws(() => parseNumbers('journal|7\n'), /no schema/)
  assert.throws(() => parseNumbers('schema|1\njournal|x\n'), /not a number/)
  assert.throws(() => parseNumbers('schema|1\njournal|1\nweird|1\n'), /unexpected line/)
})

function ports({ size = 1000, free = 10 * 1024 ** 3, numbers = 'schema|98\njournal|5\nt|journal|5\n', list = 'TABLE public journal\nTABLE supabase_migrations schema_migrations\n', dumpFails = false } = {}) {
  const acts = []
  return {
    acts,
    async sql(text) { acts.push(['sql', text === SIZE_SQL ? 'size' : text === NUMBERS_SQL ? 'numbers' : text]); return text === SIZE_SQL ? `${size}\n` : numbers },
    async dump(file) { acts.push(['dump', path.basename(file)]); if (dumpFails) throw new Error('pg_dump exited 1: disk full') },
    async list(file) { acts.push(['list', path.basename(file)]); return list },
    async freeBytes() { return free },
    async digest() { return { sha256: 'a'.repeat(64), bytes: 1234 } },
    async writeReceipt(file, text) { acts.push(['receipt', path.basename(file), JSON.parse(text)]) }
  }
}
const at = new Date('2026-11-07T16:00:00.123Z')

test('the backup is taken, listed and receipted with numbers only, under a name that says the build, schema and time', async () => {
  const p = ports()
  const r = await backupBeforeStep(p, { dir: '/b', appVersion: '0.3.17', found: 98, now: at })
  assert.equal(r.ok, true)
  assert.equal(r.file, '/b/pre-0.3.17-schema-98-20261107T160000Z.dump')
  assert.deepEqual(p.acts.map((a) => a.slice(0, 2)), [['sql', 'size'], ['sql', 'numbers'], ['dump', 'pre-0.3.17-schema-98-20261107T160000Z.dump'], ['list', 'pre-0.3.17-schema-98-20261107T160000Z.dump'], ['receipt', 'pre-0.3.17-schema-98-20261107T160000Z.dump.json']])
  const receipt = p.acts.at(-1)[2]
  assert.deepEqual(receipt, { format: 'FabricSchemaStepBackup@1', at: at.toISOString(), appVersion: '0.3.17', file: 'pre-0.3.17-schema-98-20261107T160000Z.dump', sha256: 'a'.repeat(64), bytes: 1234, numbers: { schemaVersion: 98, journal: 5, tables: { journal: 5 } } })
})

test('too little disk refuses before anything is written, naming both numbers', async () => {
  const p = ports({ size: 1000, free: 2 * 1000 + SPACE_MARGIN_BYTES - 1 })
  const r = await backupBeforeStep(p, { dir: '/b', appVersion: '0.3.17', found: 98, now: at })
  assert.equal(r.why, 'no-space')
  assert.match(r.says, /1000 bytes .* free/)
  assert.deepEqual(p.acts.map((a) => a[0]), ['sql'])
})

test('a schema that moved, a failed dump and a dump without the journal or the ledger are refusals, never a backup', async () => {
  assert.equal((await backupBeforeStep(ports({ numbers: 'schema|99\njournal|5\n' }), { dir: '/b', appVersion: 'v', found: 98, now: at })).why, 'moved')
  const failed = await backupBeforeStep(ports({ dumpFails: true }), { dir: '/b', appVersion: 'v', found: 98, now: at })
  assert.equal(failed.why, 'dump-failed')
  assert.match(failed.says, /disk full/)
  const partial = ports({ list: 'TABLE public journal\n' })
  const r = await backupBeforeStep(partial, { dir: '/b', appVersion: 'v', found: 98, now: at })
  assert.equal(r.why, 'dump-incomplete')
  assert.ok(!partial.acts.some((a) => a[0] === 'receipt'), 'no receipt for an incomplete backup')
})

// The real ports, through a fake `docker` on the PATH: the pipes, not the database.
const { dockerPorts } = await import(path.resolve(import.meta.dirname, '../src/main/schemaStep.ts'))
const { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync, chmodSync } = await import('node:fs')
const { tmpdir } = await import('node:os')

function fakeDocker(script) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fake-docker-'))
  writeFileSync(path.join(dir, 'docker'), `#!/bin/sh\n${script}\n`)
  chmodSync(path.join(dir, 'docker'), 0o755)
  return dir
}
async function withPath(dir, run) {
  const old = process.env.PATH
  process.env.PATH = `${dir}${path.delimiter}${old}`
  try { return await run() } finally { process.env.PATH = old }
}

test('listing a dump whose reader stops at the table of contents is not a failure (EPIPE on its input, exit 0)', async () => {
  const bin = fakeDocker('head -c 16 >/dev/null; echo "TABLE public journal"; exit 0')
  const dump = path.join(bin, 'big.dump')
  writeFileSync(dump, Buffer.alloc(8 * 1024 * 1024, 1))
  const out = await withPath(bin, () => dockerPorts({ container: 'c', deadlineMs: 20_000 }).list(dump))
  assert.match(out, /TABLE public journal/)
})

test('a dump is written whole and private; a dump that fails leaves no file behind', async () => {
  const bin = fakeDocker('if [ "$4" = "pg_dump" ]; then head -c 3000000 /dev/zero; exit ${FAKE_EXIT:-0}; fi')
  const file = path.join(bin, 'out', 'a.dump')
  await withPath(bin, () => dockerPorts({ container: 'c' }).dump(file))
  assert.equal(statSync(file).size, 3000000)
  assert.equal(statSync(file).mode & 0o777, 0o600)
  process.env.FAKE_EXIT = '1'
  try {
    const bad = path.join(bin, 'out', 'b.dump')
    await assert.rejects(withPath(bin, () => dockerPorts({ container: 'c' }).dump(bad)), /exited 1/)
    assert.equal(existsSync(bad), false)
  } finally { delete process.env.FAKE_EXIT }
})
