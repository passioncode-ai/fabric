/**
 * Where the installed Fabric keeps its local stack project, as a person types it: `app.getPath('userData')/stack`
 * (`main/env.ts#bundledStackRoot`). Electron names the data folder after package.json's `name` here, since the
 * package has no `productName`; changing either would move every install's data. Held to package.json by
 * `test/stack-folder.test.mjs` (0.3.4 verification, iteration 2, UX-1/DO-1).
 */
export const STACK_FOLDER = '~/Library/Application Support/@fabric/desktop/stack'
