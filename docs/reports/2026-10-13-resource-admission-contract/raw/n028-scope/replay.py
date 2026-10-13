#!/usr/bin/env python3
import argparse,os,pathlib,shutil,subprocess,tempfile
p=argparse.ArgumentParser();p.add_argument('variant',choices=['accepted','before']);a=p.parse_args();base=pathlib.Path(__file__).resolve().parent
if not os.environ.get('N028_AGENT_SYNC_SCRIPT'):raise SystemExit('Set N028_AGENT_SYNC_SCRIPT to installed pinned 1.22.2 source')
with tempfile.TemporaryDirectory(prefix='n028-scope-replay-') as d:
 root=pathlib.Path(d)
 for f in (base/'accepted').rglob('*.snapshot.txt'):
  target=root/str(f.relative_to(base/'accepted'))[:-len('.snapshot.txt')];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
 src=root/'apps/desktop/src/main/resourceRunAssignment.ts'
 if a.variant=='before':shutil.copyfile(base/'before/resourceRunAssignment.snapshot.txt',src)
 env=dict(os.environ,N028_SOURCE=str(src)); probes=['scope-supplement.mjs']
 if a.variant=='accepted':
  result=subprocess.run(['node','--experimental-strip-types','--test',str(root/'apps/desktop/test/resource-run-assignment.test.mjs')],cwd=root,env=env)
  if result.returncode:raise SystemExit(result.returncode)
  probes+=['early-probes.mjs','sync-sibling.mjs','lease-probe.mjs','composition-probe.mjs']
 raise SystemExit(subprocess.run(['node','--experimental-strip-types','--test',*[str(base/'probes'/n) for n in probes]],cwd=root,env=env).returncode)
