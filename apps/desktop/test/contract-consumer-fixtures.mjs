// #region contract-consumer-fixtures — docs: docs/handoffs/2026-10-04-contract-consumer-regression.md#scope-and-contract
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

export const fixtureRoot = fileURLToPath(new URL('./fixtures/fabric-agent-contract/', import.meta.url))
export const CURRENT_COMMIT = 'd4c88315c290033867574ba0f5cc5069693077e0'
export const LEGACY_COMMIT = '2ce392291c6668598d12cd38327e24696b5ca15c'
export const schemaPrefix = 'https://fabric.passioncode.ai/agent-contract/0.1.0/schemas/'
// fabric-project-comms/0.1 (DEC-0022, accepted 2026-10-05) joins at d4c8831: its schemas, and every comms
// fixture the contract's own catalogue grades, so this consumer is held to the same verdicts.
export const COMMS_SURFACES = ['comms-complete', 'comms-fence', 'comms-message', 'comms-page', 'comms-refusal', 'comms-status', 'comms-submit']
const currentSchemas = ['common', 'interop-agent-call', 'interop-capability', 'manifest', 'pipeline', 'service-common', 'service-well-known', 'comms-common', ...COMMS_SURFACES]
const positiveNames = ['interop-agent-call', 'manifest-mcp', 'pipeline', 'service-well-known-capabilities',
  'comms-complete', 'comms-fence', 'comms-page', 'comms-refusal', 'comms-status', 'comms-submit-reply', 'comms-submit-request']
const negativeNames = ['comms-fence-without-generation', 'comms-page-redacted-with-body', 'comms-refusal-unknown-code', 'comms-status-bad-state',
  'comms-submit-body-too-long', 'comms-submit-forged-estate', 'comms-submit-forged-sender', 'comms-submit-reply-without-target',
  'comms-submit-request-without-details', 'comms-submit-too-many-artifacts']
export const expectedPaths = [
  ...currentSchemas.map(name => `current/schemas/${name}.schema.json`),
  ...positiveNames.map(name => `current/positive/${name}.json`),
  ...negativeNames.map(name => `current/negative/${name}.json`),
  'current/catalogue.json',
  'legacy/schemas/common.schema.json', 'legacy/schemas/interop-agent-call.schema.json', 'LICENSE'
].sort()

/** Where a vendored file lives upstream: the one mapping the loader checks and the repin script copies by. */
export function upstreamPathOf(path) {
  if (path === 'LICENSE') return 'LICENSE'
  if (path === 'current/catalogue.json') return 'fixtures/catalogue.json'
  return path.replace(/^(current|legacy)\/(positive|negative)\//, 'fixtures/$2/').replace(/^(current|legacy)\//, '')
}

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
    assert.equal(file.upstreamPath, upstreamPathOf(file.path), `${file.path}: wrong upstream path`)
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
/** The comms surfaces, compiled the same strict way, keyed by the schema file name the catalogue uses. */
export function compileCommsValidators(fixtures) {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  for (const name of currentSchemas) ajv.addSchema(fixtures.document(`current/schemas/${name}.schema.json`))
  return Object.fromEntries(COMMS_SURFACES.map(name => {
    const validator = ajv.getSchema(`${schemaPrefix}${name}.schema.json`)
    assert.ok(validator, `compiled normative comms schema is missing: ${name}`)
    return [`${name}.schema.json`, validator]
  }))
}
// #endregion contract-consumer-fixtures
