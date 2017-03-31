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
  t.test('btcaddress for empty address', function (t) {
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
})
