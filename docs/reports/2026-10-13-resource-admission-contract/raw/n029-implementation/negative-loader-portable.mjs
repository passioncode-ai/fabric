import {readFileSync,realpathSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {stripTypeScriptTypes} from 'node:module'
import path from 'node:path'
if(!process.env.N029_SOURCE_ROOT)throw Error('Set N029_SOURCE_ROOT to the checkout containing candidate tests')
const root=realpathSync(process.env.N029_SOURCE_ROOT), originals=path.join(path.dirname(fileURLToPath(import.meta.url)),'originals')
const names=new Set(['managedLaunch.ts','admitExisting.ts','sessionBundle.ts','resourceLaunchAdapter.ts'])
export async function load(url,context,next){
 if(url.startsWith('file:')){const f=fileURLToPath(url);if(f.startsWith(path.join(root,'apps/desktop/src/main/'))&&names.has(path.basename(f)))return {format:'module',source:stripTypeScriptTypes(readFileSync(path.join(originals,path.basename(f)+'.snapshot.txt'),'utf8')),shortCircuit:true}}
 return next(url,context)
}
