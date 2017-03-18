#!/usr/bin/env node

'use strict'

const fs = require('fs')
const { bold, cyan, red} = require('chalk')
const { prompt } = require('inquirer')
const createSpinner = require('ora')
const promisify = require('bluebird').promisify
const cfr = require('cosmos-fundraiser')
const { FUNDRAISER_CONTRACT } = cfr.ethereum
const sendBackupEmail = promisify(cfr.sendEmail)
cfr.bitcoin.waitForPayment = promisify(cfr.bitcoin.waitForPayment)
cfr.decryptSeed = promisify(cfr.decryptSeed)
cfr.encryptSeed = promisify(cfr.encryptSeed)
cfr.ethereum.fetchAtomRate = promisify(cfr.ethereum.fetchAtomRate)

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

Thank you for your interest in donating funds for the development of The Cosmos Network.
Let's get started!
`)

async function main () {
  let walletPath = process.argv[2] || './cosmos_fundraiser.wallet'
  let wallet = await createOrLoadWallet(walletPath)
  let currency = await promptForCurrency()
  if (currency === 'BTC') {
    let tx = await waitForBtcTx(wallet.addresses.bitcoin)
    await finalizeBtcDonation(wallet, tx)
  } else {
    await makeEthDonation(wallet)
  }
}

async function createOrLoadWallet (path) {
  try {
    // test if the wallet exists and we have access
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
      let seed = await cfr.decryptSeed(wallet, password)
      return cfr.deriveWallet(seed)
    } catch (err) {
      console.log(red('Incorrect password'))
    }
  }
}

async function createWallet (path) {
  console.log(
    `It looks like you have not yet created a Cosmos wallet.\n`,
    `Let's create one, and encrypt it using a password.\n`,
    `The password must be long and difficult to guess, otherwise someone who gets control of your wallet may be able to decrypt it and steal your Atoms!\n`,
    red(`WARNING: If you lose your password, you will lose access to your Atoms.\n`),
    cyan(`WARNING: There is no way to recover or reset your password.\n`),
    red(`WARNING: Write down your password and DO NOT LOSE IT!\n`),
    cyan(`WARNING: DO NOT LOSE YOUR PASSWORD!\n`),
    red(`WARNING: DO NOT LOSE YOUR PASSWORD!\n`),
    cyan(`WARNING: DO NOT LOSE YOUR PASSWORD!\n`)
  )

  let password = await passwordCreatePrompt()
  let seed = cfr.generateSeed()
  let wallet = cfr.deriveWallet(seed)
  let encryptSpinner = createSpinner('Encrypting wallet...').start()
  let encryptedSeed = await cfr.encryptSeed(seed, password)
  encryptSpinner.succeed('Encrypted wallet')

  let saveSpinner = createSpinner(`Saving wallet...`).start()
  let walletBytes = cfr.encodeWallet(encryptedSeed)
  fs.writeFileSync(path, walletBytes)
  saveSpinner.succeed(`Saved wallet to ${path}`)

  let emailAddress = await emailAddressPrompt()
  let emailSpinner = createSpinner(`Sending copy of wallet to ${emailAddress}...`).start()
  await sendBackupEmail(emailAddress, walletBytes)
  emailSpinner.succeed(`Sent copy of wallet to ${emailAddress}`)

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

async function emailAddressPrompt () {
  do {
    var { email } = await prompt({
      name: 'email',
      message: 'Enter your email address to receive a copy of your wallet:'
    })
    var { confirm } = await prompt({
      name: 'confirm',
      message: 'Enter email address again to confirm:'
    })
    if (confirm !== email) {
      console.log(red('Email addresses do not match.'))
    }
  } while (confirm !== email)
  return email
}

async function promptForCurrency () {
  let { currency } = await prompt({
    type: 'list',
    choices: [ 'BTC', 'ETH' ],
    name: 'currency',
    message: 'Which currency will you make your donation in?'
  })
  return currency
}

async function waitForBtcTx (address) {
  console.log(`
${bold('Exchange rate:')} 1 BTC : ${cfr.bitcoin.ATOMS_PER_BTC} ATOM
${bold('Minimum donation:')} ${cfr.bitcoin.MINIMUM_AMOUNT / 1e8} BTC

Your intermediate Bitcoin address is:
${cyan(address)}

Send BTC to this address to continue with your contribution.
This address is owned by you, so you can get the coins back if you
change your mind.
  `)
  let spinner = createSpinner('Waiting for a transaction...').start()
  let inputs = await cfr.bitcoin.waitForPayment(address)
  spinner.succeed('Got payment of ' + cyan(`${inputs.amount / 1e8} BTC`))
  return inputs
}

async function finalizeBtcDonation (wallet, inputs) {
  let finalTx = cfr.bitcoin.createFinalTx(wallet, inputs)
  console.log(`
Ready to finalize contribution:
  ${bold('Donating:')} ${finalTx.paidAmount / 1e8} BTC
  ${bold('Bitcoin transaction fee:')} ${finalTx.feeAmount / 1e8} BTC
  ${bold('Atom Equivalent:')} ${finalTx.atomAmount} ATOM
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

async function makeEthDonation (wallet) {
  let tx = cfr.ethereum.getTransaction(
    `0x${wallet.addresses.cosmos}`,
    wallet.addresses.ethereum
  )
  let ethRate = await cfr.ethereum.fetchAtomRate(FUNDRAISER_CONTRACT)
  console.log(`
  ${bold('Exchange rate:')} 1 ETH : ${ethRate} ATOM
  ${bold('Minimum donation:')} ${cfr.ethereum.MIN_DONATION} ETH
  ${bold('Your Cosmos address:')} ${wallet.addresses.cosmos}

Here's your donation transaction:
${cyan('  ' + JSON.stringify(tx, null, '    ').replace('}', '  }'))}

To make your donation, copy and paste this information into a wallet
such as MyEtherWallet or Mist. Be sure to include an amount of ETH to
donate! Your Cosmos address is included in the data, and the donation
will be recorded for that address in the smart contract.

Thank you for participating in the Cosmos Fundraiser!
  `)
}

main().catch((err) => console.error(red(`An error occurred. Please ask for help.\n${err.stack}`)))
