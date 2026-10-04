"""Independent neutral map baseline probe; run from exact reviewed source root."""
from pathlib import Path
import tempfile, subprocess, json, hashlib
owner = Path.cwd()
candidate = subprocess.check_output(['git','rev-parse','HEAD'], text=True).strip()
control = '5f4eb908a07a723e5959ff5f5311119549e4bd0a'
current = (owner/'scripts/check-design-map.mjs').read_text()
old = subprocess.check_output(['git','show',control+':scripts/check-design-map.mjs'],text=True)
results = []
for label, code, size in [('old-anchor-control',old,1100000),('candidate-anchor-control',current,1100000),('candidate-buffer-failclosed',current,17000000)]:
 with tempfile.TemporaryDirectory(prefix='fabric-independent-map-') as d:
  root = Path(d)
  for folder in ['scripts','docs/reports']:(root/folder).mkdir(parents=True)
  (root/'scripts/check-design-map.mjs').write_text(code)
  (root/'node_modules').symlink_to(owner/'node_modules',target_is_directory=True)
  (root/'.gitignore').write_text('node_modules\n')
  def git(*args):return subprocess.check_output(['git','-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-c','user.name=Independent fixture','-c','user.email=fixture@example.test',*args],cwd=root,text=True)
  def gate():return subprocess.run(['node','scripts/check-design-map.mjs','--refresh'],cwd=root,text=True,capture_output=True)
  git('init','-q');git('add','.');git('commit','-qm','neutral source')
  p = root/'docs/reports/map.html'
  baseline = '<html><body><h2 id="changelog">log</h2><div data-iteration="old"><a href="#kept">review</a></div><section id="kept"></section><section id="protected"></section><!--'+'x'*size+'--></body></html>'
  p.write_text(baseline)
  bootstrap = gate();assert bootstrap.returncode==0,bootstrap.stderr[:400]
  git('add','docs/reports/map.html');git('commit','-qm','committed baseline')
  if size>16000000:
   mutated = '<html><body><h2 id="changelog">log</h2><div data-iteration="new"><a href="#kept">review</a></div><section id="kept"></section></body></html>'
  else:
   mutated = p.read_text().replace('<section id="protected"></section>','').replace('data-iteration="old"','data-iteration="new"')
  p.write_text(mutated);before = p.read_bytes();r = gate()
  facts = {'name':label,'committed_baseline_bytes':len(baseline),'exit':r.returncode,'stdout':r.stdout,'current_map_unchanged':p.read_bytes()==before,'ENOBUFS_present':'ENOBUFS' in r.stderr,'anchor_refusal_present':'Previously committed map anchor removed: protected' in r.stderr,'false_initial_baseline':'Initial map' in r.stdout,'source_sha256':hashlib.sha256(code.encode()).hexdigest()}
  if label=='old-anchor-control':assert r.returncode==0 and facts['false_initial_baseline']
  else:assert r.returncode!=0 and not r.stdout and facts['current_map_unchanged']
  if size>16000000:assert facts['ENOBUFS_present']
  results.append(facts)
print(json.dumps({'candidate':candidate,'control':control,'neutral_only':True,'results':results},indent=2))
