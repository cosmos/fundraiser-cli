#!/usr/bin/env node

'use strict'

const { cyan, yellow } = require('chalk')
const inquirer = require('inquirer')
const ora = require('ora')

console.log(
cyan(`
 .d8888b.   .d88888b.   .d8888b.  888b     d888  .d88888b.   .d8888b.
d88P  Y88b d88P" "Y88b d88P  Y88b 8888b   d8888 d88P" "Y88b d88P  Y88b
888    888 888     888 Y88b.      88888b.d88888 888     888 Y88b.
888        888     888  "Y888b.   888Y88888P888 888     888  "Y888b.
888        888     888     "Y88b. 888 Y888P 888 888     888     "Y88b.
888    888 888     888       "888 888  Y8P  888 888     888       "888
Y88b  d88P Y88b. .d88P Y88b  d88P 888   "   888 Y88b. .d88P Y88b  d88P
 "Y8888P"   "Y88888P"   "Y8888P"  888       888  "Y88888P"   "Y8888P"
`),
`
Welcome to the Cosmos Fundraiser!

Let's get started so you can purchase Atoms, the token used to
participate in the Cosmos network.
`,
yellow(`
TODO: more information
`)
)

let spinner = ora('Generating wallet...').start()
// TODO:
// check for wallet file,
//   if no wallet,
//     create seed/wallet
//     get user password + confirm, encrypt wallet and save
//     show addresses, exit?
//   else,
//     load encrypted seed
//     get user password, decrypt, derive wallet
//     show addresses
// check/wait for unspent txs
// ask for confirmation, finalize (create exodus tx, send)
