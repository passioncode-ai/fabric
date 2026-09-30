import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Only the native module stays external (packaged as real node_modules,
// asar-unpacked); pure-JS deps are bundled into out/main so the packaged app
// carries no pnpm symlink forest.
const bundleAllButNative = externalizeDepsPlugin({
  exclude: ['@fabric/journal', '@supabase/supabase-js']
})

export default defineConfig({
  main: {
    plugins: [bundleAllButNative]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // CommonJS, and this is a SECURITY requirement rather than a build
    // preference (M196). A sandboxed preload runs in a restricted context that
    // has no ES module loader: measured 2026-09-06 against the real bridge —
    // with `sandbox: true` an ESM preload dies with `SyntaxError: Cannot use
    // import statement outside a module` and `window.fabric` is ABSENT, so the
    // renderer silently loses all 27 namespaces. CJS is what lets the sandbox
    // be on at all.
    build: {
      rollupOptions: {
        // `electron` is a RUNTIME module, not a dependency to bundle. In CJS
        // format the resolver otherwise picks the npm wrapper — the one that
        // `spawnSync`s the binary — dragging child_process/fs into a preload
        // that must run inside a sandbox where none of them exist.
        external: ['electron'],
        output: { format: 'cjs', entryFileNames: 'index.cjs' }
      }
    }
  },
  renderer: {
    plugins: [react()]
  }
})
