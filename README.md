# Cosmos Fundraiser CLI


# Run

Two modes: online and offline. 

## Online

Just run

```
cosmos-fundraiser
```

and it will take you through an interactive contribution process.


## Offline

For those who looking for greater security, 
the contribution flow can be split into segments, 
some of which are done on an offline computer:

```
# write down or encrypt the wallet phrase
cosmos-fundraiser genwallet 
```

### BTC

For BTC, get the intermediate address to send funds:

```
cosmos-fundraiser btcaddress
```

Now on an online machine, 

```
cosmos-fundraiser btcaddress <address> > tx.json
```

Now on the offline machine,

```
cosmos-fundraiser signtx tx.json > signedtx.json
```

Finally, on the online machine:

```
cosmos-fundraiser broadcasttx signedtx.json
```

### ETH

For ETH, on the offline machine, run

```
cosmos-fundraiser ethtx
```

Send the resulting transaction from anywhere that lets you send data.
