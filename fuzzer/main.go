package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strings"

	cmn "github.com/tendermint/go-common"
	"github.com/tendermint/go-crypto"
	"github.com/tendermint/go-crypto/hd"
	"github.com/tyler-smith/go-bip39"
)

var flagVerbose bool
var flagFilter string

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
	
Welcome to the Cosmos FUZZER.`) + cmn.Magenta(`
(Please remember, NEVER type your 12 words onto an "online" computer.)`)

func main() {

	// Parse flags
	flag.BoolVar(&flagVerbose, "verbose", false, "Show more information")
	flag.StringVar(&flagFilter, "filter", "", "Additional entropy")
	flag.Parse()

	// Print banner
	fmt.Println(banner)

	// Get or generate mnemonic
	var mnemonic string
	fmt.Println("\nEnter any 12 words (may be invalid):")
	mnemonic = readlineKeyboard()

	// Make sure it's well formatted with good words
	if !bip39.IsMnemonicValid(mnemonic) {
		fmt.Println("Invalid mnemonic!")
		return
	}

	// Split mnemonic to 12 words
	mnemonicSlice := strings.Split(mnemonic, " ")

	// For each position,
	for i := 0; i < 12; i++ {
		fmt.Println("Fiddling word no", i)
		// For each word in WordList,
		for j := 0; j < len(bip39.WordList); j++ {
			c := make([]string, 12)
			copy(c, mnemonicSlice)
			c[i] = bip39.WordList[j]

			m := strings.Join(c, " ")
			seed := bip39.NewSeed(m, "")
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
				addrStr := fmt.Sprintf("0x%X (%v)", addr, m)
				if flagFilter == "" {
					fmt.Println(addrStr)
				} else if strings.Contains(addrStr, flagFilter) {
					fmt.Println(addrStr)
				}
			}
		}
	}

}
