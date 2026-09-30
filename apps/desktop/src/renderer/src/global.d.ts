import type { FabricApi } from '../../shared/types'

declare global {
  interface Window {
    fabric: FabricApi
  }
}

export {}
