// scripts/check-workflows.py: a workflow parses, names its jobs, and a scheduled run never cancels a push run.
// 2026-10-22: ci.yml's group `ci-${{ github.ref }}` with cancel-in-progress let the nightly schedule cancel push run
// 39699805163 on main; the group now names the event, and this gate refuses a workflow that does not.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..','..')
const lint=(...files)=>spawnSync('python3',[path.join(root,'scripts/check-workflows.py'),...files],{cwd:root,encoding:'utf8'})
const workflow=(on,group,cancel=true)=>{
 const dir=mkdtempSync(path.join(tmpdir(),'fabric-workflows-')),file=path.join(dir,'w.yml')
 writeFileSync(file,'name: w\non:\n'+on+'\nconcurrency:\n  group: '+group+'\n  cancel-in-progress: '+cancel+'\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n')
 return file
}
const PUSH_AND_SCHEDULE="  push:\n    branches: ['**']\n  schedule:\n    - cron: '0 21 * * *'"
test('a schedule in the same cancel-in-progress group as a push is refused; naming the event passes',()=>{
 const bad=lint(workflow(PUSH_AND_SCHEDULE,'ci-${{ github.ref }}'))
 assert.equal(bad.status,1,bad.stdout);assert.match(bad.stdout,/scheduled run cancels a push run/)
 const good=lint(workflow(PUSH_AND_SCHEDULE,'ci-${{ github.ref }}-${{ github.event_name }}'))
 assert.equal(good.status,0,good.stdout+good.stderr)
})
test('no schedule, or no cancel-in-progress, needs no event in the group',()=>{
 assert.equal(lint(workflow("  push:\n    branches: ['**']",'ci-${{ github.ref }}')).status,0)
 assert.equal(lint(workflow(PUSH_AND_SCHEDULE,'release-${{ github.ref }}',false)).status,0)
})
test("this repository's workflows pass",()=>{const r=lint();assert.equal(r.status,0,r.stdout+r.stderr)})
