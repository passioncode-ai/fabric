import type { Server } from 'node:http'

/** Close only this host's HTTP surface. A hanging client must not prevent app
 * quit; closing transport is not a claim that a remote effect was cancelled. */
export function closeHttpServer(server: Server, graceMs = 2000): Promise<void> {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); resolve() }
    const timer = setTimeout(() => {
      try { server.closeAllConnections() } finally { done() }
    }, Math.max(1, graceMs))
    server.close(done)
  })
}
