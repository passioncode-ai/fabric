"""Prepare disposable fixtures only; no Electron or user service is launched."""
from pathlib import Path
import subprocess, json, shutil, os, stat
results=[]
for mode in ['restored','corrupt','empty']:
 r=subprocess.run(['node','apps/desktop/test/adoption-native-harness.mjs','--prepare',mode],text=True,capture_output=True)
 if r.returncode:raise SystemExit(r.stderr)
 result=json.loads(r.stdout);root=Path(result['fixture'])
 try:
  marker=json.loads((root/'AD02-HARNESS.json').read_text())
  settings=json.loads((root/'userData/settings.json').read_text())
  isolated=Path(result['userData']).parent.resolve()==root.resolve()
  row={'mode':mode,'exit':r.returncode,'fixture_mode':oct(stat.S_IMODE(root.stat().st_mode)),'isolated_user_data':isolated,'source_module_pins':len(marker['sourcePins']),'build_pins':len(marker['buildPins']),'seeded_tabs':len(settings['tabs']['tabs']),'native_launch':'NOT_RUN'}
  assert isolated and row['fixture_mode']=='0o700'
  assert row['seeded_tabs']==(0 if mode=='empty' else 2)
  results.append(row)
 finally:shutil.rmtree(root)
bad=subprocess.run(['node','apps/desktop/test/adoption-native-harness.mjs','--prepare','unknown'],text=True,capture_output=True)
assert bad.returncode!=0
results.append({'mode':'unknown','exit':bad.returncode,'refusal':'Expected restored, corrupt or empty' in bad.stderr})
print(json.dumps({'candidate':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'results':results,'native_launch':'NOT_RUN'},indent=2))
