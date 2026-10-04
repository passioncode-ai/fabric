# #region com-research-cold-check — docs: docs/reports/2026-10-04-project-communication-architecture/README.md#reproduction-and-corrections
"""Verify tracked research artifacts from a fresh checkout; no dependencies or network."""
import hashlib,json,pathlib,re,subprocess,sys
raw=pathlib.Path(__file__).resolve().parent
root=raw.parents[3]
report=raw.parent/'README.md'
handoff=root/'docs/handoffs/2026-10-04-project-comms-implementation-packets.md'
for doc in [report,handoff]:
 for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',doc.read_text()):
  if '://' in target or target.startswith('#'):continue
  assert (doc.parent/target.split('#')[0]).resolve().exists(),target
for name in ['repository-sources.json','online-sources.json','verification.json','race-green.json','race-guard-removal.json']:
 json.loads((raw/name).read_text())
green=subprocess.run([sys.executable,str(raw/'race_model.py')],capture_output=True,text=True)
assert green.returncode==0 and json.loads(green.stdout)['passed']==12
for guard in ['generation','attempt','expiry','epoch','unknown']:
 r=subprocess.run([sys.executable,str(raw/'race_model.py'),'--mutant',guard],capture_output=True,text=True)
 assert r.returncode==1 and json.loads(r.stdout)['failed']>0,guard
files=[report,handoff,*[p for p in raw.iterdir()if p.is_file()]]
tracked=set(subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines())
assert all(str(p.relative_to(root))in tracked for p in files)
print(json.dumps({'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'artifact_files':len(files),'links_resolve':True,'model_cases_passed':12,'guard_removals_failed':5,'dependencies_required':False,'file_sha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()for p in files}},indent=2))

# #endregion com-research-cold-check
