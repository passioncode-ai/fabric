// #region contract-consumer-fixtures — docs: docs/handoffs/2026-10-04-contract-consumer-regression.md#scope-and-contract
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

export const fixtureRoot = fileURLToPath(new URL('./fixtures/fabric-agent-contract/', import.meta.url))
export const CURRENT_COMMIT = 'edc88a6674c851bb328b08a269ca0ea5bd39b5f8'
export const LEGACY_COMMIT = '2ce392291c6668598d12cd38327e24696b5ca15c'
export const schemaPrefix = 'https://fabric.passioncode.ai/agent-contract/0.1.0/schemas/'
// fabric-project-comms/0.1 (DEC-0022, accepted 2026-10-05) joins at d4c8831: its schemas, and every comms
// fixture the contract's own catalogue grades, so this consumer is held to the same verdicts. DEC-0073 (pinned at
// edc88a6) adds every tool's argument schema, the one receipt and the project directory, and the digest vectors.
export const COMMS_SURFACES = ['comms-cancel', 'comms-claim', 'comms-complete', 'comms-directory', 'comms-directory-args', 'comms-effect-begin',
  'comms-enroll', 'comms-fence', 'comms-fenced', 'comms-list', 'comms-message', 'comms-message-ref', 'comms-page', 'comms-progress', 'comms-receipt',
  'comms-reconcile', 'comms-refusal', 'comms-reply', 'comms-responder-replace', 'comms-status', 'comms-status-args', 'comms-submit']
// model-profile and registry-models: service-well-known refers to them since the repin to edc88a6.
const currentSchemas = ['common', 'interop-agent-call', 'interop-capability', 'manifest', 'pipeline', 'service-common', 'model-profile', 'registry-models', 'service-well-known', 'comms-common', ...COMMS_SURFACES]
const positiveNames = ['interop-agent-call', 'manifest-mcp', 'pipeline', 'service-well-known-capabilities',
  'comms-cancel', 'comms-claim', 'comms-complete', 'comms-directory', 'comms-directory-args', 'comms-effect-begin', 'comms-enroll', 'comms-fence',
  'comms-fenced', 'comms-list', 'comms-list-empty', 'comms-message-ref', 'comms-page', 'comms-progress', 'comms-receipt-claim', 'comms-receipt-enroll',
  'comms-receipt-nothing-queued', 'comms-receipt-submit', 'comms-reconcile', 'comms-refusal', 'comms-reply-participant', 'comms-reply-responder',
  'comms-responder-replace', 'comms-status', 'comms-status-args', 'comms-status-epoch', 'comms-submit-reply', 'comms-submit-request']
const negativeNames = ['comms-cancel-forged-sender', 'comms-cancel-reason-too-long', 'comms-claim-forged-project', 'comms-claim-without-idempotency',
  'comms-directory-args-forged-estate', 'comms-directory-args-limit-over-page', 'comms-directory-entry-with-content', 'comms-directory-entry-with-generation',
  'comms-directory-over-page', 'comms-directory-snapshot-with-count', 'comms-directory-with-count', 'comms-effect-begin-without-fence',
  'comms-enroll-forged-principal', 'comms-fence-without-generation', 'comms-fenced-without-fence', 'comms-list-limit-over-page',
  'comms-message-ref-without-message', 'comms-page-redacted-with-body', 'comms-progress-note-too-long', 'comms-receipt-attempt-with-seq',
  'comms-receipt-not-ok', 'comms-receipt-request-with-seq', 'comms-receipt-slot-with-holder', 'comms-receipt-with-seq', 'comms-receipt-without-ok',
  'comms-receipt-without-repeated', 'comms-reconcile-unobserved', 'comms-reconcile-without-digest', 'comms-refusal-unknown-code',
  'comms-reply-fence-and-replyto', 'comms-reply-neither', 'comms-responder-replace-duplicate-transfer', 'comms-status-args-forged-estate',
  'comms-status-bad-state', 'comms-status-epoch-zero', 'comms-submit-body-too-long', 'comms-submit-forged-estate', 'comms-submit-forged-sender',
  'comms-submit-reply-without-target', 'comms-submit-request-without-details', 'comms-submit-too-many-artifacts']
export const expectedPaths = [
  ...currentSchemas.map(name => `current/schemas/${name}.schema.json`),
  ...positiveNames.map(name => `current/positive/${name}.json`),
  ...negativeNames.map(name => `current/negative/${name}.json`),
  // The contract's digest vectors (DEC-0043): Fabric's commsDigest reproduces each (board-service.test.mjs).
  'current/vectors/canonical.json',
  'current/catalogue.json',
  'legacy/schemas/common.schema.json', 'legacy/schemas/interop-agent-call.schema.json', 'LICENSE'
].sort()

/** Where a vendored file lives upstream: the one mapping the loader checks and the repin script copies by. */
export function upstreamPathOf(path) {
  if (path === 'LICENSE') return 'LICENSE'
  if (path === 'current/catalogue.json') return 'fixtures/catalogue.json'
  return path.replace(/^(current|legacy)\/(positive|negative|vectors)\//, 'fixtures/$2/').replace(/^(current|legacy)\//, '')
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
