// Runs one test file inside a real Electron main process (first-slice plan E0). Not
// ELECTRON_RUN_AS_NODE: `process.type` must be 'browser', the process the registry and the
// native view host actually live in. No window is created.
//   electron test/electron-main-runner.mjs <test-file>
import { app } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const file = process.argv.find(a => /\.test\.mjs$/.test(a))
if (!file || process.type !== 'browser') { console.error('NOT_RUN: pass one *.test.mjs inside an Electron main process'); app.exit(2) }
else {
  app.dock?.hide()
  process.on('exit', code => { if (code) console.error(`electron-main-runner: ${path.basename(file)} exited ${code}`) })
  try {
    console.log(`electron-main-runner: ${JSON.stringify({ electron: process.versions.electron, node: process.versions.node, modules: process.versions.modules, type: process.type, arch: process.arch })}`)
    await import(pathToFileURL(path.resolve(file)).href)
    app.exit(0)
  } catch (e) {
    console.error(e)
    app.exit(1)
  }
}
