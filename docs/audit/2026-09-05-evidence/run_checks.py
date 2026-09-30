import subprocess,json,time,pathlib,concurrent.futures
root="."
out=pathlib.Path("/tmp/fabric-audit-20260905/checks");out.mkdir(exist_ok=True)
cmds={"typecheck":["pnpm","typecheck"],"docs":["pnpm","gates:docs"],"design":["pnpm","gates:design"],"build":["pnpm","--filter","@fabric/desktop","build"],"test":["pnpm","test"],"dependencies":["pnpm","audit","--json"],"ci":["gh","run","list","--repo","passioncode-ai/fabric","--limit","60","--json","conclusion,name,status,createdAt,url"],"releases":["gh","release","list","--repo","passioncode-ai/fabric","--json","tagName,publishedAt,isPrerelease,isDraft","--limit","20"]}
def run(item):
 name,cmd=item;t=time.time()
 try:
  p=subprocess.run(cmd,cwd=root,capture_output=True,text=True,timeout=480)
  log=p.stdout+p.stderr;rc=p.returncode
 except Exception as e:log=str(e);rc=-1
 (out/(name+".log")).write_text(log)
 result={"name":name,"command":" ".join(cmd),"exit":rc,"seconds":round(time.time()-t,2),"log":str(out/(name+".log")),"tail":log[-1400:]}
 (out/(name+".json")).write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False),flush=True)
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(run,cmds.items()))
(out/"results.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
