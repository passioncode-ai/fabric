import type { FabricApi } from '../../shared/types'

declare global {
  interface Window {
    fabric: FabricApi
    /** Where Excalidraw loads its fonts from (ADR-0201 §2): the app's own files, set by the canvas page. */
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

export {}
