import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const helper=fileURLToPath(new URL('./helpers/codex-tui-probe-pty.py',import.meta.url))
for(const action of ['QUIT','TERM']){
 const code='import os,tty;tty.setraw(0);os.write(1,b"\\x1b[6n");reply=os.read(0,64);os.write(1,b"QUERY_OK" if reply==b"\\x1b[1;1R" else b"QUERY_BAD");\nwhile True:\n d=os.read(0,1)\n if d==b"\\x04":break'
 const child=spawn('/usr/bin/python3',['-u',helper,'/usr/bin/python3','-c',code],{stdio:['pipe','pipe','pipe']})
 let tail='',query=false,exit=null,failed=false
 const timeout=setTimeout(()=>{failed=true;child.stdin.end()},3000)
 child.stdin.on('error',()=>{});child.stderr.on('data',()=>{})
 child.stdout.on('data',chunk=>{tail+=chunk.toString();let i
  while((i=tail.indexOf('\n'))>=0){const line=tail.slice(0,i);tail=tail.slice(i+1);const v=JSON.parse(line)
   if(v.type==='output'){const bytes=Buffer.from(v.bytes,'base64');assert(!bytes.includes('QUERY_BAD'))
    if(bytes.includes('QUERY_OK')){query=true;child.stdin.write(action+'\n')}}
   if(v.type==='exit'||v.type==='cleanup-exit')exit=v
  }})
 const supervisor=await new Promise(r=>child.on('exit',(code,signal)=>r({code,signal})));clearTimeout(timeout)
 assert(!failed);assert(query);assert.equal(supervisor.code,0);assert.equal(exit.type,'exit');assert.equal(exit.code,action==='QUIT'?0:-15)
 console.log('PASS owned PTY cursor reply and '+action+' exit observed without provider')
}

{
 const code='import os,tty;tty.setraw(0);os.write(1,b"PICKER_READY");choice=b""\nwhile len(choice)<4:choice+=os.read(0,4-len(choice))\nos.write(1,b"CHOICE_OK" if choice==bytes([27,91,66,13]) else b"CHOICE_BAD")\nassert os.read(0,1)==bytes([4])'
 const child=spawn('/usr/bin/python3',['-u',helper,'/usr/bin/python3','-c',code],{stdio:['pipe','pipe','pipe']})
 let tail='',choice=false,exit=null,failed=false
 const timeout=setTimeout(()=>{failed=true;child.stdin.end()},3000)
 child.stdin.on('error',()=>{});child.stderr.on('data',()=>{})
 child.stdout.on('data',chunk=>{tail+=chunk.toString();let i
  while((i=tail.indexOf('\n'))>=0){const line=tail.slice(0,i);tail=tail.slice(i+1);const v=JSON.parse(line)
   if(v.type==='output'){const bytes=Buffer.from(v.bytes,'base64');assert(!bytes.includes('CHOICE_BAD'))
    if(bytes.includes('PICKER_READY'))child.stdin.write('KEEP_MODEL\n')
    if(bytes.includes('CHOICE_OK')){choice=true;child.stdin.write('KEEP_MODEL\nQUIT\n')}}
   if(v.type==='exit'||v.type==='cleanup-exit')exit=v
  }})
 const supervisor=await new Promise(r=>child.on('exit',(code,signal)=>r({code,signal})));clearTimeout(timeout)
 assert(!failed);assert(choice);assert.equal(supervisor.code,0);assert.equal(exit.type,'exit');assert.equal(exit.code,0)
 console.log('PASS one-shot fixed keep-existing-model choice; repeated choice ignored')
}
