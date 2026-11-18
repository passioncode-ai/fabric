// 2026-11-18: Observatory was upgraded (0.42.0 to 0.42.1) under a running Fabric, and its stdio child kept answering
// `stale-server`: twenty board dispatch starts were refused until Fabric restarted. The client ends a stale child and
// makes the call once more on a new one; a new child that is stale too is a refusal, not a loop.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const { createObservatoryClient, isStaleServer } = await import(path.resolve(import.meta.dirname, '../src/main/observatoryMemory.ts'))
const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/stale-observatory-server.mjs')

test('a stale Observatory child is ended and the call is answered by a new one', async () => {
  const counter = path.join(mkdtempSync(path.join(tmpdir(), 'fabric-observatory-stale-')), 'starts')
  const client = createObservatoryClient(async () => ({ python: process.execPath, server: FIXTURE }), 30_000, [counter])
  try {
    const body = await client.call('observatory_checkpoint_write', {})
    assert.equal(body.workflowId, 'wf_0123456789abcdef')
    assert.equal(Number(readFileSync(counter, 'utf8')), 2, 'a new child answered')
    await client.call('observatory_checkpoint_write', {})
    assert.equal(Number(readFileSync(counter, 'utf8')), 2, 'the new child is kept')
  } finally {
    await client.close()
  }
})

test('a new child that is stale too is a refusal, not a loop', async () => {
  const counter = path.join(mkdtempSync(path.join(tmpdir(), 'fabric-observatory-stale-')), 'starts')
  const client = createObservatoryClient(async () => ({ python: process.execPath, server: FIXTURE }), 30_000, [counter, 'always-stale'])
  try {
    await assert.rejects(client.call('observatory_checkpoint_write', {}), /stale-server/)
    assert.equal(Number(readFileSync(counter, 'utf8')), 2, 'one new child, no more')
  } finally {
    await client.close()
  }
})

test('stale-server is read in both shapes Observatory may give', () => {
  assert.equal(isStaleServer({ error: 'stale-server', detail: 'x' }), true)
  assert.equal(isStaleServer({ error: { code: 'stale-server' } }), true)
  assert.equal(isStaleServer({ error: 'invalid-arguments' }), false)
  assert.equal(isStaleServer(undefined), false)
})
