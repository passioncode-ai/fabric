import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import {pathToFileURL} from "node:url";
const target=pathToFileURL(process.cwd()+"/apps/desktop/src/main/pty.ts").href;
registerHooks({load(url,context,nextLoad){ if(url===target) return {format:"module-typescript",source:readFileSync(new URL("./pty-before.ts",import.meta.url),"utf8"),shortCircuit:true}; return nextLoad(url,context); }});
