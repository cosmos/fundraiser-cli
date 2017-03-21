'use strict'

const { readFileSync } = require('fs')
const promisify = require('bluebird').promisify
const cfr = require('cosmos-fundraiser')
cfr.bitcoin.pushTx = promisify(cfr.bitcoin.pushTx)
cfr.bitcoin.fetchUtxos = promisify(cfr.bitcoin.fetchUtxos)

function fail (message) {
  console.log(message)
  process.exit(1)
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

async function runCommand (commandName, args) {
  let command = commands[commandName]
  if (!command) {
    fail(`"${commandName}" is not a valid command`)
  }
  await command(...args)
}

const commands = {
  async genwallet () {
    // TODO: don't convert to hex once we merge in HD wallets (seed will just be a string)
    let seed = cfr.generateSeed().toString('hex')
    console.log(seed)
  },

  async btcaddress (walletPath) {
    if (!walletPath) {
      fail(`Usage: cosmos-fundraiser btcaddress <pathToWalletFile>`)
    }
    let wallet = readWallet(walletPath)
    console.log(wallet.addresses.bitcoin)
  },

  async getutxos (btcAddress) {
    if (!btcAddress) {
      fail(`Usage: cosmos-fundraiser getoutputs <bitcoinAddress>`)
    }
    let { utxos } = await cfr.bitcoin.fetchUtxos(btcAddress)
    if (utxos.length === 0) return
    // only keep relevant fields
    utxos = utxos.map((utxo) => ({
      tx_hash: utxo.tx_hash,
      tx_output_n: utxo.tx_output_n,
      script: utxo.script,
      value: utxo.value
    }))
    console.log(JSON.stringify(utxos, null, '  '))
  },

  async constructandsigntx (walletPath, utxosPath, feeRate = 400) {
    if (!walletPath || !utxosPath) {
      fail(`
Usage: cosmos-fundraiser constructandsigntx <pathToWalletFile> <pathToUtxosFile> [feeRate]
  'feeRate' is used to calculate the Bitcoin transaction fee,
  measured in satohis per byte`)
    }
    let wallet = readWallet(walletPath)
    let utxosJson = readFileSync(utxosPath).toString()
    let utxos = JSON.parse(utxosJson)
    let tx = cfr.bitcoin.createFinalTx(wallet, utxos, feeRate).tx
    console.log(tx.toHex())
  },

  async broadcasttx (txHex) {
    await cfr.bitcoin.pushTx(txHex)
  },

  async ethtx (walletPath) {
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
}

module.exports = runCommand
