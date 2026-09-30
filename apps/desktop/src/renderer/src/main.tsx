import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// The pack names three faces (Inter Tight, Inter, JetBrains Mono) and its whole
// identity is that pairing. A desktop app cannot fetch them at runtime, so they
// are bundled: without this the display and body roles collapse to the same
// system face and the pack renders as a lookalike.
import '@fontsource/inter-tight/400.css'
import '@fontsource/inter-tight/600.css'
import '@fontsource/inter-tight/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
// Order matters: the pack's token layer, then the app's semantic aliases over
// it, then component styles that may only consume var(--…).
import './tokens.paperclip.css'
import './tokens.passioncode.css'
import './tokens.app.css'
import './styles.css'
// M117 — the component set, after the app stylesheet so the set owns the
// classes it declares while the screens are being moved onto it.
import './components.css'
import '@xterm/xterm/css/xterm.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
