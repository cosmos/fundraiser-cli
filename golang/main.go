package main

import (
	"bufio"
	"crypto/sha256"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/cosmos/cosmos-sdk/crypto/keys/hd"
	"github.com/cosmos/go-bip39"
	crypto "github.com/tendermint/tendermint/crypto/secp256k1"
	bech32 "github.com/tendermint/tendermint/libs/bech32"
	cmn "github.com/tendermint/tendermint/libs/common"
)

var flagVerbose bool
var flagGenerate bool
var flagCustomEntropy string

func readlineKeyboard() string {
	reader := bufio.NewReader(os.Stdin)
	text, err := reader.ReadString('\n')
	if err != nil {
		fmt.Println("Error reading from keyboard: " + err.Error())
		os.Exit(1)
	}
	return strings.TrimSpace(text)
}

var banner = cmn.Cyan(`
  .d8888b.   .d88888b.   .d8888b.  888b     d888  .d88888b.   .d8888b.
 d88P  Y88b d88P" "Y88b d88P  Y88b 8888b   d8888 d88P" "Y88b d88P  Y88b
 888    888 888     888 Y88b.      88888b.d88888 888     888 Y88b.
 888        888     888  "Y888b.   888Y88888P888 888     888  "Y888b.
 888        888     888     "Y88b. 888 Y888P 888 888     888     "Y88b.
 888    888 888     888       "888 888  Y8P  888 888     888       "888
 Y88b  d88P Y88b. .d88P Y88b  d88P 888   "   888 Y88b. .d88P Y88b  d88P
  "Y8888P"   "Y88888P"   "Y8888P"  888       888  "Y88888P"   "Y8888P`) + cmn.White(`
	
Welcome to the Cosmos fundraiser tool.`) + cmn.Magenta(`
(Please remember, NEVER type your 24 words onto an "online" computer.)`)

func main() {
	// Parse flags
	flag.BoolVar(&flagVerbose, "verbose", false, "Show more information")
	flag.BoolVar(&flagGenerate, "generate", false, "Generate new key")
	flag.StringVar(&flagCustomEntropy, "entropy", "", "Additional entropy")
	flag.Parse()

	// Print banner
	fmt.Println(banner)

	// Get or generate mnemonic
	var mnemonic string
	if flagGenerate {
		entropy, _ := bip39.NewEntropy(256) // does not error
		hasherSHA256 := sha256.New()
		hasherSHA256.Write([]byte(flagCustomEntropy)) // does not error
		customEntropy := hasherSHA256.Sum(nil)
		for i, b := range entropy {
			entropy[i] = b ^ customEntropy[i]
		}
		mnemonic, _ = bip39.NewMnemonic(entropy) // does not error
		fmt.Println(cmn.Red("\n!!!WARNING!!! Do NOT forget these 24 words."))
		fmt.Printf("Your 24-word mnemonic: %v", mnemonic)
		fmt.Println(cmn.Red("\n!!!WARNING!!! Do NOT forget these 24 words."))
	} else {
		fmt.Println("\nEnter your 24-word mnemonic: ")
		mnemonic = readlineKeyboard()
	}
	fmt.Println("")

	// Validate mnemonic
	err := validateBip39Words(mnemonic)
	if err != nil {
		fmt.Println(cmn.Red(err))
		return
	}

	seed := bip39.NewSeed(mnemonic, "")
	priv, ch := hd.ComputeMastersFromSeed(seed)

	// Calculate Cosmos Addr
	{
		privBytes, err := hd.DerivePrivateKeyForPath(
			priv,
			ch,
			"44'/118'/0'/0/0",
		)
		if err != nil {
			panic(err)
		}
		pubKey := crypto.PrivKeySecp256k1(privBytes).PubKey().(crypto.PubKeySecp256k1)
		if err != nil {
			panic(err)
		}
		addr := pubKey.Address()
		b32, err := bech32.ConvertAndEncode("cosmos", addr)
		if err != nil {
			panic(err)
		}
		fmt.Printf("Your Cosmos Address: %v\n", b32)
		b32Pub, err := bech32.ConvertAndEncode("cosmospub", pubKey[:])
		if err != nil {
			panic(err)
		}
		fmt.Printf("Your Cosmos Public Key: %v\n", b32Pub)
		// Show diagnostic info
		if flagVerbose {
			fmt.Printf("Cosmos Public Key: 0x%X\n", pubKey)
			hasherSHA256 := sha256.New()
			hasherSHA256.Write(pubKey[:]) // does not error
			sha := hasherSHA256.Sum(nil)
			fmt.Printf("Sha256(Cosmos Public Key): 0x%X\n", sha)
			hasherSHA256 = sha256.New()
			hasherSHA256.Write(sha) // does not error
			sha = hasherSHA256.Sum(nil)
			fmt.Printf("Ripe160(Sha256(Cosmos Public Key)): 0x%X\n", sha)
		}
	}

	fmt.Println("\nHit <Enter> to exit...")
	readlineKeyboard()
}
