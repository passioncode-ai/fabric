// Installing the menu (M111). The shape — and the risk in it — is in
// `menuTemplate.ts`, which imports nothing executable so a probe can read it.
// It is installed again whenever the operator changes the language (0.3.3), so
// the menu speaks what the windows speak.

import { BrowserWindow, Menu, shell } from 'electron'
import { translator, type Locale } from '../renderer/src/i18n/translate.ts'
import { menuTemplate } from './menuTemplate.ts'
import { IPC } from '../shared/types.ts'
import { sendIfReceives, type WindowRegistry } from './windowRegistry.ts'

export function installMenu(locale: Locale, windows: Pick<WindowRegistry, 'receives'>): void {
  const say = translator(locale)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate({
        // CO-091: Cmd+W reaches the focused window only when its kind may receive the channel (the main window's
        // tabs); a session or editor window is not sent a message it has no listener for.
        closeActiveTab: () => void sendIfReceives(windows, BrowserWindow.getFocusedWindow(), IPC.tabsCloseActive),
        openExternal: (url) => void shell.openExternal(url),
        label: (key) => say(key)
      })
    )
  )
}
