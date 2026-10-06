// P-10: how Fabric starts its helper programs (ACP shell, stdio bridge) built and from source.
// #region helper-process — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#amendment-2--2026-10-05-the-acp-shell-is-the-launch-path-and-sign-in-is-the-persons
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { helperCommand } from '../src/main/helperProcess.ts'

test('in the built app a helper is a bundle entry run by Electron as Node', () => {
  const c = helperCommand('acp-shell', '/App/Resources/app.asar/out/main', '/App/MacOS/Fabric', true, (f) => f.endsWith('acp-shell.js'))
  assert.deepEqual(c, { program: '/App/MacOS/Fabric', args: ['/App/Resources/app.asar/out/main/acp-shell.js'], env: { ELECTRON_RUN_AS_NODE: '1' } })
})

test('from the sources it is the TypeScript entry under type stripping, with no Electron switch', () => {
  const here = path.resolve(import.meta.dirname, '../src/main')
  const c = helperCommand('mcp-bridge', here, process.execPath, false)
  assert.deepEqual(c, { program: process.execPath, args: ['--experimental-strip-types', path.join(here, 'mcpStdioBridgeMain.ts')], env: {} })
  assert.ok(path.isAbsolute(c.program), 'ACP needs an absolute command for a stdio server')
})

test('a build without the helper refuses rather than starting something else', () => {
  assert.throws(() => helperCommand('acp-shell', '/nowhere', '/x', true, () => false), /acp-shell helper is missing/)
})
// #endregion helper-process
