from pathlib import Path
import subprocess,os,shutil,json,time,signal,selectors,hashlib,datetime,urllib.parse
ROOT=Path(__file__).resolve().parent
REAL_HOME=os.environ['HOME']
assert os.path.isabs(REAL_HOME)
ORIGINAL_HOME=REAL_HOME
REQUEST={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':1,'clientCapabilities':{},'clientInfo':{'name':'fabric-n037-offline-initialize','version':'1'}}}
RESULTS=[]
for host in ['kimi']:
 work=ROOT/(host+'-owned-home');work.mkdir(mode=0o700)
 binary=os.path.realpath(shutil.which('node'));st=os.stat(binary)
 entry=Path('/opt/homebrew/lib/node_modules/@moonshot-ai/kimi-code/dist/main.mjs');entry_before=entry.stat()
 preload='data:text/javascript,'+urllib.parse.quote('process.stderr.write(JSON.stringify({probeRuntime:{node:process.version,arch:process.arch,platform:process.platform}})+"\\n")')
 argv=[binary,'--import',preload,str(entry),'acp']
 quote=lambda x:json.dumps(str(x))
 denied=[Path(REAL_HOME)/x for x in ['.codex','.claude','.kimi','.hermes','.config','Library/Keychains']]
 kimi_guard='(deny file-read* (require-all (subpath '+quote(Path(REAL_HOME)/'.kimi-code')+') (require-not (literal '+quote(binary)+'))))'
 profile='(version 1)(allow default)(deny network*)(deny file-write* (require-not (subpath '+quote(work)+')))(deny file-read* '+''.join('(subpath '+quote(x)+')' for x in denied)+')(deny mach-lookup (global-name "com.apple.securityd") (global-name "com.apple.SecurityServer"))'+kimi_guard
 (ROOT/(host+'-sandbox.public.sb')).write_text(profile.replace(REAL_HOME,'{REAL_HOME}').replace(str(work),'{OWNED_HOME}'))
 env={'HOME':ORIGINAL_HOME,'KIMI_CODE_HOME':str(work/'data'),'KIMI_CODE_CACHE_DIR':str(work/'cache'),'KIMI_STARTUP_TRACE':'1','KIMI_STARTUP_TRACE_LOG':str(work/'startup-private.log'),'PATH':'/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin','LANG':'en_US.UTF-8','TERM':'dumb','NO_COLOR':'1'}
 assert env['HOME']==os.environ['HOME'] and 'CODEX_HOME' not in env
 startedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat();started=time.monotonic();p=subprocess.Popen(['/usr/bin/sandbox-exec','-p',profile,*argv],cwd=work,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 selector=selectors.DefaultSelector();selector.register(p.stdout,selectors.EVENT_READ,'stdout');selector.register(p.stderr,selectors.EVENT_READ,'stderr');buffers={'stdout':b'','stderr':b''};linebuf=b'';reply=None;reason=None
 try:
  p.stdin.write((json.dumps(REQUEST)+'\n').encode());p.stdin.flush()
  while time.monotonic()-started<26 and reply is None and reason is None:
   events=selector.select(min(0.2,max(0,26-(time.monotonic()-started))))
   for key,_ in events:
    block=os.read(key.fileobj.fileno(),4096)
    if not block:selector.unregister(key.fileobj);continue
    buffers[key.data]+=block
    if len(buffers[key.data])>65536:reason='output_bound_exceeded';break
    if key.data=='stdout':
     linebuf+=block
     while b'\n' in linebuf:
      line,linebuf=linebuf.split(b'\n',1)
      try:msg=json.loads(line)
      except Exception:continue
      if isinstance(msg,dict) and msg.get('id')==1 and ('result' in msg or 'error' in msg):reply=msg;break
   if p.poll() is not None and not selector.get_map():reason='child_exited_without_initialize_reply';break
  if reply is None and reason is None:reason='initialize_deadline'
 except (BrokenPipeError,OSError) as e:reason=type(e).__name__
 finally:
  try:p.stdin.close()
  except OSError:pass
  try:p.wait(timeout=max(0.1,min(2,29-(time.monotonic()-started))))
  except subprocess.TimeoutExpired:
   os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=0.5)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  selector.close()
 output={k:v[:65536].decode(errors='replace').replace(REAL_HOME,'{REAL_HOME}').replace(str(work),'{OWNED_HOME}') for k,v in buffers.items()}
 for k,v in output.items():(ROOT/(host+'-'+k+'.txt')).write_text(v)
 after=os.stat(binary)
 row={'host':host,'childPid':p.pid,'startedUTC':startedUTC,'finishedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':argv,'entryStatStable':(entry_before.st_size,entry_before.st_mtime_ns)==(entry.stat().st_size,entry.stat().st_mtime_ns),'request':REQUEST,'reply':json.loads(json.dumps(reply).replace(REAL_HOME,'{REAL_HOME}').replace(str(work),'{OWNED_HOME}')),'reason':reason,'exit':p.returncode,'seconds':round(time.monotonic()-started,3),'identity':{'kind':'resolved-path-and-stat-not-cryptographic','dev':st.st_dev,'ino':st.st_ino,'size':st.st_size,'mtimeNs':st.st_mtime_ns,'sameAfter':(st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns)},'originalHomePreserved':env['HOME']==ORIGINAL_HOME,'entryPrefixSha256':hashlib.sha256(Path(binary).open('rb').read(1048576)).hexdigest(),'entryPrefixBytes':1048576,'fullExecutableHash':'NOT_CAPTURED Node interpreter prefix only; full interpreter/dependency hash not captured to avoid substantial I/O','identityLimit':'prefix digest and stat only, not full executable/dependency identity','sessionCreated':False,'promptSent':False,'authSent':False}
 RESULTS.append(row);print(json.dumps(row),flush=True)
(ROOT/'receipt.json').write_text(json.dumps({'scope':'DISTINCT installed npm/Node runtime comparison, initialize only; original HOME preserved, CODEX_HOME untouched; not native instruction/MCP/session/auth/provider acceptance','scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'network':'sandbox denied network*','writes':'only respective owned temporary home','environment':'minimal no inherited tokens; original HOME value passed unchanged, supported KIMI_CODE_HOME and KIMI_CODE_CACHE_DIR redirected, startup trace enabled to owned path; real credential dirs and keychain filesystem/Mach access denied','deadlineSecondsPerHost':30,'maxOutputBytesPerStream':65536,'sequential':True,'results':RESULTS},indent=2)+'\n')
