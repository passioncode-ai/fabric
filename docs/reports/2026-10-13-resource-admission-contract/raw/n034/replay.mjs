import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const home = path.dirname(fileURLToPath(import.meta.url)), tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fabric-n034-replay-'))
const files = ['apps/desktop/src/main/resourcePoolRegistry.ts', 'apps/desktop/test/resource-pool-registry.test.mjs']
async function copy(from, to) { await fs.mkdir(path.dirname(to), {recursive:true}); await fs.copyFile(from, to) }
try {
  for (const f of files) await copy(path.join(home, 'source/current', f+'.snapshot.txt'), path.join(tmp,f))
  for (const f of ['apps/desktop/src/main/resourceHostPolicy.ts','apps/desktop/src/shared/resourceAdmission.ts']) await copy(path.join(home,'source/dependencies',f+'.snapshot.txt'),path.join(tmp,f))
  await fs.writeFile(path.join(tmp,'package.json'), '{"type":"module"}\n')
  if (process.argv.includes('--rejected')) await copy(path.join(home,'source/rejected/apps/desktop/src/main/resourcePoolRegistry.ts.snapshot.txt'),path.join(tmp,'apps/desktop/src/main/resourcePoolRegistry.ts'))
  const args = ['--experimental-strip-types','--test']; if (!process.argv.includes('--full')) args.push('--test-name-pattern=seal cache|head digest|discarded unsealed')
  args.push('apps/desktop/test/resource-pool-registry.test.mjs')
  const result=spawnSync(process.execPath,args,{cwd:tmp,stdio:'inherit',timeout:180000,env:{...process.env,N034_SOURCE:path.join(tmp,'apps/desktop/src/main/resourcePoolRegistry.ts')}})
  process.exitCode=result.status??2
} finally { await fs.rm(tmp,{recursive:true,force:true}) }
