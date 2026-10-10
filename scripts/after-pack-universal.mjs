// electron-builder `afterPack` (apps/desktop/electron-builder.yml): makes node-pty's prebuilds
// universal in every packed macOS app — each architecture's and the joined universal one — and,
// on the joined app, refuses any Mach-O without both slices (scripts/lib/universal-mac.mjs).
import path from 'node:path'
import { createRequire } from 'node:module'
import { foreignPrebuilds, thinMachO, universalizeNodePty } from './lib/universal-mac.mjs'

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const module = path.join(app, 'Contents/Resources/app.asar.unpacked/node_modules/node-pty')
  const source = path.dirname(createRequire(path.join(context.packager.info.appDir, 'package.json')).resolve('node-pty/package.json'))
  const foreign = foreignPrebuilds(module)
  if (foreign.length) throw new Error(`Other platforms' node-pty prebuilds reached the Mac app: ${foreign.join(', ')} (electron-builder.yml files filter)`)
  universalizeNodePty(module, source)
  // Arch.universal is 4 in builder-util; the per-architecture apps are thin by design.
  if (context.arch === 4) {
    const thin = thinMachO(app)
    if (thin.length) throw new Error(`The universal Fabric.app carries Mach-O files without both slices: ${thin.slice(0, 5).join(', ')}`)
  }
}
