'use strict'

const { readFileSync } = require('fs')
const promisify = require('bluebird').promisify
const cfr = require('cosmos-fundraiser')
const { FUNDRAISER_CONTRACT } = cfr.ethereum
cfr.bitcoin.pushTx = promisify(cfr.bitcoin.pushTx)
cfr.bitcoin.fetchFeeRate = promisify(cfr.bitcoin.fetchFeeRate)
cfr.bitcoin.waitForPayment = promisify(cfr.bitcoin.waitForPayment)
cfr.decryptSeed = promisify(cfr.decryptSeed)
cfr.encryptSeed = promisify(cfr.encryptSeed)
cfr.ethereum.fetchAtomRate = promisify(cfr.ethereum.fetchAtomRate)

const commands = {
  genwallet,
  ethtx
}

function fail (message) {
  console.log(message)
  process.exit(1)
}

async function runCommand (commandName, args) {
  let command = commands[commandName]
  if (!command) {
    fail(`"${commandName}" is not a valid command`)
  }
  await command(...args)
}

async function genwallet () {
  // TODO: don't convert to hex once we merge in HD wallets (seed will just be a string)
  let seed = cfr.generateSeed().toString('hex')
  console.log(seed)
}

function readWallet (path) {
  if (!path) {
    throw Error('Must specify wallet path')
  }
  let seed = readFileSync(path)
  // TODO: don't read as hex once we merge HD wallets
  seed = Buffer(seed.toString().trim(), 'hex')
  return cfr.deriveWallet(seed)
}

async function ethtx (walletPath) {
  if (!walletPath) {
    fail(`Usage: cosmos-fundraiser ethtx <pathToWalletFile>`)
  }
  let wallet = readWallet(walletPath)
  let tx = cfr.ethereum.getTransaction(
    `0x${wallet.addresses.cosmos}`,
    wallet.addresses.ethereum
  )
  console.log(JSON.stringify(tx, null, '  '))
}

module.exports = runCommand
