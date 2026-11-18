// Resolves the main process's relative imports the way its bundler does, so a test can load a module whose import
// graph names a sibling without its extension (`'./agentSurface'`) or by the `.js` name of a `.ts` file (the vendored
// folder attribution). Node's type stripping takes a specifier as written; electron-vite resolves both. Only relative
// specifiers from a `.ts` file are touched, and only when the file named does not exist as written.
// Used by board-main.test.mjs, which loads `boardMain.ts` and with it `board.ts`'s whole graph (ADR-0195 W2c.1a).
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

registerHooks({
  resolve(specifier, context, next) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.endsWith('.ts')) {
      const asWritten = fileURLToPath(new URL(specifier, context.parentURL))
      if (!existsSync(asWritten) || asWritten.endsWith('.js')) {
        for (const candidate of [asWritten.replace(/\.js$/, '.ts'), `${asWritten}.ts`, `${asWritten}/index.ts`])
          if (candidate !== asWritten && existsSync(candidate)) return next(pathToFileURL(candidate).href, context)
      }
    }
    return next(specifier, context)
  }
})
