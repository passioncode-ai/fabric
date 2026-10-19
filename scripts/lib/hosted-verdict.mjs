// The hosted ci verdict for one commit, for the workspace publication (2026-10-19).
//
// The publication runs `scripts/ci.sh fast` before it publishes a changed Fabric source. On the operator's machine,
// at load 30 to 200, that run failed on timing tests or hit its time limit three runs in a row, while the hosted ci,
// the same `ci.sh fast` on a clean runner, was green on the very commit. A verdict that already exists for the exact
// commit stands (lifecycle LC-03, proportional); anything short of it is no verdict and the local gate runs.
import { execFile } from 'node:child_process'

const REPO = 'passioncode-ai/fabric'
const SHA = /^[0-9a-f]{40}$/

function ghRuns(sha) {
  return new Promise((resolve, reject) => {
    execFile('gh', ['run', 'list', '--repo', REPO, '--workflow', 'ci', '--commit', sha, '--limit', '10',
      '--json', 'headSha,status,conclusion,databaseId,createdAt'], { encoding: 'utf8', timeout: 30_000, windowsHide: true },
    (error, stdout) => (error ? reject(error) : resolve(stdout)))
  })
}

/** `{green: true, run}` only when the newest finished ci run on exactly `sha` succeeded; else `{green: false, why}`. */
export async function hostedCiVerdict(sha, { exec = ghRuns } = {}) {
  if (!SHA.test(String(sha))) return { green: false, why: 'not a full commit id' }
  let runs
  try {
    runs = JSON.parse(await exec(sha))
  } catch (e) {
    return { green: false, why: e instanceof Error ? e.message.split('\n')[0] : String(e) }
  }
  if (!Array.isArray(runs)) return { green: false, why: 'gh answered something that is not a run list' }
  const finished = runs.filter((r) => r && r.headSha === sha && r.status === 'completed')
    .sort((a, b) => (b.databaseId ?? 0) - (a.databaseId ?? 0))
  if (!finished.length) return { green: false, why: 'no finished ci run on this commit' }
  return finished[0].conclusion === 'success'
    ? { green: true, run: finished[0].databaseId }
    : { green: false, why: `the newest ci run on this commit ended ${finished[0].conclusion}` }
}
