// The menu's SHAPE, with nothing executable imported (M111).
//
// `menu.ts` imports `BrowserWindow`, `Menu` and `shell`, so it cannot be loaded
// outside Electron — the same wall `index.ts` has, one level down. The risk in
// this work is not what the menu adds but what it REPLACES: installing one
// discards Electron's default, and the default is where copy, paste, quit and
// the window controls come from. That risk is a property of this array, so the
// array lives where a probe can read it and the actions arrive as arguments.

const isMac = process.platform === 'darwin'

export interface MenuActions {
  /** Ask the focused window's renderer to close its active tab. The main
   *  process does not know what a tab is and should not. */
  closeActiveTab: () => void
  openExternal: (url: string) => void
  /** Every label, in the operator's language (0.3.3): `menu.ts` passes the
   *  registry's translator, so this file still imports nothing executable. */
  label: (key: MenuLabel) => string
}

export type MenuLabel =
  | 'menu.file' | 'menu.edit' | 'menu.view' | 'menu.window' | 'menu.help'
  | 'menu.about' | 'menu.services' | 'menu.hide' | 'menu.hideOthers' | 'menu.unhide' | 'menu.quit'
  | 'menu.closeTab' | 'menu.closeWindow'
  | 'menu.undo' | 'menu.redo' | 'menu.cut' | 'menu.copy' | 'menu.paste' | 'menu.pasteAndMatchStyle' | 'menu.delete' | 'menu.selectAll'
  | 'menu.reload' | 'menu.forceReload' | 'menu.toggleDevTools' | 'menu.resetZoom' | 'menu.zoomIn' | 'menu.zoomOut' | 'menu.togglefullscreen'
  | 'menu.minimize' | 'menu.zoom' | 'menu.front' | 'menu.fabricOnSite'
  | 'menu.speech' | 'menu.startSpeaking' | 'menu.stopSpeaking'

// WHY THE MENUS ARE SPELLED OUT rather than taken as `fileMenu` / `editMenu` / `viewMenu` roles: a menu
// role brings Electron's own submenu, in English, and its items cannot be relabelled. Each item below is
// still the platform's ROLE — so undo, copy, paste, reload and the rest keep their accelerators and their
// behaviour — and carries a label from the registry. The default macOS File menu also bound Cmd+W to
// "Close Window" behind a role nobody could see, beside our Close Tab; spelled out, exactly one item
// claims Cmd+W (test/menu.test.mjs).
export function menuTemplate(actions: MenuActions): Electron.MenuItemConstructorOptions[] {
  const l = actions.label
  const item = (role: Electron.MenuItemConstructorOptions['role'], key: MenuLabel): Electron.MenuItemConstructorOptions => ({ role, label: l(key) })
  const sep: Electron.MenuItemConstructorOptions = { type: 'separator' }
  return [
    ...(isMac
      ? ([{
          label: 'Fabric',
          submenu: [
            item('about', 'menu.about'),
            sep,
            item('services', 'menu.services'),
            sep,
            item('hide', 'menu.hide'),
            item('hideOthers', 'menu.hideOthers'),
            item('unhide', 'menu.unhide'),
            sep,
            item('quit', 'menu.quit')
          ]
        }] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: l('menu.file'),
      submenu: [
        {
          label: l('menu.closeTab'),
          accelerator: 'CmdOrCtrl+W',
          click: actions.closeActiveTab
        },
        {
          // The window is still closable, one modifier away, which is where
          // every other tabbed application puts it.
          label: l('menu.closeWindow'),
          accelerator: 'CmdOrCtrl+Shift+W',
          role: 'close'
        },
        ...(isMac ? [] : [sep, item('quit', 'menu.quit')])
      ]
    },
    {
      label: l('menu.edit'),
      submenu: [
        item('undo', 'menu.undo'),
        item('redo', 'menu.redo'),
        sep,
        item('cut', 'menu.cut'),
        item('copy', 'menu.copy'),
        item('paste', 'menu.paste'),
        ...(isMac ? [item('pasteAndMatchStyle', 'menu.pasteAndMatchStyle')] : []),
        item('delete', 'menu.delete'),
        item('selectAll', 'menu.selectAll'),
        // The Speech submenu Electron's own macOS Edit menu carries, kept so spelling the menu out loses nothing.
        ...(isMac
          ? [sep, { label: l('menu.speech'), submenu: [item('startSpeaking', 'menu.startSpeaking'), item('stopSpeaking', 'menu.stopSpeaking')] }]
          : [])
      ]
    },
    {
      label: l('menu.view'),
      submenu: [
        item('reload', 'menu.reload'),
        item('forceReload', 'menu.forceReload'),
        item('toggleDevTools', 'menu.toggleDevTools'),
        sep,
        item('resetZoom', 'menu.resetZoom'),
        item('zoomIn', 'menu.zoomIn'),
        item('zoomOut', 'menu.zoomOut'),
        sep,
        item('togglefullscreen', 'menu.togglefullscreen')
      ]
    },
    {
      label: l('menu.window'),
      submenu: [
        item('minimize', 'menu.minimize'),
        item('zoom', 'menu.zoom'),
        ...(isMac ? [sep, item('front', 'menu.front')] : [])
      ]
    },
    {
      role: 'help',
      label: l('menu.help'),
      submenu: [
        {
          // The public page; the source repository is private (docs/brand/channels.md).
          label: l('menu.fabricOnSite'),
          click: () => actions.openExternal('https://passioncode.ai/fabric/')
        }
      ]
    }
  ]
}
