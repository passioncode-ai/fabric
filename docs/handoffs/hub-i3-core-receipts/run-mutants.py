#!/usr/bin/env python3
"""No tracked mutation: load qualified module copies from private temporary directories."""
from pathlib import Path
import re, subprocess, tempfile, json, os
root = Path(__file__).resolve().parents[3]
call = root / 'apps/desktop/src/main/hubCall.ts'
forward = root / 'apps/desktop/src/main/productForwarder.ts'
s = call.read_text()
def qualify(text, source):
    text = re.sub(r"from (['\"])(\.[^'\"]+)\1", lambda m: 'from '+m[1]+(source.parent/m[2]).resolve().as_uri()+m[1], text)
    return re.sub(r"from (['\"])(@modelcontextprotocol/sdk/client/[^'\"]+)\1", lambda m: 'from '+m[1]+(root/'apps/desktop/node_modules/@modelcontextprotocol/sdk/dist/esm'/m[2].removeprefix('@modelcontextprotocol/sdk/')).resolve().as_uri()+m[1], text)
checks = [
 ('frozen3b',None,None,None),
 ('remove-capacity','hub',s.replace('if (mine.size >= IDEMPOTENCY_MAX_PER_BINDING)','if (false)'), 'I3 capacity|I3 all inflight'),
 ('remove-effect-tracking','hub',s.replace('effect.mayHaveRun = true //','effect.mayHaveRun = false //'),'I3 unproven|I3 actual MCP 6500'),
 ('remove-authority-refresh','hub',s.replace('deps.access.liveGrantsOf(binding), deps.store.liveConnection(args.agentId)','Promise.resolve(grants), Promise.resolve(connection)'),'during vault'),
 ('remove-unknown-retention','hub',s.replace(" && e.state !== 'unknown'",'').replace(" && seen.state !== 'unknown'",''),'I3 unknown key never'),
 ('remove-error-privacy','hub',s.replace("? { error: { code: 'product-error', message: 'The product reported an error. Check its effect with the product’s read tools before retrying.' } }","? forwarded.result.structuredContent ?? { content: forwarded.result.content ?? [] }"),'I3 actual MCP tool error'),
 ('remove-output-bounds','hub',s.replace('MAX_PRODUCT_DEPTH = 64','MAX_PRODUCT_DEPTH = 100_000').replace('MAX_PRODUCT_NODES = 100_000','MAX_PRODUCT_NODES = Infinity').replace('MAX_PRODUCT_BYTES = 4 * 1024 * 1024','MAX_PRODUCT_BYTES = Infinity'),'I3 cyclic|I3 product depth'),
 ('remove-ops-scrub','hub',s.replace('logLine(scrubProductText(forwarded.message, secret.value, connection.client_id))','logLine(forwarded.message)'),'I3 thrown and returned'),
 ('remove-retirement','hub',s.replace('retiredBindings.add(bindingId)','// retirement fence removed'),'I3 binding retirement|I3 inflight completion|I3 retiring a binding'),
 ('remove-response-cap','forward',forward.read_text().replace('responseBytes > MAX_PRODUCT_RESPONSE_BYTES','responseBytes > Infinity'),'I3 forwarder bounds'),
]
for name, target, code, pattern in checks:
    with tempfile.TemporaryDirectory(prefix='hub-i3-mutant-') as d:
        env = dict(os.environ)
        if target is None:
            for src, key in [(call,'HUB_CALL_MODULE'),(forward,'FORWARDER_MODULE')]:
                original = subprocess.check_output(['git','show','3b2878fc9283db5fc9a81697ba8538a01630b8d9:'+str(src.relative_to(root))],cwd=root,text=True)
                mod=Path(d)/src.name;mod.write_text(qualify(original,src));env[key]=mod.as_uri()
        else:
            src=call if target=='hub' else forward
            mod=Path(d)/src.name;mod.write_text(qualify(code,src));env['HUB_CALL_MODULE' if target=='hub' else 'FORWARDER_MODULE']=mod.as_uri()
        cmd=['node','--experimental-strip-types','--test']
        if pattern: cmd+=['--test-name-pattern',pattern]
        cmd+=['apps/desktop/test/hub-call-i3.test.mjs']
        result=subprocess.run(cmd,cwd=root,env=env,capture_output=True,text=True,timeout=30)
        output=result.stdout+result.stderr
        # Keep meaningful failing tests and counters, not huge generated fixture dumps.
        excerpt='\n'.join(line for line in output.splitlines() if line.startswith(('✔','✖','ℹ','test at ')))+'\n'
        (Path(__file__).parent/(name+'.log')).write_text(excerpt)
        print(json.dumps({'probe':name,'exit':result.returncode,'rejected':result.returncode!=0}),flush=True)
        assert 'AssertionError' in output, name+' failed without reaching its regression assertion'
        assert result.returncode != 0, name+' guard removal survived'
