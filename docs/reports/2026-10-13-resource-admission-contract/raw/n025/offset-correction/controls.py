from pathlib import Path
import subprocess,json,hashlib
root=Path(__file__).resolve().parent
src=root/'apps/desktop/src/main/resourcePoolPublisher.ts'
base=src.read_text()
changes=[
 ('generation', 'actual.generation !== pending.generation', 'false', 'uncertain generation1'),
 ('physical-ceiling','policy.capacity.memoryBytes > resourceInteger(physical.memoryTotalBytes,1)', 'false', 'impossible configured memoryBytes'),
 ('observation-readback','!actual.observed || actual.atMs !== pending.sample.atMs || !sameVector(actual.observed,pending.sample.vector)', 'false', 'mismatched observed-vector'),
 ('outstanding-slot', "if (busy) return result('unknown','io_outstanding')", 'if (false) return result(\'unknown\',\'io_outstanding\')', 'timed-out committed write'),
 ('clock-rejection', next(line for line in base.splitlines() if 'Promise.prototype.then.call' in line), '', 'ordinary native Promise reject'),
]
results=[]
for name,before,after,pattern in changes:
 assert base.count(before)==1,name
 folder=root/'controls-v3'/name
 (folder/'src/main').mkdir(parents=True,exist_ok=True)
 (folder/'test').mkdir(exist_ok=True)
 (folder/'src/main/resourcePoolPublisher.ts').write_text(base.replace(before,after))
 for dep in ['resourceHostPolicy.ts','resourceHostSampler.ts']:
  (folder/'src/main'/dep).symlink_to((root/'apps/desktop/src/main'/dep).resolve())
 (folder/'src/shared').symlink_to((root/'apps/desktop/src/shared').resolve())
 (folder/'test/resource-pool-publisher.test.mjs').write_bytes((root/'apps/desktop/test/resource-pool-publisher.test.mjs').read_bytes())
 cmd=['node','--experimental-strip-types','--test',f'--test-name-pattern={pattern}',str(folder/'test/resource-pool-publisher.test.mjs')]
 result=subprocess.run(cmd,capture_output=True,text=True,timeout=30)
 (folder/'stdout.log').write_text(result.stdout+result.stderr)
 results.append(dict(control=name,exitCode=result.returncode,pattern=pattern,sourceSha256=hashlib.sha256((folder/'src/main/resourcePoolPublisher.ts').read_bytes()).hexdigest()))
 assert result.returncode!=0,name
(root/'controls.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
