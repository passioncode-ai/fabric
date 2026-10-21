// The app's stack and the disposable test stack exclude the same services (lifecycle LC-09).
// A service the app starts but the probes never exercise is one nobody tests; a service the app
// excludes that a probe needs would fail the probes first. Equality keeps the two honest.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { STACK_EXCLUDED_SERVICES } from '../src/main/stackServices.ts'

const repo = path.resolve(import.meta.dirname, '../../..')
const SRC = path.resolve(import.meta.dirname, '../src/main')

test('the app excludes exactly the services the disposable test stack excludes', () => {
  const src = readFileSync(path.join(repo, 'scripts/test-stack.mjs'), 'utf8')
  const m = /const EXCLUDE = (\[[^\]]*\])/.exec(src)
  assert.ok(m, 'scripts/test-stack.mjs no longer declares EXCLUDE')
  assert.deepEqual([...STACK_EXCLUDED_SERVICES].sort(), JSON.parse(m[1].replace(/'/g, '"')).sort())
})

test('the app starts its stack with that exclusion list', () => {
  const env = readFileSync(path.join(repo, 'apps/desktop/src/main/env.ts'), 'utf8')
  assert.match(env, /run\('supabase', \['start', '-x', STACK_EXCLUDED_SERVICES\.join\(','\)\]/)
})

// CO-333 (2026-10-19): containers of the excluded services left by an older full `supabase start` keep
// `restart: unless-stopped`, so every Docker or OrbStack restart brought them back (~1.4 GiB and their logs).
const { excludedContainers, removeExcludedContainers } = await import('../src/main/stackServices.ts')

test('the excluded services name their Supabase containers for this project, and nothing Fabric calls', () => {
  const names = excludedContainers('fabric')
  assert.ok(names.includes('supabase_studio_fabric'))
  assert.ok(names.includes('supabase_analytics_fabric'), 'logflare runs as supabase_analytics_<project>')
  assert.ok(names.includes('supabase_inbucket_fabric'), 'mailpit runs as supabase_inbucket_<project>')
  for (const kept of ['supabase_db_fabric', 'supabase_rest_fabric', 'supabase_kong_fabric', 'supabase_auth_fabric'])
    assert.ok(!names.includes(kept), kept + ' is called by Fabric and must stay')
})

test('only the excluded containers that exist are removed; a docker that fails is reported, never thrown', async () => {
  const calls = []
  const exec = async (args) => {
    calls.push(args)
    if (args[0] === 'ps') return 'supabase_db_fabric\nsupabase_studio_fabric\nsupabase_vector_fabric\nother_studio_x\n'
    return ''
  }
  const out = await removeExcludedContainers('fabric', exec)
  assert.deepEqual(out, { removed: ['supabase_studio_fabric', 'supabase_vector_fabric'] })
  assert.deepEqual(calls[1], ['rm', '-f', 'supabase_studio_fabric', 'supabase_vector_fabric'])

  const none = await removeExcludedContainers('fabric', async () => 'supabase_db_fabric\n')
  assert.deepEqual(none, { removed: [] })
  const broken = await removeExcludedContainers('fabric', async () => { throw new Error('docker: not found') })
  assert.equal(broken.removed.length, 0)
  assert.match(broken.error, /docker: not found/)
})

// 0.3.9 review ER-3: whether the runtime watch's try starts the stack is decided from what Docker reports of its database
// container: gone (as after `supabase stop`) is a stop to respect, running is a database still coming up.
test('ER-3: the database container\'s state, as the watch reads it', async () => {
  const { containerStateFrom, databaseContainer } = await import(path.join(SRC, 'stackServices.ts'))
  assert.equal(containerStateFrom(''), 'absent')
  assert.equal(containerStateFrom('running\n'), 'running')
  assert.equal(containerStateFrom('restarting'), 'running')
  assert.equal(containerStateFrom('paused'), 'running')
  for (const st of ['exited', 'created', 'dead', 'removing']) assert.equal(containerStateFrom(st), 'stopped')
  assert.equal(containerStateFrom('something new'), 'unknown')
  const asked = []
  assert.equal(await databaseContainer('fabric', async (args) => { asked.push(args); return 'exited\n' }), 'stopped')
  assert.deepEqual(asked, [['ps', '-a', '--filter', 'name=^supabase_db_fabric$', '--format', '{{.State}}']])
  await assert.rejects(databaseContainer('fabric', async () => { throw new Error('Cannot connect to the Docker daemon') }), /Docker daemon/)
})
