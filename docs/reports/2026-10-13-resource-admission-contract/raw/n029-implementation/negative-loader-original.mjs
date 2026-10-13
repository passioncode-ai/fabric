import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {stripTypeScriptTypes} from 'node:module'
import path from 'node:path'
const root=path.dirname(fileURLToPath(import.meta.url)),names=new Set(['managedLaunch.ts','admitExisting.ts','sessionBundle.ts','resourceLaunchAdapter.ts'])
export async function load(url,context,next){
 if(url.startsWith('file:')){const f=fileURLToPath(url);if(f.startsWith(path.join(root,'apps/desktop/src/main/'))&&names.has(path.basename(f)))return {format:'module',source:stripTypeScriptTypes(readFileSync(path.join(root,'before',path.basename(f)),'utf8')),shortCircuit:true}}
 return next(url,context)
}
