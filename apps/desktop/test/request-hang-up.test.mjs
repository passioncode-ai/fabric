// Audit 2026-10-05 A7-026: a session-bearer MCP request whose caller hung up kept its never-settling
// `handleRequest` promise for the life of the session. The handling is raced against the hang-up, as the
// external path's is (I3 E-2).
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { untilAnsweredOrGone } from '../src/main/hangUp.ts'

const never = () => new Promise(() => {})
const within = (p, ms) => Promise.race([p.then(() => 'settled'), new Promise((r) => setTimeout(() => r('pending'), ms))])

{
  const res = new EventEmitter()
  const handled = untilAnsweredOrGone(never(), res)
  assert.equal(await within(handled, 20), 'pending', 'still answering while the caller is there')
  res.emit('close')
  assert.equal(await within(handled, 20), 'settled', 'the caller hanging up ends the wait')
  assert.equal(res.listenerCount('close'), 0, 'no listener is left behind')
}
{
  const res = new EventEmitter()
  await untilAnsweredOrGone(Promise.resolve('answered'), res)
  assert.equal(res.listenerCount('close'), 0, 'an answered request leaves no listener either')
  await assert.rejects(untilAnsweredOrGone(Promise.reject(new Error('handshake failed')), new EventEmitter()), /handshake failed/,
    'a failure of the handling still reaches the caller (the handshake path records it)')
}
{
  const res = Object.assign(new EventEmitter(), { destroyed: true })
  assert.equal(await within(untilAnsweredOrGone(never(), res), 20), 'settled', 'a caller already gone is not waited for')
}
// Both session-bearer awaits in the surface go through it; none awaits `handleRequest` bare.
{
  const src = readFileSync(path.join(import.meta.dirname, '../src/main/agentSurface.ts'), 'utf8')
  assert.equal(/await (st\.)?transport\.handleRequest\(/.test(src), false, 'no bare await of handleRequest')
  assert.equal(src.match(/untilAnsweredOrGone\((st\.)?transport\.handleRequest\(/g)?.length, 2)
}
console.log('PASS request hang-up: a session request ends when its caller goes, answered or not')
