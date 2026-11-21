import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '../tokens.paperclip.css'
import '../tokens.passioncode.css'
import '../tokens.app.css'
import '@excalidraw/excalidraw/index.css'
import './canvas.css'
import { ErrorBoundary, installWindowErrorReporting, reportRendererError } from '../CrashBoundary'
import { I18nProvider, type Locale } from '../i18n'
import { CanvasApp } from './CanvasApp'
import { APP_SETTINGS_DEFAULTS, type AppSettings } from '../../../shared/types'
import { DEFAULT_CANVAS_ID, isCanvasId } from '../../../shared/canvas'

function CanvasWindow(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  useEffect(() => {
    window.fabric.settings.read().then(setSettings).catch(() => setSettings(APP_SETTINGS_DEFAULTS))
  }, [])
  if (!settings) return <div className="booting" />
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  document.documentElement.lang = settings.locale
  const asked = new URLSearchParams(window.location.search).get('canvas')
  return (
    <I18nProvider locale={settings.locale as Locale}>
      <CanvasApp canvasId={isCanvasId(asked) ? asked : DEFAULT_CANVAS_ID} dark={dark} locale={settings.locale} />
    </I18nProvider>
  )
}

export function mountCanvas(): void {
  installWindowErrorReporting()
  createRoot(document.getElementById('root')!, {
    onUncaughtError: (error, info) => reportRendererError(error, info.componentStack)
  }).render(
    <React.StrictMode>
      <ErrorBoundary>
        <CanvasWindow />
      </ErrorBoundary>
    </React.StrictMode>
  )
}
