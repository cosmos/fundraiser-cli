package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/howeyc/gopass"
	"github.com/tendermint/go-crypto"
	"github.com/tendermint/go-crypto/hd"
	"github.com/tyler-smith/go-bip39"
)

func readlineKeyboardPass() string {
	str, err := gopass.GetPasswdMasked()
	if err != nil {
		fmt.Println("Error reading from keyboard: " + err.Error())
		os.Exit(1)
	}
	return strings.TrimSpace(string(str))
}

func readlineKeyboard() string {
	reader := bufio.NewReader(os.Stdin)
	text, err := reader.ReadString('\n')
	if err != nil {
		fmt.Println("Error reading from keyboard: " + err.Error())
		os.Exit(1)
	}
	return strings.TrimSpace(text)
}

func main() {
	fmt.Println("Enter your 12-word mnemonic")
	mnemonic := readlineKeyboard()
	seed := bip39.NewSeed(mnemonic, "")
	_, priv, ch, _ := hd.ComputeMastersFromSeed(string(seed))
	privBytes := hd.DerivePrivateKeyForPath(
		hd.HexDecode(priv),
		hd.HexDecode(ch),
		"44'/118'/0'/0/0",
	)
	pubBytes := hd.PubKeyBytesFromPrivKeyBytes(privBytes, true)
	var pubKey crypto.PubKeySecp256k1
	copy(pubKey[:], pubBytes)
	addr := pubKey.Address()
	fmt.Printf("Your Cosmos Address: 0x%X\n", addr)
}
