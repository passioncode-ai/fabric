// A real Electron main process that quits the way Fabric does (CO-191, lifecycle LC-01).
// It wires the production quit coordinator to a window, a ticking scheduler and a shutdown
// that settles at once — the case that left Fabric alive and windowless — and reports each
// lifecycle hook on stdout so the test can tell a graceful exit from a kill.
//   electron main.mjs <user-data-dir> [old]
import { app, BrowserWindow } from 'electron'
import { createQuitCoordinator } from '../../../src/main/quit.ts'

const [userData, mode] = process.argv.slice(process.argv.findIndex((a) => a.endsWith('main.mjs')) + 1)
app.setPath('userData', userData)
// The dialog modes keep the Dock icon, as Fabric does: a hidden Dock changes how macOS runs the box.
if (!String(mode).startsWith('dialog')) app.dock?.hide()
const say = (what) => process.stdout.write(`quit-app: ${what}\n`)

let ticks = 0
const ticker = setInterval(() => { ticks++ }, 50)

if (mode === 'old') {
  // The pattern this repository shipped until 2026-10-03, kept only so the planted defect
  // can be watched being caught: re-quit from a promise's `finally`.
  let quitting = false
  app.on('before-quit', (e) => {
    say('before-quit')
    if (quitting) return
    e.preventDefault()
    quitting = true
    void Promise.resolve().finally(() => app.quit())
  })
  app.on('window-all-closed', () => { say('window-all-closed'); if (process.platform !== 'darwin') app.quit() })
} else {
  const quit = createQuitCoordinator({ app, ready: () => true, shutdown: async () => { say('shutdown') } })
  quit.onQuit(() => { clearInterval(ticker); say(`schedulers-stopped ticks=${ticks}`) })
  app.on('before-quit', (e) => { say('before-quit'); quit.beforeQuit(e) })
  app.on('window-all-closed', () => { say('window-all-closed'); quit.windowAllClosed(process.platform) })
}
app.on('will-quit', () => say('will-quit'))
process.on('exit', (code) => say(`exit ${code}`))

// Not a top-level await: Electron emits `ready` only once the main module has finished
// evaluating, so awaiting it at the top level would wait forever.
void app.whenReady().then(async () => {
  if (mode === 'dialog-orphan') {
    // The shape Fabric had before the fix — no window at all, a free-standing message box. Kept so the
    // planted defect can be watched: on macOS it holds the main thread and SIGTERM goes unanswered.
    const { dialog } = await import('electron')
    say('ready')
    void dialog.showMessageBox({ type: 'error', message: 'quit-app could not start', buttons: ['Quit'] })
    return
  }
  if (mode === 'dialog') {
    // Fabric's startup-failure shape: a message box waiting on the person, as a sheet on its own window.
    const { dialog } = await import('electron')
    const parent = new BrowserWindow({ show: true, width: 300, height: 120 })
    await parent.loadURL('data:text/html,<p>quit-app</p>')
    say('ready')
    void dialog.showMessageBox(parent, { type: 'error', message: 'quit-app could not start', buttons: ['Quit'] })
    return
  }
  const win = new BrowserWindow({ show: false, width: 200, height: 120 })
  await win.loadURL('data:text/html,<p>quit-app</p>')
  say('ready')
})
