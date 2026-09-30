import json, pathlib, tempfile, shutil, subprocess
from jsonschema import Draft202012Validator, RefResolver
root=pathlib.Path('.')
contract=pathlib.Path('$HOME/DATA/fabric-agent-contract')
rev='489737051828fafec92463df04b6a6fd3280c7b7'
schema=json.loads(subprocess.check_output(['git','-C',str(contract),'show',rev+':schemas/result.schema.json']))
store={}
for p in (contract/'schemas').glob('*.json'):
    s=json.loads(subprocess.check_output(['git','-C',str(contract),'show',rev+':schemas/'+p.name]))
    store[s['$id']]=s
v=Draft202012Validator(schema, resolver=RefResolver.from_schema(schema,store=store))
x={'done':'implemented','proof':[],'scope':'one project','notVerified':'none','artifacts':[],'costUsdEstimate':0}
errs=list(v.iter_errors(x))
print('NODE_RESULT_AT_PIN '+rev+' violations='+str(len(errs)))
for e in errs: print('  '+'.'.join(map(str,e.path))+': '+e.message)
dst=pathlib.Path(tempfile.mkdtemp(prefix='fabric-arch-probe-'))
(dst/'scripts').mkdir(); shutil.copy(root/'scripts/check-project-schemas.py',dst/'scripts'); shutil.copytree(root/'schemas',dst/'schemas')
p=dst/'schemas/examples/product.project.json'; original=p.read_text(); obj=json.loads(original)
extra=dict(obj['agentBindings'][0]); extra['id']='urn:fabric:project-agent:passioncode:pm-duplicate'; obj['agentBindings'].append(extra); p.write_text(json.dumps(obj))
r=subprocess.run(['python3',str(dst/'scripts/check-project-schemas.py')],text=True,capture_output=True)
print('BLUEPRINT_TWO_PMS gate_exit='+str(r.returncode)+' '+r.stdout.strip())
p.write_text(original); obj=json.loads(original); obj['agentBindings'][0]['status']='retired'; p.write_text(json.dumps(obj))
r=subprocess.run(['python3',str(dst/'scripts/check-project-schemas.py')],text=True,capture_output=True)
print('BLUEPRINT_RETIRED_PM gate_exit='+str(r.returncode)+' '+r.stdout.strip())
p.write_text(original); obj=json.loads(original); obj['routines'][0]['capabilityRef']='urn:fabric:capability:does-not-exist'; p.write_text(json.dumps(obj))
r=subprocess.run(['python3',str(dst/'scripts/check-project-schemas.py')],text=True,capture_output=True)
print('BLUEPRINT_UNBOUND_CAPABILITY gate_exit='+str(r.returncode)+' '+r.stdout.strip())
print('Temporary probe directory='+str(dst))
