#!/usr/bin/env node

'use strict'

const fs = require('fs')
const { bold, cyan, red } = require('chalk')
const { prompt } = require('inquirer')
const createSpinner = require('ora')
const cfr = require('cosmos-fundraiser')

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

Let's get started so you can donate and receive Atoms, the tokens used
to participate in the Cosmos network.
`)

async function main () {
  let walletPath = process.argv[2] || './cosmos_fundraiser.wallet'
  let wallet = await createOrLoadWallet(walletPath)
  let tx = await waitForTx(wallet.addresses.bitcoin)
  await finalize(wallet, tx)
}

async function createOrLoadWallet (path) {
  try {
    // test if we wallet exists and we have access
    fs.accessSync(path)
    console.log(`Found existing wallet file: ${path}`)
    return await loadWallet(path)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return await createWallet(path)
  }
}

async function loadWallet (path) {
  let walletBytes = fs.readFileSync(path)
  let wallet = cfr.decodeWallet(walletBytes)
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
  let encryptSpinner = createSpinner('Encrypting wallet...').start()
  let encryptedSeed = cfr.encryptSeed(seed, password)
  encryptSpinner.succeed('Encrypted wallet')

  let saveSpinner = createSpinner(`Saving wallet...`).start()
  let walletBytes = cfr.encodeWallet(encryptedSeed)
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

function waitForTx (address) {
  console.log(`
${bold('Exchange rate:')} 1 BTC : ${cfr.bitcoin.ATOMS_PER_BTC} ATOM
${bold('Minimum donation:')} ${cfr.bitcoin.MINIMUM_AMOUNT / 1e8} BTC

Your intermediate Bitcoin address is:
${cyan(address)}

Send coins to this address to continue with your contribution.
This address is owned by you, so you can get the coins back if you
change your mind.
  `)
  let spinner = createSpinner('Waiting for a transaction...').start()
  return new Promise((resolve, reject) => {
    cfr.bitcoin.waitForPayment(address, (err, inputs) => {
      if (err) return reject(err)
      spinner.succeed('Got payment of ' + cyan(`${inputs.amount / 1e8} BTC`))
      resolve(inputs)
    })
  })
}
``
async function finalize (wallet, inputs) {
  let finalTx = cfr.bitcoin.createFinalTx(wallet, inputs)
  console.log(`
Ready to finalize contribution:
  ${bold('Donating:')} ${finalTx.paidAmount / 1e8} BTC
  ${bold('Bitcoin transaction fee:')} ${finalTx.feeAmount / 1e8} BTC
  ${bold('Receiving:')} ${finalTx.atomAmount} ATOM
  ${bold('Cosmos address:')} ${wallet.addresses.cosmos}
  `)

  let { agree } = await prompt({
    type: 'confirm',
    name: 'agree',
    message: 'Have you read and understand the Terms of Service and Donation Agreement?',
    default: false
  })
  if (!agree) {
    console.log(red(`
You can read the Terms of Service and Donation Agreement here:
TODO: links
    `))
    return
  }

  let { confirm } = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Finalize contribution? You will NOT be able undo this transaction:',
    default: false
  })
  if (!confirm) return

  let spinner = createSpinner('Broadcasting transaction...')
  await new Promise((resolve, reject) => {
    cfr.bitcoin.pushTx(finalTx.tx, (err) => {
      console.log(err)
      if (err) return reject(err)
      resolve()
    })
  })
  spinner.succeed('Transaction sent!')
  let txid = finalTx.tx.getId()
  console.log('Bitcoin TXID: ' + cyan(txid))
  console.log('Thank you for participating in the Cosmos fundraiser!')
}

main().catch((err) => console.error(red(`An error occurred. Please ask for help.\n${err.stack}`)))
