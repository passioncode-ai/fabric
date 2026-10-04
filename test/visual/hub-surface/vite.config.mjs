// #region hub-surface-visual — docs: docs/handoffs/surface-resume.md#browser-validation
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const nm = path.join(root, 'apps/desktop/node_modules')
const { default: react } = await import(path.join(nm, '@vitejs/plugin-react/dist/index.js'))
export default {
  root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()],
  resolve: { alias: [
    { find: /^react-dom(\/.*)?$/, replacement: `${nm}/react-dom$1` },
    { find: /^react(\/.*)?$/, replacement: `${nm}/react$1` },
    { find: /^@fontsource\/(.*)$/, replacement: `${nm}/@fontsource/$1` }
  ] },
  server: { host: '127.0.0.1', port: 5297, strictPort: true, fs: { allow: [root] } }
}
// #endregion hub-surface-visual
