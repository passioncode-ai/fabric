// #region onboarding-reason-negative — docs: docs/handoffs/2026-10-04-co179-native-review/README.md#negative-control
/** Bounded author-worktree render mutation. Never production injection or DOM editing.
 * Run only with --run in the isolated author branch. Uses the unchanged CO179 host.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { prepareFixture, scenarioConfig, MARKER } from './onboarding-visual-native-harness.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sheet = path.join(repo, 'apps/desktop/src/renderer/src/Onboarding.launch.css')
const evidenceBase = path.join(repo, 'docs/handoffs/2026-10-04-co179-native-review/raw')
let evidence = evidenceBase
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const ACCEPTED = '4949e5603177dc1374850b85ab7c33a2fcd940f682a9b95b9ee5ee5ca13a9cff'
const MUTANT = '\n/* TEST-OWNED NEGATIVE CONTROL: never imported by normal product source. */\n.onboarding-launch .choice.disabled > span > .muted { visibility: hidden; }\n'
function command(program, args, label) {
  const r = spawnSync(program, args, { cwd: repo, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  fs.writeFileSync(path.join(evidence, `${label}.log`), `${r.stdout ?? ''}${r.stderr ?? ''}`)
  assert.equal(r.status, 0, `${label}: ${r.error?.message ?? `exit ${r.status}`}`)
  return r.stdout
}
function capture(id, mode, overrides) {
  const fixture = prepareFixture(scenarioConfig(mode, overrides))
  const require = createRequire(path.join(repo, 'apps/desktop/package.json'))
  command(require('electron'), [path.join(repo, 'apps/desktop/test/onboarding-visual-native-harness.mjs'), '--fixture', fixture, '--probe'], `${id}-host`)
  const receipt = JSON.parse(fs.readFileSync(path.join(fixture, 'probe.json'), 'utf8'))
  assert.deepEqual(receipt.capture.boundary.before, receipt.capture.boundary.after)
  assert.deepEqual(receipt.observed.initial, receipt.capture.boundary.before)
  const image = fs.readFileSync(path.join(fixture, 'page.png'))
  assert.equal(hash(image), receipt.capture.sha256)
  assert.equal(receipt.sourcePins['renderer/src/Onboarding.launch.css'], hash(fs.readFileSync(sheet)))
  for (const [source, target] of [['page.png', `${id}.png`], ['probe.json', `${id}.json`], [MARKER, `${id}-marker.json`]])
    fs.copyFileSync(path.join(fixture, source), path.join(evidence, target))
  return { id, mode, overrides, png: `${id}.png`, receipt: `${id}.json`, cssSha256: receipt.sourcePins['renderer/src/Onboarding.launch.css'], pngSha256: receipt.capture.sha256, tier: 'hidden-actual-Electron-render-not-CUA', pixelReview: 'PENDING independent inspection' }
}
export function run() {
  assert.ok(path.basename(repo).startsWith('fabric-co179-native-review-'), 'isolated task worktree required')
  assert.equal(spawnSync('git', ['branch', '--show-current'], { cwd: repo, encoding: 'utf8' }).stdout.trim(), 'codex/co179-native-review-20261004', 'author branch required')
  const normal = fs.readFileSync(sheet)
  assert.equal(hash(normal), ACCEPTED, 'accepted CSS drift: review before mutation')
  if (fs.existsSync(evidenceBase)) evidence = path.join(repo, 'docs/handoffs/2026-10-04-co179-native-review/replays', randomUUID())
  assert.ok(!fs.existsSync(evidence), 'fresh evidence directory required; preserve earlier slice')
  fs.mkdirSync(evidence, { recursive: true })
  fs.writeFileSync(path.join(evidence, 'accepted-Onboarding.launch.css'), normal)
  fs.writeFileSync(path.join(evidence, 'missing-reason.mutant.css'), MUTANT)
  const matrix = []
  try {
    command('pnpm', ['--filter', '@fabric/desktop', 'build'], 'accepted-build')
    for (const locale of ['en', 'ru']) {
      matrix.push(capture(`normal-reason-${locale}`, 'balanced', { locale, theme: 'dark', width: 1440, height: 1200 }))
      matrix.push(capture(`normal-single-light-${locale}-960`, 'single', { locale, theme: 'light', width: 960, height: 900 }))
    }
    matrix.push(capture('normal-balanced-dark-ru-640', 'balanced', { locale: 'ru', theme: 'dark', width: 640, height: 900 }))
    matrix.push(capture('normal-balanced-light-en-2x', 'balanced', { locale: 'en', theme: 'light', zoomFactor: 2, width: 1440, height: 1200 }))
    const mutant = Buffer.concat([normal, Buffer.from(MUTANT)])
    fs.writeFileSync(path.join(evidence, 'mutated-Onboarding.launch.css'), mutant)
    fs.writeFileSync(sheet, mutant)
    command('pnpm', ['--filter', '@fabric/desktop', 'build'], 'mutant-build')
    for (const locale of ['en', 'ru']) matrix.push(capture(`mutant-reason-${locale}`, 'balanced', { locale, theme: 'dark', width: 1440, height: 1200 }))
  } finally {
    fs.writeFileSync(sheet, normal)
    assert.equal(hash(fs.readFileSync(sheet)), ACCEPTED, 'accepted CSS restore failed')
    command('pnpm', ['--filter', '@fabric/desktop', 'build'], 'restored-build')
    fs.writeFileSync(path.join(evidence, 'index.json'), JSON.stringify({ acceptedCssSha256: ACCEPTED, acceptedSourceRestored: true, matrix, nativeAcceptance: 'NOT_RUN by this author; root CUA owned separately' }, null, 2) + '\n')
  }
  console.log(JSON.stringify({ captures: matrix.length, evidence: path.relative(repo, evidence), acceptedSourceRestored: true }))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--run'], 'only explicit --run supported')
  run()
}
// #endregion onboarding-reason-negative
