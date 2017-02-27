#!/usr/bin/env node

'use strict'

const fs = require('fs')
const { cyan, yellow, green, red } = require('chalk')
const { prompt } = require('inquirer')
const ora = require('ora')
const struct = require('varstruct')
const cfr = require('cosmos-fundraiser')
const pkg = require('./package.json')

console.log(cyan(`
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

If you'd like to load an existing wallet file, run this tool with:
`,
green(`$ ${pkg.bin} <pathToWallet>
`),
yellow(`
TODO: more information
`)
)

async function main () {
  let walletPath = './cosmos_fundraiser.wallet'
  let wallet = await createOrLoadWallet(walletPath)
  // TODO: check/wait for unspent txs
  // TODO: ask for confirmation, finalize (create exodus tx, send)
}


const Wallet = struct([
  { name: 'encryptedSeed', type: struct.VarBuffer(struct.Byte) },
  { name: 'salt', type: struct.VarBuffer(struct.Byte) },
  { name: 'iv', type: struct.VarBuffer(struct.Byte) }
])

async function createOrLoadWallet (path) {
  try {
    // test if we wallet exists and we have access
    fs.accessSync(path)
    console.log(`Found wallet file: ${path}`)
    return await loadWallet(path)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return await createWallet(path)
  }
}

async function loadWallet (path) {
  let walletBytes = fs.readFileSync(path)
  let wallet = Wallet.decode(walletBytes)
  while (true) {
    let { password } = await prompt({
      type: 'password',
      name: 'password',
      message: 'Enter your wallet password:'
    })
    try {
      let seed = cfr.decryptSeed(wallet, password)
      return cfr.deriveWallet(seed)
    } catch (err) {
      console.log(red('Incorrect password'))
    }
  }
}

async function createWallet (path) {
  console.log(
    `We will now create a Cosmos wallet and a password.\n`,
    red(`WARNING: If you lose your password, you will lose access to your Atoms. There is no way to recover or reset your password. Write down your password and DO NOT LOSE IT!`)
  )

  let password = await passwordCreatePrompt()
  let seed = cfr.generateSeed()
  let wallet = cfr.deriveWallet(seed)
  let encryptSpinner = ora('Encrypting wallet...').start()
  let encryptedSeed = cfr.encryptSeed(seed, password)
  encryptSpinner.succeed('Encrypted wallet')

  let saveSpinner = ora(`Saving wallet...`).start()
  let walletBytes = Wallet.encode(encryptedSeed)
  fs.writeFileSync(path, walletBytes)
  saveSpinner.succeed(`Saved wallet to ${path}`)

  return wallet
}

async function passwordCreatePrompt () {
  do {
    var { password } = await prompt({
      type: 'password',
      name: 'password',
      message: 'Choose a password:',
      validate (password) {
        if (password.length < 12) return 'Must be at least 12 characters'
        // TODO: more thorough password safety rules
        return true
      }
    })
    var { confirm } = await prompt({
      type: 'password',
      name: 'confirm',
      message: 'Enter password again to confirm:'
    })
    if (confirm !== password) {
      console.log(red('Passwords do not match.'))
    }
  } while (confirm !== password)
  return password
}

main().catch((err) => { throw err })
