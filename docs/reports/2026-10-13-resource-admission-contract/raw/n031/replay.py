#!/usr/bin/env python3
import argparse,os,pathlib,shutil,subprocess,tempfile
p=argparse.ArgumentParser();p.add_argument('variant',choices=['accepted','durability-before','uniqueness-before','host-binding-removed','false-completeness']);a=p.parse_args();base=pathlib.Path(__file__).resolve().parent
if not os.environ.get('N028_AGENT_SYNC_SCRIPT'):raise SystemExit('Set N028_AGENT_SYNC_SCRIPT to actual pinned installed source')
with tempfile.TemporaryDirectory(prefix='n031-replay-') as d:
 root=pathlib.Path(d)
 for f in (base/'accepted').rglob('*.snapshot.txt'):
  target=root/str(f.relative_to(base/'accepted'))[:-len('.snapshot.txt')];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
 src=root/'apps/desktop/src/main/resourceWorkerInventory.ts';test=root/'apps/desktop/test/resource-worker-inventory.test.mjs';env=dict(os.environ,N031_SOURCE=src.as_uri())
 if a.variant=='durability-before':shutil.copyfile(base/'rejected-first/apps/desktop/src/main/resourceWorkerInventory.ts.snapshot.txt',src)
 elif a.variant!='accepted':
  shutil.copyfile(base/'controls'/a.variant/'source.snapshot.txt',src);shutil.copyfile(base/'controls'/a.variant/'test.snapshot.txt',test)
 if a.variant in ['accepted','uniqueness-before','host-binding-removed','false-completeness']:
  patterns={'uniqueness-before':'retained duplicate','host-binding-removed':'host changes while|host or actual','false-completeness':'empty and registered'}
  cmd=['node','--experimental-strip-types','--test']
  if a.variant!='accepted':cmd+=['--test-name-pattern='+patterns[a.variant]]
  result=subprocess.run(cmd+[str(test)],cwd=root,env=env)
  if a.variant!='accepted' or result.returncode:raise SystemExit(result.returncode)
 probes=['durability.mjs'] if a.variant=='durability-before' else ['durability.mjs','directory-durability.mjs','controls.mjs']
 raise SystemExit(subprocess.run(['node','--experimental-strip-types','--test','--test-concurrency=1',*[str(base/'probes'/n) for n in probes]],cwd=root,env=env).returncode)
