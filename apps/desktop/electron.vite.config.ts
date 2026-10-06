import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Only the native module stays external (packaged as real node_modules,
// asar-unpacked); pure-JS deps are bundled into out/main so the packaged app
// carries no pnpm symlink forest.
const bundleAllButNative = externalizeDepsPlugin({
  exclude: ['@fabric/journal', '@supabase/supabase-js']
})

/**
 * The renderer's Content-Security-Policy (ADR-0020 makes it a host obligation; audit 2026-10-05 A7-002).
 * Every Fabric window carries the preload's bridge, so no script but the app's own may run in one.
 * Added to the BUILT page only: the dev server injects an inline React Refresh preamble that a
 * `script-src 'self'` would refuse, and a policy loosened for development is the one that ships.
 * `style-src 'unsafe-inline'` is for Monaco and xterm, which create <style> elements; workers are the
 * bundle's own files. The renderer loads nothing from the network (`csp.test.mjs` asserts the policy).
 */
export const RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

function contentSecurityPolicy() {
  return {
    name: 'fabric-renderer-csp',
    apply: 'build' as const,
    transformIndexHtml: (html: string) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${RENDERER_CSP}" />`)
  }
}

export default defineConfig({
  main: {
    plugins: [bundleAllButNative],
    // Usage analytics (docs/ANALYTICS.md): only the release workflow sets FABRIC_ANALYTICS_APP_KEY, from the
    // `release` environment's secret, so a source build, a fork or a test sends nothing.
    define: { __FABRIC_ANALYTICS_APP_KEY__: JSON.stringify(process.env.FABRIC_ANALYTICS_APP_KEY ?? '') },
    // Fabric's helper programs (P-10, ADR-0119) ship as entries of the main bundle and run under
    // Electron as Node (`helperProcess.ts`): the ACP terminal shell and the stdio MCP bridge.
    // Named through `build.lib.entry`, electron-vite's own entry option. Through `rollupOptions.input` it
    // emitted an EMPTY out/main/index.js (0.3.2 release run 37511843198; `test/main-bundle.test.mjs`).
    build: {
      lib: {
        entry: {
          index: resolve(import.meta.dirname, 'src/main/index.ts'),
          'acp-shell': resolve(import.meta.dirname, 'src/main/acpShellMain.ts'),
          'mcp-bridge': resolve(import.meta.dirname, 'src/main/mcpStdioBridgeMain.ts')
        }
      }
    }
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
    plugins: [react(), contentSecurityPolicy()]
  }
})
