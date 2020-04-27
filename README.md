# Slopes - The AVA Platform JavaScript Library

## Overview

Slopes is a JavaScript Library for interfacing with the AVA Platform. It is built using TypeScript and intended to support both browser and Node.js. The Slopes library allows one to issue commands to the AVA node APIs. 

The APIs currently supported by default are:

  * The AVA Virtual Machine (AVM) API
  * The Keystore API
  * The Admin API
  * The Platform API

## Getting Started

We built Slopes with ease of use in mind. With this library, any Javascript developer is able to interact with a node on the AVA Platform who has enabled their API endpoints for the developer's consumption. We keep the library up-to-date with the latest changes in the [AVA Platform Specification](https://avalabs.org/docs/). 

  Using Slopes, developers are able to:

  * Locally manage private keys
  * Retrieve balances on addresses
  * Get UTXOs for addresses
  * Build and sign transactions
  * Issue signed transactions to the AVM
  * Create a subnetwork
  * Administer a local node
  * Retrieve AVA network information from a node

The entirety of the Slopes documentation can be found on our [Slopes documentation page](https://docs.ava.network/v1.0/en/tools/slopes/).


### Requirements

Slopes requires Node.js LTS version 12.13.1 or higher to compile. 

Slopes depends on the following two Node.js modules internally, and we suggest that your project uses them as well:

 * Buffer: Enables Node.js's Buffer library in the browser.
   * https://github.com/feross/buffer
   * `npm install --save buffer`
 * BN.js: A bignumber library for Node.js and browser.
   * https://github.com/indutny/bn.js/
   * `npm install --save bn.js`

Both of the above modules are extremely useful when interacting with Slopes as they are the input and output types of many base classes in the library. 

### Installation 

Slopes is available for install via `npm`:

`npm install --save @avalabs/slopes`

You can also pull the repo down directly and build it from scratch:

`npm run build`

This will generate a pure javascript library and place it in a folder named "dist" in the project root. The "slopes.js" file can then be dropped into any project as a pure javascript implementation of Slopes.

The Slopes library can be imported into your existing Node.js project as follows:

```js
const slopes = require("slopes");
```
Or into your TypeScript project like this:

```js
import * as slopes from "slopes"
```

### Importing essentials

```js
import * as slopes from "slopes";
import BN from 'bn.js';
import { Buffer } from 'buffer/'; // the slash forces this library over native Node.js Buffer

let bintools = slopes.BinTools.getInstance();
```

The above lines import the libraries used in the below example:
  
  * slopes: Our javascript module.
  * bn.js: A bignumber module use by Slopes.
  * buffer: A Buffer library.
  * BinTools: A singleton built into Slopes that is used for dealing with binary data.

## Example 1 &mdash; Managing AVM Keys

Slopes comes with its own AVM Keychain. This keychain is used in the functions of the API, enabling them to sign using keys it's registered. The first step in this process is to create an instance of Slopes connected to our AVA Platform endpoint of choice.

```js
let mynetworkID = 12345; //default is 2, we want to override that for our local network
let ava = new slopes.Slopes("localhost", 9650, "https", mynetworkID);
let avm = ava.AVM(); //returns a reference to the AVM API used by Slopes
```

### Accessing the keychain

The keychain is accessed through the AVM API and can be referenced directly or through a reference varaible.

```js
let myKeychain = avm.keyChain();
```

This exposes the instance of the class AVM Keychain which is created when the AVM API is created. At present, this supports secp256k1 curve for ECDSA key pairs. 

### Creating AVM key pairs

The keychain has the ability to create new keypairs for you and return the address assocated with the key pair.

```js
let newAddress1 = myKeychain.makeKey();
```

You may also import your exsting private key into the keychain using either a Buffer...

```js
let mypk = bintools.avaDeserialize("24jUJ9vZexUM6expyMcT48LBx27k1m7xpraoV62oSQAHdziao5"); //returns a Buffer
let newAddress2 = myKeychain.importKey(mypk);
```

... or an AVA serialized string works, too:

```js
let mypk = "24jUJ9vZexUM6expyMcT48LBx27k1m7xpraoV62oSQAHdziao5";
let newAddress2 = myKeychain.importKey(mypk); //returns a Buffer for the address
```

### Working with keychains

The AVMKeyChain extends the global KeyChain class, which has standardized key management capabilities. The following functions are available on any keychain that implements this interface.

```js
let addresses = avm.keyChain().getAddresses(); //returns an array of Buffers for the addresses
let addressStrings = avm.keyChain().getAddressStrings(); //returns an array of strings for the addresses
let exists = myKeychain.hasKey(myaddress); //returns true if the address is managed
let keypair = myKeychain.getKey(myaddress); //returns the keypair class
```

### Working with keypairs

The AVMKeyPair class implements the global KeyPair class, which has standardized keypair functionality. The following operations are available on any keypair that implements this interface.

```js
let address = keypair.getAddress(); //returns Buffer
let addressString = keypair.getAddressString(); //returns string

let pubk = keypair.getPublicKey(); //returns Buffer
let pubkstr = keypair.getPublicKeyString(); //returns an AVA serialized string

let privk = keypair.getPrivateKey(); //returns Buffer
let privkstr = keypair.getPrivateKeyString(); //returns an AVA serialized string

keypair.generateKey(); //creates a new random keypair

let mypk = "24jUJ9vZexUM6expyMcT48LBx27k1m7xpraoV62oSQAHdziao5";
let successul = keypair.importKey(mypk); //returns boolean if private key imported successfully

let message = "Wubalubadubdub";
let signature = keypair.sign(message); //returns a Buffer with the signature
let signerPubk = keypair.recover(message, signature);
let isValid = keypair.verify(message, signature, signerPubk); //returns a boolean
```

## Example 2 &mdash; Creating An Asset

This example creates an asset in the AVM and publishes it to the AVA Platform. The first step in this process is to create an instance of Slopes connected to our AVA Platform endpoint of choice.

```js
let mynetworkID = 12345; //default is 2, we want to override that for our local network
let ava = new slopes.Slopes("localhost", 9650, "https", mynetworkID);
let avm = ava.AVM(); //returns a reference to the AVM API used by Slopes
```

### Describe the new asset

The first steps in creating a new asset using Slopes is to determine the qualties of the asset. We will give the asset a name, a ticker symbol, as well as a denomination. 

```js
// The fee to pay for the asset, we assume this network is fee-less
let fee = new BN(0);

// Name our new coin and give it a symbol
let name = "Rickcoin is the most intelligent coin";
let symbol = "RICK";

// Where is the decimal point indicate what 1 asset is and where fractional assets begin
// Ex: 1 $AVA is denomination 9, so the smallest unit of $AVA is nano-AVA ($nAVA) at 10^-9 $AVA
let denomination = 9;
```

### Creating the initial state

We want to mint an asset with 400 coins to all of our managed keys, 500 to the second address we know of, and 600 to the second and third address. This sets up the state that will result from the Create Asset transaction. 

*Note: This example assumes we have the keys already managed in our AVM Keychain.*

```js
let addresses = avm.keyChain().getAddresses();

// Create outputs for the asset's initial state
let secpbase1 = new slopes.SecpOutBase(new BN(400), addresses);
let secpbase2 = new slopes.SecpOutBase(new BN(500), [addresses[1]]);
let secpbase3 = new slopes.SecpOutBase(new BN(600), [addresses[1], addresses[2]]);

// Populate the initialState array
// The AVM needs to know what type of output is produced. 
// The constant slopes.AVMConstants.SECPFXID is the correct output.
// It specifies that we are using a secp256k1 signature scheme for this output.
let initialState = new slopes.InitialStates();
initialState.addOutput(secpbase1, slopes.AVMConstants.SECPFXID);
initialState.addOutput(secpbase2, slopes.AVMConstants.SECPFXID);
initialState.addOutput(secpbase3, slopes.AVMConstants.SECPFXID);
```

### Creating the signed transaction

Now that we know what we want an asset to look like, we create an output to send to the network. There is an AVM helper function `makeCreateAssetTx()` which does just that. 

```js
// Fetch the UTXOSet for our addresses
let utxos = await avm.getUTXOs(addresses);

// Make an unsigned Create Asset transaction from the data compiled earlier
let unsigned = await avm.makeCreateAssetTx(utxos, fee, addresses, initialState, name, symbol, denomination);

let signed = avm.keyChain().signTx(unsigned); //returns a Tx class
```

### Issue the signed transaction

Now that we have a signed transaction ready to send to the network, let's issue it! 

Using the Slopes AVM API, we going to call the issueTx function. This function can take either the Tx class returned in the previous step, a base-58 string AVA serialized representation of the transaction, or a raw Buffer class with the data for the transaction. Examples of each are below:

```js
// using the Tx class
let txid = await avm.issueTx(signed); //returns an AVA serialized string for the TxID
```

```js
// using the base-58 representation
let txid = await avm.issueTx(signed.toString()); //returns an AVA serialized string for the TxID
```

```js
// using the transaction Buffer
let txid = await avm.issueTx(signed.toBuffer()); //returns an AVA serialized string for the TxID
```

We assume ONE of those methods are used to issue the transaction.

### Get the status of the transaction

Now that we sent the transaction to the network, it takes a few seconds to determine if the transaction has gone through. We can get an updated status on the transaction using the TxID through the AVM API.

```js
// returns one of: "Accepted", "Processing", "Unknown", and "Rejected"
let status = await avm.getTxStatus(txid); 
```

The statuses can be one of "Accepted", "Processing", "Unknown", and "Rejected":

  * "Accepted" indicates that the transaction has been accepted as valid by the network and executed
  * "Processing" indicates that the transaction is being voted on.
  * "Unknown" indicates that node knows nothing about the transaction, indicating the node doesn't have it
  * "Rejected" indicates the node knows about the transaction, but it conflicted with an accepted transaction

### Identifying the newly created asset

The AVM uses the TxID of the transaction which created the asset as the unique identifier for the asset. This unique identifier is henceforth known as the "AssetID" of the asset. When assets are traded around the AVM, they always reference the AssetID that they represent.

## Example 3 &mdash; Sending An Asset
This example sends an asset in the AVM to a single recipient. The first step in this process is to create an instance of Slopes connected to our AVA Platform endpoint of choice.

```js
let mynetworkID = 12345; //default is 2, we want to override that for our local network
let ava = new slopes.Slopes("localhost", 9650, "https", mynetworkID);
let avm = ava.AVM(); //returns a reference to the AVM API used by Slopes
```

We're also assuming that the keystore contains a list of addresses used in this transaction.

### Getting the UTXO Set

The AVM stores all available balances in a datastore called Unspent Transaction Outputs (UTXOs). A UTXO Set is the unique list of outputs produced by transactions, addresses that can spend those outputs, and other variables such as lockout times (a timestamp after which the output can be spent) and thresholds (how many signers are required to spend the output). 

For the case of this example, we're going to create a simple transaction that spends an amount of available coins and sends it to a single address without any restrictions. The management of the UTXOs will mostly be abstracted away. 

However, we do need to get the UTXO Set for the addresses we're managing. 

```js
let myAddresses = avm.keyChain().getAddresses(); //returns an array of addresses the keychain manages
let utxos = await avm.getUTXOs(myAddresses);
```

### Spending the UTXOs

The `makeUnsignedTx()` helper function sends a single asset type. We have a particular assetID whose coins we want to send to a recipient address. This is an imaginary asset for this example which we believe to have 400 coins. Let's verify that we have the funds available for the transaction.

```js
let assetid = "23wKfz3viWLmjWo2UZ7xWegjvnZFenGAVkouwQCeB9ubPXodG6"; //avaSerialized string
let mybalance = utxos.getBalance(myAddresses, assetid); //returns 400 as a BN
```
We have 400 coins! We're going to now send 100 of those coins to our friend's address.

```js
let sendAmount = new BN(100); //amounts are in BN format
let friendsAddress = "X-B6D4v1VtPYLbiUvYXtW4Px8oE9imC2vGW"; //AVA serialized address format

//The below returns a TxUnsigned
//Parameters sent are (in order of appearance):
//   * The UTXO Set
//   * The amount being sent as a BN
//   * An array of addresses to send the funds
//   * An array of addresses sending the funds
//   * An array of addresses any leftover funds are sent
//   * The AssetID of the funds being sent
let unsignedTx = avm.makeUnsignedTx(utxos, amount, [friendsAddress], myAddresses, myAddresses, assetid); 
let signedTx = avm.signTx(unsignedTx);
let txid = await avm.issueTx(signedTx);
```

And the transaction is sent!

### Get the status of the transaction

Now that we sent the transaction to the network, it takes a few seconds to determine if the transaction has gone through. We can get an updated status on the transaction using the TxID through the AVM API.

```js
// returns one of: "Accepted", "Processing", "Unknown", and "Rejected"
let status = await avm.getTxStatus(txid); 
```

The statuses can be one of "Accepted", "Processing", "Unknown", and "Rejected":

  * "Accepted" indicates that the transaction has been accepted as valid by the network and executed
  * "Processing" indicates that the transaction is being voted on.
  * "Unknown" indicates that node knows nothing about the transaction, indicating the node doesn't have it
  * "Rejected" indicates the node knows about the transaction, but it conflicted with an accepted transaction

### Check the results

The transaction finally came back as "Accepted", now let's update the UTXOSet and verify that the transaction balance is as we expected. 

*Note: In a real network the balance isn't guaranteed to match this scenario. Transaction fees or additional spends may vary the balance. For the purpose of this example, we assume neither of those cases.*

```js
let updatedUTXOs = await avm.getUTXOs();
let newBalance = updatedUTXOs.getBalance(myAddresses, assetid);
if(newBalance.toNumber() != mybalance.sub(sendAmount).toNumber()){
    throw Error("heyyy these should equal!");
}
```
