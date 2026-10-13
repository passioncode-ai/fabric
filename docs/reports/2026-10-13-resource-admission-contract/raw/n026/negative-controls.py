from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).resolve().parent;base=(p/'apps/desktop/src/main/resourceInputSnapshot.ts').read_text()
controls=[('raw-bytes','h.update(buffer.subarray(0,read.bytesRead))','void buffer','actual binary bytes'),('final-stamp',"if(entry.state==='file'&&(!st||stamp(st)!==fileStamps.get(entry.path)))uncertain('file_changed')",'void st','same-size modification after'),('slot',"if(outstanding)return Promise.resolve(failure('unknown','io_outstanding'))",'if(false)return Promise.resolve(failure(\'unknown\',\'io_outstanding\'))','timeout retains actual'),('async-clock',"void Promise.prototype.then.call(value,undefined,()=>{})",'void value','ordinary async clock rejection')]
results=[]
for name,before,after,pattern in controls:
 assert base.count(before)==1,name
 d=p/'controls'/name;(d/'src/main').mkdir(parents=True);(d/'test').mkdir();(d/'src/main/resourceInputSnapshot.ts').write_text(base.replace(before,after));(d/'src/main/gitRun.ts').symlink_to((p/'apps/desktop/src/main/gitRun.ts').resolve());(d/'test/resource-input-snapshot.test.mjs').write_bytes((p/'apps/desktop/test/resource-input-snapshot.test.mjs').read_bytes())
 cmd=['node','--experimental-strip-types','--test',f'--test-name-pattern={pattern}',str(d/'test/resource-input-snapshot.test.mjs')]
 r=subprocess.run(cmd,capture_output=True,text=True,timeout=30);(d/'stdout.log').write_text(r.stdout+r.stderr);assert r.returncode!=0,name;results.append({'control':name,'pattern':pattern,'exitCode':r.returncode,'sourceSha256':hashlib.sha256((d/'src/main/resourceInputSnapshot.ts').read_bytes()).hexdigest()})
(p/'negative-controls.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
