/**
 * Where the installed Fabric keeps its local stack project, as a person types it on each OS:
 * `app.getPath('userData')/stack` (`main/env.ts#bundledStackRoot`). Electron names the data folder after
 * package.json's `name` here, since the package has no `productName`; changing either would move every install's
 * data. Held to package.json by `test/stack-folder.test.mjs` (0.3.4 verification, iteration 2, UX-1/DO-1; 0.3.5 REQ-06).
 */
export function stackFolderFor(platform: string): string {
  if (platform === 'win32') return '%APPDATA%\\@fabric\\desktop\\stack'
  if (platform === 'linux') return '~/.config/@fabric/desktop/stack'
  return '~/Library/Application Support/@fabric/desktop/stack'
}

/** This OS's folder; `darwin`'s where there is no `process` (the renderer). */
export const STACK_FOLDER = stackFolderFor(typeof process === 'undefined' ? 'darwin' : process.platform)
