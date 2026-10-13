import {readFileSync,realpathSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {stripTypeScriptTypes} from 'node:module'
const overrides=new Map()
for(const [source,snapshot] of [['N029_SOURCE','N029_OVERRIDE_PRODUCER'],['N029_COMPILER','N029_OVERRIDE_COMPILER']])if(process.env[snapshot])overrides.set(realpathSync(process.env[source]),process.env[snapshot])
export async function load(url,context,next){
 if(url.startsWith('file:')){const snapshot=overrides.get(fileURLToPath(url));if(snapshot)return {format:'module',source:stripTypeScriptTypes(readFileSync(snapshot,'utf8')),shortCircuit:true}}
 return next(url,context)
}
