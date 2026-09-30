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
}

export function menuTemplate(actions: MenuActions): Electron.MenuItemConstructorOptions[] {
  return [
    ...(isMac
      ? ([{ role: 'appMenu' } as Electron.MenuItemConstructorOptions])
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: actions.closeActiveTab
        },
        {
          // The window is still closable, one modifier away, which is where
          // every other tabbed application puts it.
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+Shift+W',
          role: 'close'
        },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([{ type: 'separator' }, { role: 'front' }] as Electron.MenuItemConstructorOptions[])
          : [])
      ]
    },
    { role: 'viewMenu' },
    {
      role: 'help',
      submenu: [
        {
          // The public page; the source repository is private (docs/brand/channels.md).
          label: 'Fabric on PassionCode.ai',
          click: () => actions.openExternal('https://passioncode.ai/fabric/')
        }
      ]
    }
  ]
}
