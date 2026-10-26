// CO-348: a Claude Code start marks its folder trusted only while the person's switch in Settings is on, and never when
// the environment says FABRIC_TRUST_AGENT_FOLDERS=0. Only native spawn and Claude's state file are replaced: a fake
// `claude` on PATH makes the runner available, and the trust function records the folders it was asked about.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const bin = mkdtempSync(path.join(tmpdir(), 'fabric-trust-bin-'))
writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nexit 0\n')
chmodSync(path.join(bin, 'claude'), 0o755)
process.env.PATH = `${bin}${path.delimiter}${process.env.PATH ?? ''}`

const { PtyManager, setFolderTrust } = await import('../src/main/pty.ts')

async function start() {
  const native = { pid: 4_194_307, resize() {}, write() {}, kill() {}, onData() {}, onExit() {} }
  const manager = new PtyManager({ append: async () => ({ seq: 1 }) }, randomUUID(),
    { onData() {}, onExit() {} }, undefined, () => native, undefined, () => ({ kind: 'person', id: 'operator' }))
  // Claude Code connects to Fabric's surface; with no bundle here the launch is refused AFTER the trust step, which is
  // what this test reads. Either outcome of the launch is fine: the folders asked about are the answer.
  await manager.open(randomUUID(), process.cwd(), 'claude-code', null, 'ask').catch(() => null)
}

test('the switch on: the folder is marked trusted before Claude Code starts', async () => {
  const asked = []
  setFolderTrust(async (folder) => { asked.push(folder); return 'granted' }, () => true)
  await start()
  assert.deepEqual(asked, [process.cwd()])
})

test('the switch off: Claude Code starts at its own trust question, nothing is written', async () => {
  const asked = []
  setFolderTrust(async (folder) => { asked.push(folder); return 'granted' }, () => false)
  await start()
  assert.deepEqual(asked, [])
})

test('the environment variable still turns it off when the switch is left unwired', async () => {
  const asked = []
  process.env.FABRIC_TRUST_AGENT_FOLDERS = '0'
  try {
    setFolderTrust(async (folder) => { asked.push(folder); return 'granted' })
    await start()
    assert.deepEqual(asked, [])
  } finally {
    delete process.env.FABRIC_TRUST_AGENT_FOLDERS
  }
  setFolderTrust(async (folder) => { asked.push(folder); return 'granted' })
  await start()
  assert.deepEqual(asked, [process.cwd()])
})
