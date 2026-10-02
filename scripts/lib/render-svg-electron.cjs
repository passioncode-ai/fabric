// Render one SVG to a transparent PNG at its own size with Electron's offscreen renderer.
// Usage: electron scripts/lib/render-svg-electron.cjs <in.svg> <out.png> <size>
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const [input, output, sizeArg] = process.argv.slice(-3)
const size = Number(sizeArg)
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: size, height: size, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } })
  const svg = readFileSync(input, 'utf8')
  const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}img{display:block;width:${size}px;height:${size}px}</style></head><body><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`
  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'))
  await win.webContents.executeJavaScript('document.images[0].decode()')
  await new Promise((r) => setTimeout(r, 300))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  writeFileSync(output, image.resize({ width: size, height: size }).toPNG())
  app.exit(0)
}).catch((e) => { console.error(e); app.exit(1) })
