import assert from 'node:assert/strict'
import test from 'node:test'
import { runPsqlAsync } from './bounded-psql.mjs'

// The helper is command-agnostic; /bin/sh stands in for psql so the deadline is tested without a database.
test('a child that never exits is killed at the deadline and the failure names what was stuck', async () => {
  const started = Date.now()
  await assert.rejects(runPsqlAsync('/bin/sh', ['-c', 'cat >/dev/null; sleep 30'], 'select 1;', { timeoutMs: 300, label: 'planted hang' }),
    /planted hang: psql did not finish within 0 s and was killed \(stdin closed; stderr: empty\)/)
  assert.ok(Date.now() - started < 5_000, 'the deadline, not the child, ended the wait')
})

test('a child that exits gives its code, stdout and stderr; a non-zero code is the caller\'s to judge', async () => {
  assert.deepEqual(await runPsqlAsync('/bin/sh', ['-c', 'read l; echo "got $l"; echo warn >&2; exit 3'], 'row\n'),
    { code: 3, stdout: 'got row\n', stderr: 'warn\n' })
})

test('a child that exits without reading its stdin still settles', async () => {
  assert.equal((await runPsqlAsync('/bin/sh', ['-c', 'exit 0'], 'x'.repeat(1 << 20))).code, 0)
})
