import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve, join, normalize, sep } from 'node:path'
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'

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

/**
 * The CEO popup's policy (ADR-0197 §4): the renderer's, and the realtime socket to xAI, the one origin outside the app
 * any Fabric document may reach. Only `ceo.html` carries it, so the main window and the detached ones still reach nothing.
 */
export const CEO_CSP = RENDERER_CSP.replace("connect-src 'self'", "connect-src 'self' wss://api.x.ai")

function contentSecurityPolicy() {
  return {
    name: 'fabric-renderer-csp',
    apply: 'build' as const,
    transformIndexHtml: (html: string, ctx: { filename?: string; path?: string }) => {
      const policy = /ceo\.html$/.test(ctx.filename ?? ctx.path ?? '') ? CEO_CSP : RENDERER_CSP
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
    }
  }
}

/**
 * Excalidraw's fonts as the app's own files (ADR-0201 §2): the canvas page sets `window.EXCALIDRAW_ASSET_PATH` to
 * `excalidraw-assets/`, so the editor never falls back to `esm.sh`, which the page's policy refuses anyway. Built: the
 * package's `dist/prod/fonts` copied beside the pages. Served: the same folder answered by the dev server.
 */
const EXCALIDRAW_DIST = resolve(import.meta.dirname, 'node_modules/@excalidraw/excalidraw/dist/prod')
export const EXCALIDRAW_ASSETS = 'excalidraw-assets'
function excalidrawAssets() {
  let outDir = ''
  return {
    name: 'fabric-excalidraw-assets',
    configResolved: (config: { build: { outDir: string } }) => { outDir = config.build.outDir },
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: () => void; statusCode: number } & NodeJS.WritableStream, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const prefix = `/${EXCALIDRAW_ASSETS}/`
        if (!req.url?.startsWith(prefix)) return next()
        const file = normalize(join(EXCALIDRAW_DIST, decodeURIComponent(req.url.slice(prefix.length).split('?')[0]!)))
        if (!file.startsWith(EXCALIDRAW_DIST + sep) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end(); return }
        res.setHeader('content-type', file.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      cpSync(join(EXCALIDRAW_DIST, 'fonts'), join(outDir, EXCALIDRAW_ASSETS, 'fonts'), { recursive: true })
    }
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
          'mcp-bridge': resolve(import.meta.dirname, 'src/main/mcpStdioBridgeMain.ts'),
          // ADR-0134: the MCP entry a coding agent opened outside Fabric registers (bin/fabric-mcp runs it).
          'fabric-mcp': resolve(import.meta.dirname, 'src/main/fabricMcpMain.ts'),
          // ADR-0195 W2c.1a: the board's hub apart from the window, run as Node (`boardMain.ts`).
          'board-main': resolve(import.meta.dirname, 'src/main/boardMain.ts')
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
    plugins: [react(), contentSecurityPolicy(), excalidrawAssets()],
    // ADR-0197: the CEO popup is the renderer's second document, so its policy is its own.
    build: {
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, 'src/renderer/index.html'),
          ceo: resolve(import.meta.dirname, 'src/renderer/ceo.html'),
          // ADR-0201: the canvas is the third, so Excalidraw loads in its window alone.
          canvas: resolve(import.meta.dirname, 'src/renderer/canvas.html')
        }
      }
    }
  }
})
