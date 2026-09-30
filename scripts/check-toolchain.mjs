#!/usr/bin/env node
import path from 'node:path'
import { verifyToolchain } from './lib/toolchain.mjs'
const root = path.resolve(import.meta.dirname, '..')
const receipt = verifyToolchain(root)
console.log(JSON.stringify({ ...receipt, scope: 'desktop-bundle-and-packager-versions', reproducibility: 'not_established', signing: 'not_checked' }))
if (receipt.status !== 'verified') process.exitCode = 1
