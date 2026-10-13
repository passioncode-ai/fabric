import {registerHooks} from "node:module";import {readFileSync} from "node:fs";
import {pathToFileURL} from 'node:url';
const target=pathToFileURL(process.cwd()+'/apps/desktop/src/main/resourceAttemptObservation.ts').href;
registerHooks({load(url,ctx,next){return url===target?{format:"module-typescript",source:readFileSync(new URL("./without-dedup.ts",import.meta.url),"utf8"),shortCircuit:true}:next(url,ctx)}});
