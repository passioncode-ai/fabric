// Every MCP server and client Fabric runs announces the app's own version (0.3.5 verification, iteration 1, PL-5):
// a literal said 0.4.0 in a 0.3.5 build, and 0.1.0 elsewhere.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const { APP_VERSION } = await import('../src/shared/appVersion.ts')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('APP_VERSION is package.json\'s version', () => assert.equal(APP_VERSION, pkg.version))

test('no MCP Server, McpServer or Client in main names a literal version', () => {
  const dir = new URL('../src/main/', import.meta.url).pathname
  const offenders = []
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const src = readFileSync(path.join(dir, f), 'utf8')
    for (const m of src.matchAll(/new (?:Server|McpServer|Client)\(\s*\{[^}]*version:\s*['"][0-9][^'"]*['"]/g)) offenders.push(`${f}: ${m[0].replace(/\s+/g, ' ')}`)
  }
  assert.deepEqual(offenders, [])
})
