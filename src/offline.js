'use strict'

const promisify = require('bluebird').promisify
const cfr = require('cosmos-fundraiser')
const { Transaction } = require('bitcoinjs-lib')
const readline = require('readline')
cfr.fetchStatus = promisify(cfr.fetchStatus)
cfr.bitcoin.pushTx = promisify(cfr.bitcoin.pushTx)
cfr.bitcoin.fetchUtxos = promisify(cfr.bitcoin.fetchUtxos)

function fail (message) {
  console.log(message)
  process.exit(1)
}

async function readWallet (prmpt) {
  let seed = await readSeed(prmpt)
  let wallet = cfr.deriveWallet(seed)
  return wallet
}

async function readSeed (prmpt) {
  if (!prmpt) {
    prmpt = 'Please enter your wallet seed phrase'
  }
  let seed
  if (process.stdin.isTTY) {
    process.stdout.write(prmpt + ':\n> ')
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
  return seed
}

async function runCommand (commandName, args) {
  let command = commands[commandName]
  if (!command) {
    fail(`"${commandName}" is not a valid command`)
  }
  await command(...args)
}

const commands = {
  async status () {
    let status = await cfr.fetchStatus()
    let { fundraiserEnded } = status
    console.log(fundraiserEnded ? status : { fundraiserEnded })
  },

  async genwallet () {
    let mnemonic = cfr.generateMnemonic()
    console.log(mnemonic)
  },

  async btcaddress () {
    try {
      let wallet = await readWallet()
      console.log(wallet.addresses.bitcoin)
    } catch (err) {
      console.log('error:', err)
      fail(`Usage: cosmos-fundraiser btcaddress < walletSeed`)
    }
  },

  async cosmosaddress () {
    try {
      let wallet = await readWallet()
      console.log(wallet.addresses.cosmos)
    } catch (err) {
      console.log('error:', err)
      fail(`Usage: cosmos-fundraiser cosmosaddress < walletSeed`)
    }
  },

  async buildtx (btcAddress, feeRate = 300) {
    if (!btcAddress) {
      fail(`
Usage:
  cosmos-fundraiser buildtx <bitcoinAddress> [feeRate]

  'feeRate' is used to calculate the Bitcoin transaction fee,
  measured in satoshis per byte
      `)
    }
    let { utxos } = await cfr.bitcoin.fetchUtxos(btcAddress)
    if (utxos.length === 0) {
      fail(`Address has no unspent outputs

Please send some BTC to your intermediate address, then run this
command again.
      `)
    }
    try {
      let tx = cfr.bitcoin.createFinalTx(utxos, feeRate).tx
      console.log(tx.toHex())
    } catch (err) {
      fail(err.message)
    }
  },

  async signtx (txHex) {
    if (!txHex) {
      fail(`Usage: cosmos-fundraiser signtx <txHex> < walletSeed`)
    }
    let tx = Transaction.fromHex(txHex)
    let wallet = await readWallet()
    let signedTx = cfr.bitcoin.signFinalTx(wallet, tx)
    console.log(signedTx.toHex())
  },

  async broadcasttx (txHex) {
    return await cfr.bitcoin.pushTx(txHex)
  },

  async ethtx () {
    let wallet = await readWallet()
    let tx = cfr.ethereum.getTransaction(
      wallet.addresses.cosmos,
      wallet.addresses.ethereum
    )
    console.log(JSON.stringify(tx, null, '  '))
  },

  async splitseed () {
    let seed = await readSeed('Please enter the seed phrase to split')
    if (!seed) {
      fail(`Usage: cosmos-fundraiser splitseed < walletSeed`)
    }
    let {one, two} = cfr.splitMnemonic(seed)
    console.log("one: " + one + "\ntwo: " + two)
  },

  async joinseed() {
    let one = await readSeed('Please enter seed phrase 1')
    let two = await readSeed('Please enter seed phrase 2')
    let seed = cfr.joinMnemonic(one, two)
    console.log("one: " + one + "\ntwo: " + two + "\nseed: " + seed)
  }
}

module.exports = runCommand
