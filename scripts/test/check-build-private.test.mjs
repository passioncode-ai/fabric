// The owner, 2026-11-20: the built app holds nothing of one machine. The gate reads a built folder, names where a finding
// is and from which source, never the value, and does not take a word inside another word for a name.
import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const GATE = path.resolve('scripts/check-build-private.mjs')
const made = []
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

function build(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'build-private-'))
  made.push(dir)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    writeFileSync(path.join(dir, name), text)
  }
  return dir
}
function gate(folder, env = {}) {
  const none = path.join(tmpdir(), 'build-private-none')
  const r = spawnSync(process.execPath, [GATE, folder], { encoding: 'utf8',
    env: { ...process.env, PASSIONCODE_CHECK_PRIVATE: path.join(none, 'checker.py'), FABRIC_USER_DATA: none, FABRIC_OWNER_TERMS: path.join(none, 'terms.txt'), ...env } })
  return { status: r.status, out: r.stdout + r.stderr }
}

test('a clean build passes, saying which readings could not run here', () => {
  const r = gate(build({ 'main/index.js': 'export const a = 1\n' }))
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /NOT_RUN \(denylist reading\)/)
  assert.match(r.out, /NOT_RUN \(owner values\)/)
})

test('a projects-root path, a vault slot or a home path in the build fails it, by file and line', () => {
  const r = gate(build({ 'main/a.js': 'ok\nconst root = "~/DATA/fabric"\n', 'main/b.js': 'const s = "fabric/prod/XAI_API_KEY"\n', 'renderer/c.js': `x\ny\n"${'/'}Users/someone/x"\n` }))
  assert.equal(r.status, 1)
  assert.match(r.out, /FINDING projects-root main\/a\.js:2/)
  assert.match(r.out, /FINDING vault-slot main\/b\.js:1/)
  assert.match(r.out, /FINDING home-path renderer\/c\.js:3/)
})

test('a value of this machine\'s settings fails the build by its source, never printed; a word inside a word is not a name', () => {
  const home = build({
    'ud/people-ask-routes.json': JSON.stringify({ routes: [{ organization: 'Zorgon Labs', target: '79000000-0000-4000-8000-0000000000d1', businesses: ['zorgon', 'personal'], owners: ['zorgon-org'] }] }),
    'terms.txt': '# local\nКлара\n'
  })
  const env = { FABRIC_USER_DATA: path.join(home, 'ud'), FABRIC_OWNER_TERMS: path.join(home, 'terms.txt') }
  const bad = gate(build({ 'main/a.js': 'route to 79000000-0000-4000-8000-0000000000d1\n', 'main/b.js': '// например Кларе... нет: Клара\n' }), env)
  assert.equal(bad.status, 1)
  assert.match(bad.out, /FINDING owner-value people-ask-routes\.target main\/a\.js:1/)
  assert.match(bad.out, /FINDING owner-value fabric-owner-terms main\/b\.js:1/)
  for (const v of ['79000000-0000-4000-8000-0000000000d1', 'Клара', 'Zorgon']) assert.ok(!bad.out.includes(v), `${v} reached the output`)
  const ok = gate(build({ 'main/a.js': '// Кларнет, personal settings, zorgonian\n' }), env)
  assert.equal(ok.status, 0, ok.out)
})
