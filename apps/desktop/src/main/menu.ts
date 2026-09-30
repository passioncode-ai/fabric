// Installing the menu (M111). The shape — and the risk in it — is in
// `menuTemplate.ts`, which imports nothing executable so a probe can read it.

import { app, BrowserWindow, Menu, shell } from 'electron'
import { menuTemplate } from './menuTemplate.ts'

export function installMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate({
        closeActiveTab: () =>
          BrowserWindow.getFocusedWindow()?.webContents.send('tab:closeActive'),
        openExternal: (url) => void shell.openExternal(url)
      })
    )
  )
  void app
}
