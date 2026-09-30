import assert from 'node:assert/strict'
import http from 'node:http'
import { closeHttpServer } from '../src/main/closeHttpServer.ts'
const server=http.createServer((_req,_res)=>{})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
let req
await new Promise(resolve=>{server.once('request',resolve);req=http.get(`http://127.0.0.1:${server.address().port}/`,()=>{});req.on('error',()=>{})})
const began=performance.now()
await closeHttpServer(server,20)
assert.ok(performance.now()-began<500,'active HTTP client must not hold app quit indefinitely')
assert.equal(server.listening,false)
req.destroy()
console.log('PASS owned HTTP shutdown: active hanging request closes within grace; listener no longer accepts work')
