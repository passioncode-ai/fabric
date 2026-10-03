// The app's stack and the disposable test stack exclude the same services (lifecycle LC-09).
// A service the app starts but the probes never exercise is one nobody tests; a service the app
// excludes that a probe needs would fail the probes first. Equality keeps the two honest.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { STACK_EXCLUDED_SERVICES } from '../src/main/stackServices.ts'

const repo = path.resolve(import.meta.dirname, '../../..')

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
