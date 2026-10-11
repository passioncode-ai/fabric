// The sandboxed preload: it reads the kind the main process gave this window and exposes that kind's part
// of the bridge (CO-091; `api.ts#exposedApi`). The main process checks every call regardless.

import { contextBridge, ipcRenderer } from 'electron'
import { windowKindFromArgv } from '../shared/ipcWindowPolicy.ts'
import { exposedApi } from './api.ts'

contextBridge.exposeInMainWorld('fabric', exposedApi(windowKindFromArgv(process.argv), ipcRenderer))
