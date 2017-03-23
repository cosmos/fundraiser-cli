'use strict'

const { readFileSync } = require('fs')
const promisify = require('bluebird').promisify
const cfr = require('cosmos-fundraiser')
const readline = require('readline')
cfr.bitcoin.pushTx = promisify(cfr.bitcoin.pushTx)
cfr.bitcoin.fetchUtxos = promisify(cfr.bitcoin.fetchUtxos)

function fail (message) {
  console.log(message)
  process.exit(1)
}

async function readWallet () {
  let seed
  if (process.stdin.isTTY) {
    process.stdout.write("Please enter the seed:\n> ")
    let rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    })
    seed = await new Promise((resolve) => rl.once('line', resolve))
    rl.close()
  } else {
    seed = await new Promise((resolve, reject) => {
      let data = []
      process.stdin.on('data', (chunk) => data.push(chunk))
      process.stdin.once('end', () => resolve(Buffer.concat(data)))
      process.stdin.once('error', (err) => reject(err))
    })
    seed = seed.toString('utf8').trim()
  }
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
    let seed = cfr.generateMnemonic()
    console.log(seed)
  },

  async btcaddress () {
    try {
      let wallet = await readWallet()
      console.log(wallet.addresses.bitcoin)
    } catch (err) {
      console.log("error:", err)
      fail(`Usage: cosmos-fundraiser btcaddress < walletSeed`)
    }
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

  async constructandsigntx (utxosPath, feeRate = 400) {
    if (process.stdin.isTTY || !utxosPath) {
      fail(`
Usage:
  cosmos-fundraiser constructandsigntx <utxosFile> [feeRate] < walletSeed

  'feeRate' is used to calculate the Bitcoin transaction fee,
  measured in satoshis per byte`)
    }
    let wallet = await readWallet()
    let utxosJson = readFileSync(utxosPath).toString()
    let utxos = JSON.parse(utxosJson)
    let tx = cfr.bitcoin.createFinalTx(wallet, utxos, feeRate).tx
    console.log(tx.toHex())
  },

  async broadcasttx (txHex) {
    await cfr.bitcoin.pushTx(txHex)
  },

  async ethtx () {
    let wallet = await readWallet()
    let tx = cfr.ethereum.getTransaction(
      `0x${wallet.addresses.cosmos}`,
      wallet.addresses.ethereum
    )
    console.log(JSON.stringify(tx, null, '  '))
  }
}

module.exports = runCommand
