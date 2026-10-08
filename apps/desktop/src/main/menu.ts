// Installing the menu (M111). The shape — and the risk in it — is in
// `menuTemplate.ts`, which imports nothing executable so a probe can read it.
// It is installed again whenever the operator changes the language (0.3.3), so
// the menu speaks what the windows speak.

import { BrowserWindow, Menu, shell } from 'electron'
import { translator, type Locale } from '../renderer/src/i18n/translate.ts'
import { menuTemplate } from './menuTemplate.ts'

export function installMenu(locale: Locale): void {
  const say = translator(locale)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate({
        closeActiveTab: () =>
          BrowserWindow.getFocusedWindow()?.webContents.send('tab:closeActive'),
        openExternal: (url) => void shell.openExternal(url),
        label: (key) => say(key)
      })
    )
  )
}
