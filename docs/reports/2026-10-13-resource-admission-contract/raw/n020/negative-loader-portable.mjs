import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const target = pathToFileURL(resolve(process.cwd(), 'apps/desktop/src/main/resourceLaunchAdapter.ts')).href
registerHooks({ load(url, context, next) {
  return url === target ? { format: 'module-typescript', source: readFileSync(new URL('./before.ts', import.meta.url), 'utf8'), shortCircuit: true } : next(url, context)
} })
