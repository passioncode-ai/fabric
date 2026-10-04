// #region executor-auth-test — docs: docs/ux/scenarios.md#scn-126-first-run-name-look-coding-agents-where-to-start
// Real disposable processes, exact supported vendor builds; no installed provider or credentials.
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const { detectExecutors } = await import('../src/main/executorDetect.ts')
if (process.platform === 'win32') { console.log('SKIP executor auth process fixtures: POSIX executable/process-group tests for a macOS-only reader'); process.exit(0) }
const bin = mkdtempSync(path.join(tmpdir(), 'fabric-auth-fixture-'))
const fixture = (body) => {
  const file = path.join(bin, 'claude')
  writeFileSync(file, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2.1.289 (Claude Code)"; exit 0; fi\n[ "$1" = "auth" ] && [ "$2" = "status" ] && [ "$3" = "--json" ] || exit 2\n${body}\n`)
  chmodSync(file, 0o755)
  return file
}
const env = { PATH: '/usr/bin:/bin', HOME: bin, CLAUDE_CONFIG_DIR: path.join(bin, 'owned-profile') }
try {
  fixture(`echo invoked > '${path.join(bin, 'initial-invoked')}'; echo '{"loggedIn":true,"authMethod":"claude.ai","email":"private@example.invalid","token":"SECRET_SENTINEL"}'`)
  const [row] = await detectExecutors([{ id: 'claude-code', label: 'Claude Code', program: 'claude', connected: false }], { env: { ...env, PATH: bin }, authTimeoutMs: 5000 })
  const supportedRuntime = process.platform === 'darwin' && process.arch === 'arm64'
  assert.equal(row.authentication?.state, supportedRuntime ? 'authenticated' : 'unsupported', 'actual detection never certifies an unobserved runtime')
  if (!supportedRuntime) assert.throws(() => readFileSync(path.join(bin, 'initial-invoked')), { code: 'ENOENT' }, 'unverified runtime never runs status')
  assert.equal(row.connected, false, 'authentication never grants Fabric tool connectivity')
  assert.equal(JSON.stringify(row).includes('SECRET_SENTINEL'), false)
  assert.equal(JSON.stringify(row).includes('private@'), false)

  const { observeExecutorAuth } = await import('../src/main/executorAuth.ts')
  // Scheduling headroom for a loaded host: these cases are about classification; the timeout case
  // waits on a 30 s sleep, so any budget still proves it.
  const observe = (over = {}) => observeExecutorAuth({ id: 'claude-code', version: '2.1.289', file: path.join(bin, 'claude'), env, timeoutMs: 3000, platform: 'darwin', arch: 'arm64', ...over })
  const check = async (body, state, reason = null) => {
    fixture(body)
    const result = await observe()
    assert.equal(result.state, state)
    assert.equal(result.reason, reason)
    assert.equal(JSON.stringify(result).includes('SECRET_SENTINEL'), false)
    return result
  }
  await check(`echo '{"loggedIn":false,"authMethod":"none"}'; exit 1`, 'not-authenticated')
  await check(`echo '{"loggedIn":"true","authMethod":"claude.ai","token":"SECRET_SENTINEL"}'`, 'unknown', 'invalid-response')
  await check(`echo '{"loggedIn":true}'; exit 1`, 'unknown', 'invalid-response')
  await check(`echo '{"loggedIn":false}'; exit 0`, 'unknown', 'invalid-response')
  await check(`echo 'SECRET_SENTINEL' >&2; exit 2`, 'unknown', 'invalid-response')
  await check(`exec /bin/sleep 30`, 'unknown', 'timeout')
  await check(`head -c 40000 /dev/zero >&2`, 'unknown', 'output-limit')
  await check(`head -c 17000 /dev/zero; head -c 17000 /dev/zero >&2`, 'unknown', 'output-limit')
  assert.equal((await check(`echo '{"loggedIn":true,"authMethod":"SECRET_SENTINEL"}'`, 'authenticated')).method, null, 'unknown method values are never exposed')
  fixture(`echo invoked > '${path.join(bin, 'invoked')}'`)
  assert.equal((await observe({ version: '2.1.290' })).state, 'unsupported')
  assert.equal((await observe({ id: 'unknown-vendor' })).state, 'unsupported')
  assert.equal((await observe({ platform: 'win32' })).state, 'unsupported')
  assert.equal((await observe({ platform: 'linux' })).state, 'unsupported')
  assert.equal((await observe({ arch: 'x64' })).state, 'unsupported')
  assert.throws(() => readFileSync(path.join(bin, 'invoked')), { code: 'ENOENT' }, 'unsupported builds never invoke a guessed command')
  assert.equal((await observe({ file: path.join(bin, 'absent') })).reason, 'unavailable')
  fixture(`[ "$CLAUDE_CONFIG_DIR" = '${env.CLAUDE_CONFIG_DIR}' ] || exit 2; echo '{"loggedIn":true,"authMethod":"oauth_token"}'`)
  assert.equal((await observe()).method, 'oauth_token', 'the status reader uses the same supplied profile environment')

  const codex = path.join(bin, 'codex')
  const codexFixture = (body) => { writeFileSync(codex, `#!/bin/sh\n[ "$1" = "login" ] && [ "$2" = "status" ] || exit 2\n${body}\n`); chmodSync(codex, 0o755) }
  const codexObserve = () => observeExecutorAuth({ id: 'codex', version: '0.160.0', file: codex, env, timeoutMs: 3000, platform: 'darwin', arch: 'arm64' })
  codexFixture(`echo 'Logged in using ChatGPT' >&2`)
  const signedIn = await codexObserve()
  assert.deepEqual([signedIn.state, signedIn.method], ['authenticated', 'chatgpt'])
  codexFixture(`echo 'Not logged in' >&2; exit 1`)
  assert.equal((await codexObserve()).state, 'not-authenticated')
  codexFixture(`echo 'Logged in using ChatGPT SECRET_SENTINEL' >&2`)
  assert.equal((await codexObserve()).state, 'unknown', 'unexpected suffix cannot be treated as an approved status')
  codexFixture(`echo 'Logged in using an API key - SECRET_SENTINEL' >&2`)
  assert.equal((await codexObserve()).state, 'unknown', 'unmeasured credential-bearing syntax is unsupported by the parser')
  fixture(`/bin/sleep 30 & echo $! > '${path.join(bin, 'child.pid')}'; echo '{"loggedIn":true,"authMethod":"claude.ai"}'`)
  assert.equal((await observe({ timeoutMs: 1000 })).state, 'authenticated', 'parent exit settles after bounded drain, not descendant EOF')
  const pid = Number(readFileSync(path.join(bin, 'child.pid'), 'utf8'))
  const alive = () => { try { process.kill(pid, 0); return true } catch { return false } }
  for (const until = Date.now() + 3000; alive() && Date.now() < until;) await new Promise((r) => setTimeout(r, 25))
  assert.equal(alive(), false, 'successful status reads kill their own remaining process group')
  console.log('PASS executor auth: exact builds, environment, strict whitelisted status, missing/hung/oversize/secret/unsupported negative controls, group cleanup')
} finally { rmSync(bin, { recursive: true, force: true }) }
// #endregion executor-auth-test
