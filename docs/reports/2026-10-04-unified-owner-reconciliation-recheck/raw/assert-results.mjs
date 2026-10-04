import {readFileSync} from 'node:fs'
const r=JSON.parse(readFileSync(process.argv[2],'utf8'))
const matched=r.results.filter(x=>x.matched).length
console.log(JSON.stringify({expectations:r.results.length,matched,failed:r.results.length-matched}))
process.exit(matched===r.results.length?0:1)
