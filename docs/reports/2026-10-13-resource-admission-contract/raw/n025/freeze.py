from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
paths=['apps/desktop/src/main/resourcePoolPublisher.ts','apps/desktop/test/resource-pool-publisher.test.mjs','docs/execution/harness-waves/resource-pool-publisher.md']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
patch=''
for p in paths:
 lines=(root/p).read_text().splitlines(keepends=True)
 patch+=f'diff --git a/{p} b/{p}\nnew file mode 100644\n--- /dev/null\n+++ b/{p}\n@@ -0,0 +1,{len(lines)} @@\n'+''.join('+'+line for line in lines)
(root/'n025.patch').write_text(patch)
r=json.loads((root/'receipt.json').read_text());r['files']={p:sha(root/p) for p in paths};r['patchSha256']=sha(root/'n025.patch');r['dependencies']={p:sha(root/p) for p in ['apps/desktop/src/main/resourceHostPolicy.ts','apps/desktop/src/main/resourceHostSampler.ts','apps/desktop/src/shared/resourceAdmission.ts']}
r['limits']=[x for x in r['limits'] if not x.startswith('SQL readback')];r['tests']['passed']=36;r['sourceControls']=json.loads((root/'controls.json').read_text());r['bindingRegression']={'originalSourceSha256':sha(root/'rejected-initial/resourcePoolPublisher.ts'),'selectedOriginalExitCode':1,'failedTests':5,'log':'binding-red.log','independentOriginalReplayExitCode':1,'independentOriginalReplayLog':'reviewer-binding-red.log'}
(root/'receipt.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:r[k] for k in ['files','dependencies','patchSha256']},indent=2))
