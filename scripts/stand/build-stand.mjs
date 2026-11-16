// Builds the screens stand (apps/desktop/stand): the renderer's real screens and stylesheets, fed fixtures through a
// fake `window.fabric`, into apps/desktop/out/stand for scripts/test/screens-stand.browser.mjs. Not shipped.
import path from 'node:path'
import { createRequire } from 'node:module'
const desktop = path.resolve(import.meta.dirname, '../../apps/desktop')
const require = createRequire(path.join(desktop, 'package.json'))
const { build } = await import(require.resolve('vite'))
const react = (await import(require.resolve('@vitejs/plugin-react'))).default
await build({
  root: path.join(desktop, 'stand'), base: './', logLevel: 'warn', configFile: false,
  plugins: [react()],
  build: { outDir: path.join(desktop, 'out/stand'), emptyOutDir: true, sourcemap: false, minify: false, assetsInlineLimit: 100_000_000, cssCodeSplit: false },
  define: { 'process.env.NODE_ENV': '"production"' }
})
console.log('Built the screens stand into apps/desktop/out/stand')
