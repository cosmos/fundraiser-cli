package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	cmn "github.com/tendermint/go-common"
	crypto "github.com/tendermint/go-crypto"
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

	// First try all pairwise swaps
	fmt.Println("Trying all pairwise swaps of the words. Please be patient...")
	ch := make(chan []string)
	go Pairwise(mnemonicSlice, ch)
	for {
		newWords, ok := <-ch
		if !ok {
			break
		}

		checkWords(newWords)
	}

	// Now try all double pairwise swaps
	fmt.Println("Trying all double pairwise swaps of the words. Please be patient...")
	ch = make(chan []string)
	go DoublePairwise(mnemonicSlice, ch)
	for {
		newWords, ok := <-ch
		if !ok {
			break
		}

		checkWords(newWords)
	}

	// Now try all possible permutations.
	fmt.Println("Trying all permutations of the words. Please be patient...")
	ch = make(chan []string)
	go Permute(mnemonicSlice, ch)
	counter := 0
	start := time.Now()
	for {
		if counter%100000 == 0 {
			fmt.Printf("Tried %d / %d permutations. Took %v ...\n", counter, 479001600, time.Since(start))
			start = time.Now()
		}

		c, ok := <-ch
		if !ok {
			break
		}

		counter += 1
		go func(words []string) {
			checkWords(words)
		}(c)
	}
	fmt.Printf("Tried %d permutations. No match found\n", counter)

	// Now try fiddling each position.
	fmt.Println("Trying fiddling each each of the words, keeping the others constant. Please be patient...")
	for i := 0; i < 12; i++ {
		fmt.Println("Fiddling word no", i)
		// For each word in WordList,
		for j := 0; j < len(bip39.WordList); j++ {
			c := make([]string, 12)
			copy(c, mnemonicSlice)
			c[i] = bip39.WordList[j]

			checkWords(c)
		}
	}

}

func computeAddrString(c []string) string {
	m := strings.Join(c, " ")
	seed := bip39.NewSeed(m, "")
	_, priv, ch, _ := hd.ComputeMastersFromSeed(string(seed))

	// Calculate Cosmos Addr
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
	return addrStr
}

func Pairwise(list []string, ch chan []string) {
	newList := make([]string, len(list))
	for i := 0; i < len(list); i++ {
		for j := i; j < len(list); j++ {
			copy(newList, list)
			newList[i] = list[j]
			newList[j] = list[i]
			ch <- newList
		}
	}
	close(ch)
}

func DoublePairwise(list []string, ch chan []string) {
	newList := make([]string, len(list))
	for i := 0; i < len(list); i++ {
		for j := i; j < len(list); j++ {
			copy(newList, list)
			newList[i] = list[j]
			newList[j] = list[i]
			ch2 := make(chan []string)
			go Pairwise(newList, ch2)
		INNER:
			for {
				c, ok := <-ch2
				if !ok {
					break INNER
				}
				ch <- c
			}
		}
	}
	close(ch)
}

func Permute(list []string, ch chan []string) {
	newList := make([]string, len(list))
	permute(newList, list, 0, ch)
	close(ch)

}

func permute(newList, list []string, iterIdx int, ch chan []string) {

	// if we filled the new list, return
	if iterIdx == len(newList) {
		return
	}

	// give each element in the list a chance to be at the front
	for i := 0; i < len(list); i++ {
		newList[iterIdx] = list[i]

		// remove the element that is now at the front of the new list
		l := make([]string, len(list)-1)
		copy(l, list[:i])
		copy(l[i:], list[i+1:])

		// recursively call permute
		permute(newList, l, iterIdx+1, ch)

		// this happens once for every permutation
		if iterIdx == len(newList)-2 {
			perm := make([]string, len(newList))
			// copy it so its not overwritten while waiting to send
			copy(perm, newList)
			ch <- perm
		}
	}
}

func checkWords(words []string) {
	addrStr := computeAddrString(words)
	if flagFilter == "" {
		fmt.Println(addrStr)
	} else if strings.Contains(addrStr, flagFilter) {
		fmt.Println("FOUND A MATCH!!!", addrStr)
		os.Exit(0)
	}
}
