import {readFileSync,realpathSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {stripTypeScriptTypes} from 'node:module'
const target=realpathSync(process.env.N032_TARGET),snapshot=process.env.N032_SNAPSHOT
export async function load(url,context,next){
 if(url.startsWith('file:')&&fileURLToPath(url)===target)return {format:'module',source:stripTypeScriptTypes(readFileSync(snapshot,'utf8')),shortCircuit:true}
 return next(url,context)
}
