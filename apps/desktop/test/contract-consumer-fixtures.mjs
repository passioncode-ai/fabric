// #region contract-consumer-fixtures — docs: docs/handoffs/2026-10-04-contract-consumer-regression.md#scope-and-contract
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

export const fixtureRoot = fileURLToPath(new URL('./fixtures/fabric-agent-contract/', import.meta.url))
export const CURRENT_COMMIT = 'df55c8c54a23251342a7ee57ba95642b7eb39e61'
export const LEGACY_COMMIT = '2ce392291c6668598d12cd38327e24696b5ca15c'
export const schemaPrefix = 'https://fabric.passioncode.ai/agent-contract/0.1.0/schemas/'
const currentSchemas = ['common', 'interop-agent-call', 'interop-capability', 'manifest', 'pipeline', 'service-common', 'service-well-known']
const positiveNames = ['interop-agent-call', 'manifest-mcp', 'pipeline', 'service-well-known-capabilities']
const expectedPaths = [
  ...currentSchemas.map(name => `current/schemas/${name}.schema.json`),
  ...positiveNames.map(name => `current/positive/${name}.json`),
  'legacy/schemas/common.schema.json', 'legacy/schemas/interop-agent-call.schema.json', 'LICENSE'
].sort()

/** Verify the complete recorded byte set first. Do not compile a partly verified bundle. */
export function loadPinnedFixtures(root = fixtureRoot) {
  const source = JSON.parse(readFileSync(resolve(root, 'SOURCE.json'), 'utf8'))
  assert.equal(source.format, 'fabric-contract-test-source/1')
  assert.equal(source.repository, 'https://github.com/passioncode-ai/fabric-agent-contract')
  assert.equal(source.version, '0.1.0')
  assert.equal(source.currentCommit, CURRENT_COMMIT)
  assert.equal(source.legacyNegativeControlCommit, LEGACY_COMMIT)
  assert.deepEqual(source.compiler, { ajv: '8.20.0', 'ajv-formats': '3.0.1' })
  assert.deepEqual(source.files.map(file => file.path).sort(), expectedPaths)
  const bytes = new Map()
  for (const file of source.files) {
    const path = resolve(root, file.path)
    assert.ok(path.startsWith(resolve(root) + sep), 'provenance path escapes the fixture root')
    const legacy = file.path.startsWith('legacy/')
    assert.equal(file.commit, legacy ? LEGACY_COMMIT : CURRENT_COMMIT, `${file.path}: wrong source commit`)
    const upstreamPath = file.path === 'LICENSE' ? 'LICENSE'
      : file.path.replace(/^(current|legacy)\/positive\//, 'fixtures/positive/').replace(/^(current|legacy)\//, '')
    assert.equal(file.upstreamPath, upstreamPath, `${file.path}: wrong upstream path`)
    const raw = readFileSync(path)
    assert.equal(createHash('sha256').update(raw).digest('hex'), file.sha256, `${file.path}: pinned schema/fixture byte drift`)
    bytes.set(file.path, raw)
  }
  return { source, bytes, document: path => JSON.parse(bytes.get(path).toString('utf8')) }
}

/** Same strict Draft 2020-12 compiler as the normative contract; no reimplemented pattern. */
export function compilePinnedSchemas(fixtures, revision = 'current') {
  assert.ok(revision === 'current' || revision === 'legacy', 'no unknown revision fallback')
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  const names = revision === 'current' ? currentSchemas : ['common', 'interop-agent-call']
  for (const name of names) ajv.addSchema(fixtures.document(`${revision}/schemas/${name}.schema.json`))
  const surfaces = revision === 'current' ? ['manifest', 'interop-agent-call', 'service-well-known', 'pipeline'] : ['interop-agent-call']
  const validators = Object.fromEntries(surfaces.map(name => {
    const validator = ajv.getSchema(`${schemaPrefix}${name}.schema.json`)
    assert.ok(validator, `compiled normative schema is missing: ${name}`)
    return [name, validator]
  }))
  return validators
}
// #endregion contract-consumer-fixtures
