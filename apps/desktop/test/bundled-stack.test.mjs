// Release packaging: the stack project a packaged Fabric ships, materialized into its data folder.
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { materializeStack } from '../src/main/bundledStack.ts'

const dir = mkdtempSync(path.join(tmpdir(), 'fabric-bundled-stack-'))
const source = path.join(dir, 'resources', 'stack'), target = path.join(dir, 'userData', 'stack')
const put = (rel, text) => { const f = path.join(source, 'supabase', rel); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, text) }
put('config.toml', 'project_id = "fabric"\n'); put('seed.sql', '-- seed\n')
put('migrations/20260901000001_one.sql', 'select 1;\n'); put('migrations/20260901000002_two.sql', 'select 2;\n'); put('migrations/README.md', 'not a migration\n')
let count = 0; const test = (name, fn) => { fn(); console.log('PASS ' + name); count++ }
try {
  test('the shipped project is copied into the data folder, private, migrations only', () => {
    const r = materializeStack({ source, target })
    assert.deepEqual(r, { root: target, written: 4, removed: 0 })
    assert.deepEqual(readdirSync(path.join(target, 'supabase', 'migrations')).sort(), ['20260901000001_one.sql', '20260901000002_two.sql'])
    assert.equal(readFileSync(path.join(target, 'supabase', 'config.toml'), 'utf8'), 'project_id = "fabric"\n')
    for (const d of [target, path.join(target, 'supabase'), path.join(target, 'supabase', 'migrations')]) assert.equal(statSync(d).mode & 0o777, 0o700, d)
    assert.equal(statSync(path.join(target, 'supabase', 'config.toml')).mode & 0o777, 0o600)
  })

  test('a second launch writes nothing; a changed file is rewritten; the CLI\'s own state is left alone', () => {
    mkdirSync(path.join(target, 'supabase', '.temp'), { recursive: true }); writeFileSync(path.join(target, 'supabase', '.temp', 'cli-latest'), 'x')
    assert.deepEqual(materializeStack({ source, target }), { root: target, written: 0, removed: 0 })
    put('config.toml', 'project_id = "fabric"\n# newer\n')
    assert.equal(materializeStack({ source, target }).written, 1)
    assert.ok(existsSync(path.join(target, 'supabase', '.temp', 'cli-latest')), 'the CLI state survives')
  })

  test('a migration this build no longer ships is removed; files that are not migrations are kept', () => {
    writeFileSync(path.join(target, 'supabase', 'migrations', '20260901000099_stale.sql'), 'select 99;\n')
    writeFileSync(path.join(target, 'supabase', 'migrations', 'notes.txt'), 'mine\n')
    const r = materializeStack({ source, target })
    assert.equal(r.removed, 1)
    assert.ok(!existsSync(path.join(target, 'supabase', 'migrations', '20260901000099_stale.sql')))
    assert.ok(existsSync(path.join(target, 'supabase', 'migrations', 'notes.txt')))
  })

  test('a build with no stack returns null; a symlinked folder is refused', () => {
    assert.equal(materializeStack({ source: path.join(dir, 'nothing'), target: path.join(dir, 'other') }), null)
    const empty = path.join(dir, 'empty-src'); mkdirSync(path.join(empty, 'supabase', 'migrations'), { recursive: true }); writeFileSync(path.join(empty, 'supabase', 'config.toml'), '')
    assert.equal(materializeStack({ source: empty, target: path.join(dir, 'other2') }), null, 'no migrations, no stack')
    const real = path.join(dir, 'elsewhere'); mkdirSync(real); const linked = path.join(dir, 'linked'); symlinkSync(real, linked)
    assert.throws(() => materializeStack({ source, target: linked }), /not a plain directory/)
  })
  console.log(`PASS ${count} bundled stack groups`)
} finally { rmSync(dir, { recursive: true, force: true }) }
