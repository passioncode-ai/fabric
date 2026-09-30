// Disposable PostgreSQL + local HTTP bridge acceptance, never a caller database.
import {existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const bin=process.env.FABRIC_PG_BIN??'/opt/homebrew/opt/postgresql@17/bin'
if(!existsSync(path.join(bin,'initdb'))){console.error('NOT_RUN: installed PostgreSQL binaries required via FABRIC_PG_BIN');process.exit(2)}
const mask=process.umask(0o077),dir=mkdtempSync(path.join(tmpdir(),'fabric-ceo-http-sql-')),data=path.join(dir,'data'),nonce=randomUUID(),port='58466'
const env={PATH:process.env.PATH??'',HOME:dir,LC_ALL:'C',PGPASSFILE:path.join(dir,'empty-pass'),PGSERVICEFILE:path.join(dir,'empty-service')}
const pg=(name,args)=>execFileSync(path.join(bin,name),args,{env,timeout:15000,maxBuffer:4*1024*1024,encoding:'utf8',stdio:['ignore','pipe','pipe']})
let started=false
try{
 writeFileSync(path.join(dir,'owner'),nonce,{mode:0o600});writeFileSync(env.PGPASSFILE,'',{mode:0o600});writeFileSync(env.PGSERVICEFILE,'',{mode:0o600})
 pg('initdb',['-D',data,'-A','trust','-U','postgres','--no-locale','-E','UTF8'])
 pg('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-F -k '${dir.replaceAll("'","'\\''")}' -c listen_addresses='' -p ${port}`,'-w','start']);started=true
 pg('createdb',['-h',dir,'-p',port,'-U','postgres','fabric_ceo_http_sql_owned'])
 execFileSync(process.execPath,['--experimental-strip-types',new URL('./ceo-host-sql.test.mjs',import.meta.url).pathname],{
  env:{...env,FABRIC_CEO_HTTP_SQL_DIR:dir,FABRIC_CEO_HTTP_SQL_NONCE:nonce,FABRIC_CEO_HTTP_SQL_BIN:bin},stdio:'inherit',timeout:90000})
}finally{
 try{if(started||existsSync(path.join(data,'postmaster.pid')))pg('pg_ctl',['-D',data,'-m','fast','-w','stop'])}
 finally{process.umask(mask)}
 rmSync(dir,{recursive:true,force:true});if(existsSync(dir))throw Error('owned fixture directory remains')
 console.log('PASS cleanup: owned PostgreSQL stopped; socket/data/private files removed')
}
