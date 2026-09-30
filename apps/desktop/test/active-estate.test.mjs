// First-slice plan A1-6b: which Estate this app opens is a recorded choice, never a guess.
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DEFAULT_ESTATE, readActiveEstate, recordActiveEstate, ACTIVE_ESTATE_FILE } from '../src/main/activeEstate.ts'
import { classifyStartupFailure } from '../src/shared/startupFailure.ts'
import { activeEstateUnreadable } from '../src/main/activeEstate.ts'

const B = '00000000-0000-4000-8000-000000000030'
const roots = []
const fresh = () => { const d = mkdtempSync(path.join(tmpdir(), 'fabric-active-estate-')); roots.push(d); return d }
let groups = 0
const test = (name, fn) => { fn(); groups++; console.log('PASS ' + name) }
try {
  test('no recorded choice opens the default Estate, and says it is the default', () => {
    assert.deepEqual(readActiveEstate(fresh()), { status: 'default', estateId: DEFAULT_ESTATE })
  })
  test('a recorded choice is read back exactly, from a private file', () => {
    const d = fresh()
    assert.deepEqual(recordActiveEstate(d, B), { ok: true })
    assert.deepEqual(readActiveEstate(d), { status: 'recorded', estateId: B })
    assert.equal(statSync(path.join(d, ACTIVE_ESTATE_FILE)).mode & 0o777, 0o600)
    assert.equal(JSON.parse(readFileSync(path.join(d, ACTIVE_ESTATE_FILE), 'utf8')).schema, 'ActiveEstate@1')
    assert.deepEqual(recordActiveEstate(d, DEFAULT_ESTATE), { ok: true }); assert.equal(readActiveEstate(d).estateId, DEFAULT_ESTATE)
  })
  test('an unreadable choice is unreadable, never another Estate', () => {
    for (const [label, write] of [
      ['not JSON', f => writeFileSync(f, '{broken', { mode: 0o600 })],
      ['not an Estate id', f => writeFileSync(f, JSON.stringify({ schema: 'ActiveEstate@1', estate_id: 'nope', recorded_at: new Date().toISOString() }), { mode: 0o600 })],
      ['an unknown schema', f => writeFileSync(f, JSON.stringify({ schema: 'ActiveEstate@2', estate_id: B, recorded_at: new Date().toISOString() }), { mode: 0o600 })],
      ['readable by others', f => { writeFileSync(f, JSON.stringify({ schema: 'ActiveEstate@1', estate_id: B, recorded_at: new Date().toISOString() })); chmodSync(f, 0o644) }],
      ['a symlink', f => { const real = f + '.real'; writeFileSync(real, JSON.stringify({ schema: 'ActiveEstate@1', estate_id: B, recorded_at: new Date().toISOString() }), { mode: 0o600 }); symlinkSync(real, f) }],
    ]) {
      const d = fresh(); write(path.join(d, ACTIVE_ESTATE_FILE))
      const r = readActiveEstate(d)
      assert.equal(r.status, 'unreadable', label); assert.equal(r.estateId, null, label + ' must not name an Estate')
    }
  })
  test('recording refuses what it could not read back', () => {
    assert.deepEqual(recordActiveEstate(fresh(), 'not-a-uuid'), { ok: false, reason: 'invalid_estate' })
  })
  test('at startup an unreadable choice is its own failure: Fabric will not open another Estate in its place', () => {
    const f = classifyStartupFailure(activeEstateUnreadable('the file is not JSON'))
    assert.equal(f.cause, 'active-estate-unreadable')
    assert.match(f.remedy, /will not open another Estate/)
    assert.match(f.detail, /not JSON/)
  })
  test('main reads the choice before it connects to the database, and stops on an unreadable one', () => {
    // bootstrap cannot run here (Electron and the local stack); its load-bearing lines are read.
    const main = readFileSync(path.join(import.meta.dirname, '..', 'src', 'main', 'index.ts'), 'utf8')
    const boot = main.slice(main.indexOf('async function bootstrap()'))
    const read = boot.indexOf('readActiveEstate(app.getPath'), stop = boot.indexOf("if (active.status === 'unreadable') throw activeEstateUnreadable"), connect = boot.indexOf('createClient(')
    assert.ok(read > 0 && stop > read && connect > stop, 'the choice is read and checked before the database client exists')
    assert.ok(!/\bORG1\b/.test(main), 'no hardcoded Estate constant is left in main')
    assert.match(main, /let ACTIVE_ESTATE: string = DEFAULT_ESTATE/)
  })
  test('Open this Estate records only an Estate this machine restored, never an id the renderer names', () => {
    const main = readFileSync(path.join(import.meta.dirname, '..', 'src', 'main', 'index.ts'), 'utf8')
    const handler = main.slice(main.indexOf('handle(IPC.historyOpen'), main.indexOf('handle(IPC.historyOpen') + 900)
    assert.match(handler, /privateHistory\.restored\(\)\.includes\(estateId\)/)
    assert.ok(handler.indexOf('restored().includes') < handler.indexOf('recordActiveEstate('), 'checked before it is recorded')
    assert.ok(handler.indexOf('recordActiveEstate(') < handler.indexOf('app.relaunch()'), 'recorded before the restart')
  })
  console.log(`PASS active Estate: ${groups} groups`)
} finally { for (const r of roots) rmSync(r, { recursive: true, force: true }) }
