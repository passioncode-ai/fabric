// The CEO popup's document (ADR-0197 §2): its own entry, so `ceo.html` carries a policy of its own (the realtime
// socket), and the window renders the CEO's console, its composer and its call, nothing of the main shell.
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter-tight/400.css'
import '@fontsource/inter-tight/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/jetbrains-mono/400.css'
import './tokens.paperclip.css'
import './tokens.passioncode.css'
import './tokens.app.css'
import './styles.css'
import './components.css'
import '@xterm/xterm/css/xterm.css'
import { ErrorBoundary, installWindowErrorReporting, reportRendererError } from './CrashBoundary'
import { I18nProvider, type Locale } from './i18n'
import { CeoPopup } from './ceo/CeoPopup'
import { APP_SETTINGS_DEFAULTS, type AppSettings } from '../../shared/types'

installWindowErrorReporting()

function CeoWindow(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  useEffect(() => {
    window.fabric.settings.read().then(setSettings).catch(() => setSettings(APP_SETTINGS_DEFAULTS))
  }, [])
  useEffect(() => {
    if (!settings) return
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    document.documentElement.lang = settings.locale
  }, [settings])
  if (!settings) return <div className="booting" />
  return <I18nProvider locale={settings.locale as Locale}><CeoPopup /></I18nProvider>
}

createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) => reportRendererError(error, info.componentStack)
}).render(
  <React.StrictMode>
    <ErrorBoundary>
      <CeoWindow />
    </ErrorBoundary>
  </React.StrictMode>
)
