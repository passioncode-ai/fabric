// Audit 2026-10-05 A7-002: a Fabric window holds only Fabric's own renderer document.
import assert from 'node:assert/strict'
import test from 'node:test'
import { externalLink, isAppDocument } from '../src/main/navigationGuard.ts'

const packaged = { indexFile: '/Applications/Fabric.app/Contents/Resources/app.asar/out/renderer/index.html' }
const dev = { devOrigin: 'http://localhost:5173', indexFile: '/repo/out/renderer/index.html' }

test('the renderer document, with any query or hash, is the app', () => {
  assert.equal(isAppDocument('file:///Applications/Fabric.app/Contents/Resources/app.asar/out/renderer/index.html?session=1#/p/x', packaged), true)
  assert.equal(isAppDocument('http://localhost:5173/?file=a#/e/1', dev), true)
})

test('anything else is not: another file, another origin, a data: page, garbage', () => {
  for (const target of ['file:///Users/me/Downloads/dropped.html', 'https://example.com/', 'http://localhost:5174/', 'data:text/html,<p>x</p>', 'javascript:alert(1)', 'not a url'])
    assert.equal(isAppDocument(target, dev.devOrigin ? dev : packaged), false, target)
  assert.equal(isAppDocument('http://localhost:5173/', packaged), false, 'a packaged app has no dev origin')
})

test('only web links go to the browser', () => {
  assert.equal(externalLink('https://agentclientprotocol.com/x'), 'https://agentclientprotocol.com/x')
  assert.equal(externalLink('mailto:a@example.com'), 'mailto:a@example.com')
  for (const target of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x', 'vscode://x', 'garbage']) assert.equal(externalLink(target), null, target)
})

test('a malformed escape in a file path is refused, not thrown', () => {
  assert.equal(isAppDocument('file:///Users/me/%E0%A4%A.html', packaged), false)
})
