#!/usr/bin/env node

'use strict'

const { red } = require('chalk')
const doOnlineFlow = require('../lib/online.js')

async function main () {
  let command = process.argv[2]
  let args = process.argv.slice(3)

  if (command == null) {
    return await doOnlineFlow()
  }
}

main().catch((err) => {
  console.error(red(`An error occurred. Please ask for help.\n${err.stack}`))
})
