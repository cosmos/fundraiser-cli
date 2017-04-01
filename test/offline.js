var exec = require('child_process').execSync
var path = require('path')
var test = require('tape')
var pty = require('pty.js')

var scriptPath = path.join(__dirname, '../build/main.js')

function run (args, stdin) {
  return exec(scriptPath + ' ' + args, {
    input: stdin,
    encoding: 'utf8'
  })
}

function runTTY (args, stdin, onPrompt, onResult) {
  var child = pty.spawn(scriptPath, args.split(' '))
  child.once('data', function (prompt) {
    onPrompt(prompt)
    child.write(stdin)
    // ignore input data echoing back to us
    child.once('data', function () {
      child.once('data', onResult)
    })
  })
}

test('invalid command', function (t) {
  try {
    run('notavalidcommand')
    t.fail('should have thrown')
  } catch (err) {
    t.pass('error thrown')
    t.equal(err.stdout, '"notavalidcommand" is not a valid command\n', 'correct output')
    t.equal(err.status, 1, 'correct exit code')
  }
  t.end()
})

test('genwallet', function (t) {
  var seed = run('genwallet')
  t.equal(seed.split(' ').length, 12, 'correct seed phrase length')
  t.end()
})

test('btcaddress', function (t) {
  t.test('btcaddress with no seed', function (t) {
    try {
      run('btcaddress')
      t.fail('should have thrown')
    } catch (err) {
      t.pass('error thrown')
      t.equal(err.stdout.indexOf('error: Error: Mnemonic must be at least 12 words\n'), 0, 'correct output')
    }
    t.end()
  })
  t.test('btcaddress with short seed', function (t) {
    try {
      run('btcaddress', 'believe label page great frog')
      t.fail('should have thrown')
    } catch (err) {
      t.pass('error thrown')
      t.equal(err.stdout.indexOf('error: Error: Mnemonic must be at least 12 words\n'), 0, 'correct output')
    }
    t.end()
  })
  t.test('btcaddress with piped in seed', function (t) {
    var seed = run('genwallet')
    var btcAddress = run('btcaddress', seed).trim()
    t.equal(btcAddress.length, 34, 'address is correct length')
    t.equal(btcAddress[0], '1', 'address starts with "1"')
    t.end()
  })
  t.test('btcaddress with TTY seed', function (t) {
    function onPrompt (prompt) {
      t.equal(prompt, 'Please enter your wallet seed phrase:\r\n> ', 'correct prompt')
    }
    function onResult (btcAddress) {
      btcAddress = btcAddress.trim()
      t.equal(btcAddress.length, 34, 'address is correct length')
      t.equal(btcAddress[0], '1', 'address starts with "1"')
      t.end()
    }
    var seed = run('genwallet')
    runTTY('btcaddress', seed, onPrompt, onResult)
  })
})

test('buildtx', function (t) {
  t.test('buildtx with no address', function (t) {
    try {
      run('buildtx')
      t.fail('should have thrown')
    } catch (err) {
      t.pass('error thrown')
      t.equal(err.stdout, '\nUsage:\n  cosmos-fundraiser buildtx <bitcoinAddress> [feeRate]\n\n  \'feeRate\' is used to calculate the Bitcoin transaction fee,\n  measured in satoshis per byte\n      \n', 'correct output')
    }
    t.end()
  })
  t.test('buildtx with invalid address', function (t) {
    try {
      run('buildtx', '1ESSTayDd7Cq7v1uGB1i5gvhHtDEwuTSGgx')
      t.fail('should have thrown')
    } catch (err) {
      t.pass('error thrown')
      t.equal(err.stdout, '\nUsage:\n  cosmos-fundraiser buildtx <bitcoinAddress> [feeRate]\n\n  \'feeRate\' is used to calculate the Bitcoin transaction fee,\n  measured in satoshis per byte\n      \n', 'correct output')
    }
    t.end()
  })
  t.test('buildtx for empty address', function (t) {
    var seed = run('genwallet')
    var btcAddress = run('btcaddress', seed)
    try {
      run('buildtx ' + btcAddress)
      t.fail('should have thrown')
    } catch (err) {
      t.pass('error thrown')
      t.equal(err.stdout, 'Address has no unspent outputs\n\nPlease send some BTC to your intermediate address, then run this\ncommand again.\n      \n', 'correct output')
    }
    t.end()
  })
  t.test('buildtx for known address', function (t) {
    var tx = run('buildtx 121BDB6Zv8z3Rmt3oPsD7uUqHDLBaTRZJy 100')
    t.equal(tx, '01000000029d8bece6e65fc8591d04955a5d815ab9842c3f8f4c8c44b9a8aa6ba12a1c12540100000000ffffffffdb107a00fb681e8a2edc6a5a150ce7364e6e3a4f7a761c61fae68215e03ca0640100000000ffffffff026f7b0000000000001976a91494eec3bfbe6eab5a3799d83c8298cd509794ca4388ace8030000000000001976a914000000000000000000000000000000000000000088ac00000000\n', 'correct output')
    t.end()
  })
  t.test('buildtx for known address with high fee rate', function (t) {
    try {
      run('buildtx 121BDB6Zv8z3Rmt3oPsD7uUqHDLBaTRZJy 2000')
      t.fail('should have thrown')
    } catch (err) {
      t.equal(err.stdout, 'Not enough coins given to pay fee.\n      tx length=374\n      fee rate=2000 satoshi/byte\n      fee amount=748000 satoshis\n      output amount=68999 satoshis\n', 'correct output')
    }
    t.end()
  })
})

test('ethtx', function (t) {
  var seed = 'blue elephant host rebel add weapon october snack range service zone awful'
  var ethTx = run('ethtx', seed)
  t.equal(ethTx, '{\n  "to": "0xa4028F2aec0ad18964e368338E5268FebB4F5423",\n  "gas": 150000,\n  "data": "0x1c9981f8000000000000000000000000a453d974f7609b719e3dc52ddc13b465b8268787000000000000000000000000a853c849e346b43965bae5c7c27606bd527fbb9f5c22bbbe"\n}\n', 'correct output')
  t.end()
})
