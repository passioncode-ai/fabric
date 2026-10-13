#!/usr/bin/env python3
"""Bounded serial replay; actual source modules, author fixture scaffold disclosed."""
from pathlib import Path
import argparse, tempfile, subprocess, os, json, shutil, hashlib
ap=argparse.ArgumentParser();ap.add_argument('--source-root',required=True);ap.add_argument('--output',required=True);args=ap.parse_args()
base=Path(__file__).resolve().parent; source=Path(args.source_root).resolve(); output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=True)
receipt=json.loads((base/'receipt.json').read_text())
for name,digest in receipt['sourceSha256'].items():
 assert hashlib.sha256((source/'apps/desktop/src/main'/name).read_bytes()).hexdigest()==digest, name+' source differs from reviewed bytes'
with tempfile.TemporaryDirectory(prefix='fabric-n035-review-replay-') as tmp:
 root=Path(tmp);tests=root/'apps/desktop/test';tests.mkdir(parents=True);(root/'package.json').write_text('{"type":"module"}')
 os.symlink(source/'node_modules',root/'node_modules');os.symlink(source/'apps/desktop/src',tests.parent/'src');os.symlink(source/'apps/desktop/test/prepared-launch-fixture.mjs',tests/'prepared-launch-fixture.mjs')
 shutil.copyfile(base/'controls.mjs',tests/'controls.mjs')
 common=['nice','-n','10','node','--experimental-strip-types','--test','--test-reporter=tap','--test-concurrency=1']
 runs=[]
 for label,cmd,env in [('corrected',common+[str(tests/'controls.mjs')],{}),('original',common[:4]+['--loader',str(base/'negative-loader.mjs')]+common[4:]+['--test-name-pattern=mapped failed delivery',str(tests/'controls.mjs')],{'N035_ORIGINAL':str(base/'original-factory.snapshot.txt')})]:
  with (output/(label+'.log')).open('w') as log:
   result=subprocess.run(cmd,cwd=root,env={**os.environ,**env},stdout=log,stderr=subprocess.STDOUT,timeout=180)
  runs.append({'case':label,'exitCode':result.returncode})
 (output/'checks.json').write_text(json.dumps(runs,indent=2)+'\n')
 assert runs[0]['exitCode']==0 and runs[1]['exitCode']==1
 assert 'retryable must poison seal' in (output/'original.log').read_text()
