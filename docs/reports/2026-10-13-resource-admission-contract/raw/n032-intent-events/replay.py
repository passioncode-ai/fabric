#!/usr/bin/env python3
import argparse,os,pathlib,shutil,subprocess,tempfile
p=argparse.ArgumentParser();p.add_argument('variant',choices=['independent','candidate','parent-digest-removed','cross-unit-before']);a=p.parse_args();base=pathlib.Path(__file__).resolve().parent
if not os.environ.get('N028_AGENT_SYNC_SCRIPT'):raise SystemExit('Set N028_AGENT_SYNC_SCRIPT to actual pinned installed source; do not install or substitute an algorithm')
with tempfile.TemporaryDirectory(prefix='n032-events-replay-') as d:
 root=pathlib.Path(d)
 for f in (base/'candidate').rglob('*.snapshot.txt'):
  target=root/str(f.relative_to(base/'candidate'))[:-len('.snapshot.txt')];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
 cmd=['node','--experimental-strip-types','--test']
 if a.variant=='independent':
  raise SystemExit(subprocess.run(['node','--experimental-strip-types','--test','--test-concurrency=1',str(base/'event-controls.mjs')],cwd=root,env=dict(os.environ,N032_EVENTS_SOURCE=(root/'apps/desktop/src/main/resourceWorkerInventory.ts').as_uri())).returncode)
 if a.variant!='candidate':
  shutil.copyfile(base/'controls'/a.variant/'source.snapshot.txt',root/'apps/desktop/src/main/resourceWorkerInventory.ts')
  shutil.copyfile(base/'controls'/a.variant/'test.snapshot.txt',root/'apps/desktop/test/resource-worker-inventory.test.mjs')
  cmd+=['--test-name-pattern='+('N032 retained orphan' if a.variant=='parent-digest-removed' else 'N032.*cross-unit')]
 raise SystemExit(subprocess.run(cmd+['apps/desktop/test/resource-worker-inventory.test.mjs'],cwd=root).returncode)
