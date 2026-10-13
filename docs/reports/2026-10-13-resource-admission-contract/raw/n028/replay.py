#!/usr/bin/env python3
"""Materialize archived bytes into an OWNED temporary directory; never edits checkout."""
import argparse,os,pathlib,shutil,subprocess,tempfile
p=argparse.ArgumentParser();p.add_argument('variant',choices=['accepted','early','lease']);a=p.parse_args()
base=pathlib.Path(__file__).resolve().parent
script=os.environ.get('N028_AGENT_SYNC_SCRIPT')
if not script: raise SystemExit('Set N028_AGENT_SYNC_SCRIPT to installed hash-pinned 1.22.2 source. No installation is performed.')
with tempfile.TemporaryDirectory(prefix='n028-replay-') as d:
 root=pathlib.Path(d)
 for f in (base/'accepted').rglob('*.snapshot.txt'):
  rel=str(f.relative_to(base/'accepted'))[:-len('.snapshot.txt')];target=root/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
 src=root/'apps/desktop/src/main/resourceRunAssignment.ts'
 if a.variant=='early':shutil.copyfile(base/'builder/pre-hardening.snapshot.txt',src)
 if a.variant=='lease':shutil.copyfile(base/'builder/pre-nested-transport.snapshot.txt',src)
 env=dict(os.environ,N028_SOURCE=str(src),N028_AGENT_SYNC_SCRIPT=str(pathlib.Path(script).resolve()))
 if a.variant=='accepted':
  result=subprocess.run(['node','--experimental-strip-types','--test',str(root/'apps/desktop/test/resource-run-assignment.test.mjs')],cwd=root,env=env)
  if result.returncode:raise SystemExit(result.returncode)
 probes={'accepted':['early-probes.mjs','sync-sibling.mjs','lease-probe.mjs','composition-probe.mjs'],'early':['early-probes.mjs'],'lease':['sync-sibling.mjs','lease-probe.mjs']}[a.variant]
 raise SystemExit(subprocess.run(['node','--experimental-strip-types','--test',*[str(base/'probes'/n) for n in probes]],cwd=root,env=env).returncode)
