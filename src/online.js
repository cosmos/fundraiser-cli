'use strict'

const { bold, cyan, red, green } = require('chalk')
const { prompt } = require('inquirer')
const createSpinner = require('ora')
const promisify = require('bluebird').promisify
const cfr = require('cosmos-fundraiser')
const { FUNDRAISER_CONTRACT } = cfr.ethereum
cfr.bitcoin.pushTx = promisify(cfr.bitcoin.pushTx)
cfr.bitcoin.fetchFeeRate = promisify(cfr.bitcoin.fetchFeeRate)
cfr.bitcoin.waitForPayment = promisify(cfr.bitcoin.waitForPayment)
cfr.ethereum.fetchAtomRate = promisify(cfr.ethereum.fetchAtomRate)

async function main () {
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

  let wallet = await createOrInputWallet()
  let currency = await promptForCurrency()
  if (currency === 'BTC') {
    let tx = await waitForBtcTx(wallet.addresses.bitcoin)
    await finalizeBtcDonation(wallet, tx)
  } else {
    await makeEthDonation(wallet)
  }
}

async function createOrInputWallet () {
  let choices = [ 'Generate wallet', 'Input existing wallet' ]
  let { action } = await prompt({
    type: 'list',
    choices,
    name: 'action',
    message: 'Generate a new wallet, or use an existing one?'
  })
  let generate = choices[0]
  if (action === generate) {
    return await createWallet()
  } else {
    return await inputWallet()
  }
}

async function createWallet () {
  let seed = cfr.generateSeed()

  console.log(`
Let's generate your Cosmos wallet. You will need this in the future to
access your Atoms.

Here is your wallet phrase:
${green(seed.toString('hex'))}

${red(`KEEP YOUR WALLET SECRET AND DO NOT LOSE IT!`)}
${cyan(`WARNING: If you lose your wallet, you will lose access to your Atoms.`)}
${red(`WARNING: If someone gets your wallet phrase, they can take your Atoms.`)}
${cyan(`WARNING: Write down your wallet phrase and DO NOT LOSE IT!`)}
${red(`WARNING: DO NOT LOSE YOUR WALLET!`)}
${cyan(`WARNING: DO NOT LOSE YOUR WALLET!`)}
${red(`WARNING: DO NOT LOSE YOUR WALLET!`)}
  \n`)

  return cfr.deriveWallet(seed)
}

async function inputWallet () {
  let { seed } = await prompt({
    name: 'seed',
    message: 'Please enter your 12-word wallet phrase:'
  })
  return cfr.deriveWallet(seed)
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
  let feeSpinner = createSpinner('Fetching BTC transaction fee rate...')
  let feeRate = await cfr.bitcoin.fetchFeeRate()
  feeSpinner.stop()
  let finalTx = cfr.bitcoin.createFinalTx(wallet, inputs.utxos, feeRate)
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
  await cfr.bitcoin.pushTx(finalTx.tx.toHex())
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
  let spinner = createSpinner('Fetching ATOM/ETH exchange rate...')
  let ethRate = await cfr.ethereum.fetchAtomRate(FUNDRAISER_CONTRACT)
  spinner.stop()
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

module.exports = main
