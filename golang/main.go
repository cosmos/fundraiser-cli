package main

import (
	"bufio"
	"crypto/sha256"
	"flag"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/ripemd160"

	cmn "github.com/tendermint/go-common"
	"github.com/tendermint/go-crypto"
	"github.com/tendermint/go-crypto/hd"
	"github.com/tyler-smith/go-bip39"
)

var flagVerbose bool

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
(Please remember, NEVER type your 12 words onto an "online" computer.)`)

func main() {
	// Parse flags
	flag.BoolVar(&flagVerbose, "verbose", false, "Show more information")
	flag.Parse()

	// Print banner
	fmt.Println(banner)

	// Get mnemonic
	fmt.Println("\nEnter your 12-word mnemonic: ")
	mnemonic := readlineKeyboard()

	// Validate mnemonic
	err := validateBip39Words(mnemonic)
	if err != nil {
		fmt.Println(cmn.Red(err))
		return
	}

	seed := bip39.NewSeed(mnemonic, "")
	_, priv, ch, _ := hd.ComputeMastersFromSeed(string(seed))

	// Calculate Cosmos Addr
	{
		privBytes := hd.DerivePrivateKeyForPath(
			hd.HexDecode(priv),
			hd.HexDecode(ch),
			"44'/118'/0'/0/0",
		)
		pubBytes := hd.PubKeyBytesFromPrivKeyBytes(privBytes, true)
		var pubKey crypto.PubKeySecp256k1
		copy(pubKey[:], pubBytes)
		addr := pubKey.Address()
		fmt.Println(cmn.Red("\n!!!WARNING!!! Do NOT use it as an Ethereum address."))
		fmt.Printf("Your Cosmos Address: 0x%X\n", addr)
		// Show diagnostic info
		if flagVerbose {
			fmt.Printf("Cosmos Public Key: 0x%X\n", pubBytes)
			hasherSHA256 := sha256.New()
			hasherSHA256.Write(pubKey[:]) // does not error
			sha := hasherSHA256.Sum(nil)
			fmt.Printf("Sha256(Cosmos Public Key): 0x%X\n", sha)
			hasherRIPEMD160 := ripemd160.New()
			hasherRIPEMD160.Write(sha) // does not error
			ripe := hasherRIPEMD160.Sum(nil)
			fmt.Printf("Ripe160(Sha256(Cosmos Public Key)): 0x%X\n", ripe)
		}
		fmt.Println(cmn.Red("!!!WARNING!!! Do NOT use it as an Ethereum address."))
	}

	// Calculate Bitcoin Info
	{
		privBytes := hd.DerivePrivateKeyForPath(
			hd.HexDecode(priv),
			hd.HexDecode(ch),
			"44'/0'/0'/0/0",
		)
		btcAddr := hd.ComputeAddressForPrivKey(hd.HexEncode(privBytes))
		fmt.Printf("\nYour Intermediate Bitcoin Address: %v\n", btcAddr)
		fmt.Printf("Your Intermediate Bitcoin Private Key: %v\n", hd.WIFFromPrivKeyBytes(privBytes, true))
	}
	fmt.Println("\nYou can check your recommended Atom allocation at https://fundraiser.cosmos.network .")
	fmt.Println("\nHit <Enter> to exit...")
	readlineKeyboard()
}
