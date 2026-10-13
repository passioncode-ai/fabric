import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
export async function load(url,context,next){
 if(url.endsWith('/resourceControlledPool.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(process.env.N035_ORIGINAL,'utf8'),{mode:'strip'}),shortCircuit:true};
 return next(url,context);
}
