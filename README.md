# Cosmos Fundraiser CLI

WARNING!

THE FUNDRAISER DOES NOT BEGIN UNTIL APRIL 6, 6AM PDT!
THIS IS NOT THE FINAL PRODUCTION VERSION OF THE SOFTWARE!
ALL BITCOIN AND ETHER SENT PRIOR TO APRIL 6, 6AM PDT WILL BE LOST!

## Install

```bash
npm install -g cosmos-fundraiser-cli
```

## Run

Two modes: online and offline.

### Online

Just run

```
cosmos-fundraiser
```

and it will take you through an interactive contribution process.


### Offline

For those who looking for greater security, the contribution flow can be split into segments, some of which are done on an offline computer.

```
# write down or encrypt the wallet phrase
cosmos-fundraiser genwallet
```

#### BTC

To donate BTC, get the intermediate address and send the amount of funds you'd like to contribute:
```
# do this on your offline computer
cosmos-fundraiser btcaddress
```

Once you've sent BTC to the intermediate address, build the donation transaction on an online machine:
```
cosmos-fundraiser buildtx <address>
```

Now on the offline machine, sign your donation transaction:
```
cosmos-fundraiser signtx <donationTx>
```

Finally, on the online machine:
```
cosmos-fundraiser broadcasttx <signedTx>
```

#### ETH

For ETH, on the offline machine, run

```
cosmos-fundraiser ethtx
```

Send the resulting transaction from anywhere that lets you send data.
