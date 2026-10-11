// electron-builder `afterPack` (electron-builder.yml). The hook itself is scripts/after-pack-universal.mjs; this file
// sits inside the app's folder because electron-builder on Windows takes apps/desktop as the workspace root and
// refuses a hook path outside it (0.3.5, CO-238; measured on windows-latest, platforms run 38069547773).
export { default } from '../../../scripts/after-pack-universal.mjs'
