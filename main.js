#!/usr/bin/env node

'use strict'

const fs = require('fs')
const { bold, cyan, yellow, green, red } = require('chalk')
const { prompt } = require('inquirer')
const createSpinner = require('ora')
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
  let testnet = process.env.NODE_ENV === 'development'
  let walletPath = process.argv[2] || './cosmos_fundraiser.wallet'
  let wallet = await createOrLoadWallet(walletPath, testnet)
  let tx = await waitForTx(wallet.addresses.bitcoin, testnet)
  await finalize(wallet, tx, testnet)
}

const Wallet = struct([
  { name: 'encryptedSeed', type: struct.VarBuffer(struct.Byte) },
  { name: 'salt', type: struct.VarBuffer(struct.Byte) },
  { name: 'iv', type: struct.VarBuffer(struct.Byte) }
])

async function createOrLoadWallet (path, testnet) {
  try {
    // test if we wallet exists and we have access
    fs.accessSync(path)
    console.log(`Found existing wallet file: ${path}`)
    return await loadWallet(path, testnet)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return await createWallet(path, testnet)
  }
}

async function loadWallet (path, testnet) {
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
      return cfr.deriveWallet(seed, testnet)
    } catch (err) {
      console.log(red('Incorrect password'))
    }
  }
}

async function createWallet (path, testnet) {
  console.log(
    `We will now create a Cosmos wallet and a password.\n`,
    red(`WARNING: If you lose your password, you will lose access to your Atoms. There is no way to recover or reset your password. Write down your password and DO NOT LOSE IT!`)
  )

  let password = await passwordCreatePrompt()
  let seed = cfr.generateSeed()
  let wallet = cfr.deriveWallet(seed, testnet)
  let encryptSpinner = createSpinner('Encrypting wallet...').start()
  let encryptedSeed = cfr.encryptSeed(seed, password)
  encryptSpinner.succeed('Encrypted wallet')

  let saveSpinner = createSpinner(`Saving wallet...`).start()
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

function waitForTx (address, testnet) {
  console.log(`
${bold('Exchange rate:')} 1 BTC : ${cfr.bitcoin.ATOMS_PER_BTC} ATOM
${bold('Minimum amount:')} ${cfr.bitcoin.MINIMUM_AMOUNT / 1e8} BTC

Your intermediate Bitcoin address is:
${cyan(address)}

Send coins to this address to continue with your purchase.
This address is owned by you, so you can get the coins back if you
change your mind.
  `)
  let spinner = createSpinner('Waiting for a transaction...').start()
  return new Promise((resolve, reject) => {
    cfr.bitcoin.waitForTx(address, { testnet }, (err, tx) => {
      if (err) return reject(err)
      spinner.succeed('Received transaction:\n' + cyan(tx.tx.getId()))
      resolve(tx)
    })
  })
}

async function finalize (wallet, tx, testnet) {
  let finalTx = cfr.bitcoin.createFinalTx(wallet, tx, testnet)
  console.log(`
Ready to finalize purchase:
  ${bold('Paid:')} ${finalTx.paidAmount / 1e8} BTC
  ${bold('Transaction fee:')} ${finalTx.feeAmount / 1e8} BTC
  ${bold('Purchasing:')} ${finalTx.atomAmount} ATOM
  ${bold('Cosmos address:')} ${wallet.addresses.cosmos}
  `)

  let { agree } = await prompt({
    type: 'confirm',
    name: 'agree',
    message: 'Have you read and understand the Terms of Service and Purchase Agreement?',
    default: false
  })
  if (!agree) {
    console.log(red(`
You can read the Terms of Service and Purchase Agreement here:
TODO: links
    `))
    return
  }

  let { confirm } = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Finalize purchase of Atoms? You will NOT be able undo this transaction:',
    default: false
  })
  if (!confirm) return

  let spinner = createSpinner('Broadcasting transaction...')
  let txid = await new Promise((resolve, reject) => {
    cfr.bitcoin.pushTx(finalTx.tx, { testnet }, (err, txid) => {
      if (err) return reject(err)
      resolve(txid)
    })
  })
  spinner.succeed('Transaction sent!')
  console.log('TXID: ' + cyan(txid))
  console.log('Thank you for participating in the Cosmos fundraiser!')
}

main().catch((err) => { throw err })
