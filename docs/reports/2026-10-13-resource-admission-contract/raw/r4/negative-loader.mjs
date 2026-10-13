import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const target=pathToFileURL(process.cwd()+'/apps/desktop/src/main/resourceReconciliation.ts').href;
registerHooks({load(url,context,next){return url===target?{format:'module-typescript',source:readFileSync(new URL('./before.ts',import.meta.url),'utf8'),shortCircuit:true}:next(url,context)}});
