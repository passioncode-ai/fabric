# Reconstructed from executed inline code; home-normalized derivative. NOT_RERUN.
from pathlib import Path
import tempfile,subprocess,shutil,os,json,time,signal,hashlib,re
out=Path(tempfile.mkdtemp(prefix='fabric-n037-cli-readonly-'))
actual_home=os.path.expanduser('~')
profile='(version 1)(allow default)(deny network*)(deny file-write*)(deny file-read* (subpath "{HOME}/.codex") (subpath "{HOME}/.claude") (subpath "{HOME}/.kimi") (subpath "{HOME}/.hermes") (subpath "{HOME}/.config") (subpath "{HOME}/Library/Keychains"))'.replace('{HOME}',actual_home)
env={'HOME':'/var/empty','XDG_CONFIG_HOME':'/var/empty','XDG_DATA_HOME':'/var/empty','XDG_CACHE_HOME':'/var/empty','PATH':'/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin','LANG':'en_US.UTF-8','TERM':'dumb','NO_COLOR':'1'}
records=[]
for name in ['claude','codex','kilo','hermes','kimi','cline','bash','zsh']:
 binary=shutil.which(name)
 if not binary:records.append({'host':name,'state':'not_on_PATH'});continue
 for arg in (['--version','--help'] if name not in ['bash','zsh'] else ['--version']):
  started=time.time();proc=subprocess.Popen(['/usr/bin/sandbox-exec','-p',profile,os.path.realpath(binary),arg],cwd='/var/empty',env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  timed=False
  try:stdout,stderr=proc.communicate(timeout=10)
  except subprocess.TimeoutExpired:
   timed=True;os.killpg(proc.pid,signal.SIGKILL);stdout,stderr=proc.communicate()
  text=(stdout+b'\n'+stderr).decode(errors='replace');text=text.replace(actual_home,'<HOME>')
  text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text)
  file=name+'-'+arg[2:]+'.txt';(out/file).write_text(text[:65536])
  selected=[l.strip() for l in text.splitlines() if re.search(r'(?i)version|mcp|permission|system.prompt|append|instructions|config|resume|session|acp|approval|sandbox|approve',l)]
  rec={'host':name,'argument':arg,'exit':proc.returncode,'timeout':timed,'seconds':round(time.time()-started,3),'outputFile':file,'outputSha256':hashlib.sha256((out/file).read_bytes()).hexdigest(),'selected':selected[:35] if arg=='--help' else text.splitlines()[:5]}
  records.append(rec);print(json.dumps(rec),flush=True)
receipt={'sourceCheckpoint':'fa5fbd7dc43e1d097c336fbff3617c68af508e43','scope':'Installed local CLI self-description in restricted empty-home context only; not instruction, MCP, native launch, model/provider or effective configured-home acceptance','network':'sandbox deny network*','writes':'sandbox deny file-write*','credentials':'Minimal env with no inherited tokens; HOME/XDG=/var/empty; known credential/home directories and Keychain filesystem denied; no credential content intentionally read','concurrency':1,'deadlineSeconds':10,'records':records}
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print('ARTIFACT '+str(out),flush=True)
