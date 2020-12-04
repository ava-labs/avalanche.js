/**
 * @packageDocumentation
 * @module API-EVM-UTXOs
  */
 import { Buffer } from 'buffer/';
 import BinTools from '../../utils/bintools';
 import BN from "bn.js";
 import { AmountOutput, SelectOutputClass, TransferableOutput, SECPTransferOutput, EVMOutput } from './outputs';
 import { EVMConstants } from './constants';
//  import { UnsignedTx } from './tx';
 import { EVMInput, SECPTransferInput, TransferableInput } from './inputs';
 import { Output, OutputOwners } from '../../common/output';
 import { UnixNow } from '../../utils/helperfunctions';
 import { StandardUTXO, StandardUTXOSet } from '../../common/utxos';
//  import { ExportTx } from './exporttx';
//  import { ImportTx } from './importtx';
 import { PlatformChainID } from '../../utils/constants';
 import { StandardAssetAmountDestination, AssetAmount } from '../../common/assetamount';
 import { Serialization, SerializedEncoding } from '../../utils/serialization';
import { UnsignedTx } from './tx';
import { ImportTx } from './importtx';
import { ExportTx } from './exporttx';
 
 /**
  * @ignore
  */
 const bintools = BinTools.getInstance();
 const serializer = Serialization.getInstance();
 
 /**
  * Class for representing a single UTXO.
  */
 export class UTXO extends StandardUTXO {
   protected _typeName = "UTXO";
   protected _typeID = undefined;
 
   //serialize is inherited
 
   deserialize(fields:object, encoding:SerializedEncoding = "hex") {
     super.deserialize(fields, encoding);
     this.output = SelectOutputClass(fields["output"]["_typeID"]);
     this.output.deserialize(fields["output"], encoding);
   }
 
   fromBuffer(bytes:Buffer, offset:number = 0):number {
     this.codecid = bintools.copyFrom(bytes, offset, offset + 2);
     offset += 2;
     this.txid = bintools.copyFrom(bytes, offset, offset + 32);
     offset += 32;
     this.outputidx = bintools.copyFrom(bytes, offset, offset + 4);
     offset += 4;
     this.assetid = bintools.copyFrom(bytes, offset, offset + 32);
     offset += 32;
     const outputid:number = bintools.copyFrom(bytes, offset, offset + 4).readUInt32BE(0);
     offset += 4;
     this.output = SelectOutputClass(outputid);
     return this.output.fromBuffer(bytes, offset);
   }
 
   /**
    * Takes a base-58 string containing a [[UTXO]], parses it, populates the class, and returns the length of the StandardUTXO in bytes.
    *
    * @param serialized A base-58 string containing a raw [[UTXO]]
    *
    * @returns The length of the raw [[UTXO]]
    *
    * @remarks
    * unlike most fromStrings, it expects the string to be serialized in cb58 format
    */
   fromString(serialized:string):number {
       /* istanbul ignore next */
       return this.fromBuffer(bintools.cb58Decode(serialized));
   }
 
   /**
    * Returns a base-58 representation of the [[UTXO]].
    *
    * @remarks
    * unlike most toStrings, this returns in cb58 serialization format
    */
   toString():string {
     /* istanbul ignore next */
     return bintools.cb58Encode(this.toBuffer());
   }
 
   clone():this {
     const utxo:UTXO = new UTXO();
     utxo.fromBuffer(this.toBuffer());
     return utxo as this;
   }
 
   create(
     codecID:number = EVMConstants.LATESTCODEC, 
     txid:Buffer = undefined,
     outputidx:Buffer | number = undefined,
     assetid:Buffer = undefined,
     output:Output = undefined):this 
   {
     return new UTXO(codecID, txid, outputidx, assetid, output) as this;
   }
 
 }
 
 export class AssetAmountDestination extends StandardAssetAmountDestination<TransferableOutput, TransferableInput> {}
 
 /**
  * Class representing a set of [[UTXO]]s.
  */
 export class UTXOSet extends StandardUTXOSet<UTXO>{
   protected _typeName = "UTXOSet";
   protected _typeID = undefined;
   
   //serialize is inherited
 
   deserialize(fields:object, encoding:SerializedEncoding = "hex") {
     super.deserialize(fields, encoding);
     let utxos = {};
     for(let utxoid in fields["utxos"]){
       let utxoidCleaned:string = serializer.decoder(utxoid, encoding, "base58", "base58");
       utxos[utxoidCleaned] = new UTXO();
       utxos[utxoidCleaned].deserialize(fields["utxos"][utxoid], encoding);
     }
     let addressUTXOs = {};
     for(let address in fields["addressUTXOs"]){
       let addressCleaned:string = serializer.decoder(address, encoding, "cb58", "hex");
       let utxobalance = {};
       for(let utxoid in fields["addressUTXOs"][address]){
         let utxoidCleaned:string = serializer.decoder(utxoid, encoding, "base58", "base58");
         utxobalance[utxoidCleaned] = serializer.decoder(fields["addressUTXOs"][address][utxoid], encoding, "decimalString", "BN");
       }
       addressUTXOs[addressCleaned] = utxobalance;
     }
     this.utxos = utxos;
     this.addressUTXOs = addressUTXOs;
   }
 
   parseUTXO(utxo:UTXO | string):UTXO {
     const utxovar:UTXO = new UTXO();
     // force a copy
     if (typeof utxo === 'string') {
       utxovar.fromBuffer(bintools.cb58Decode(utxo));
     } else if (utxo instanceof UTXO) {
       utxovar.fromBuffer(utxo.toBuffer()); // forces a copy
     } else {
       /* istanbul ignore next */
       throw new Error(`Error - UTXO.parseUTXO: utxo parameter is not a UTXO or string: ${utxo}`);
     }
     return utxovar
   }
 
   create(...args:any[]):this{
     return new UTXOSet() as this;
   }
 
   clone():this {
     const newset:UTXOSet = this.create();
     const allUTXOs:Array<UTXO> = this.getAllUTXOs();
     newset.addArray(allUTXOs)
     return newset as this;
   }
 
   _feeCheck(fee:BN, feeAssetID:Buffer):boolean {
     return (typeof fee !== "undefined" && 
     typeof feeAssetID !== "undefined" &&
     fee.gt(new BN(0)) && feeAssetID instanceof Buffer);
   }
 
   getMinimumSpendable = (aad:AssetAmountDestination, asOf:BN = UnixNow(), locktime:BN = new BN(0), threshold:number = 1):Error => {
     const utxoArray:Array<UTXO> = this.getAllUTXOs();
     const outids:object = {};
     for(let i = 0; i < utxoArray.length && !aad.canComplete(); i++) {
       const u:UTXO = utxoArray[i];
       const assetKey:string = u.getAssetID().toString("hex");
       const fromAddresses:Array<Buffer> = aad.getSenders();
       if(u.getOutput() instanceof AmountOutput && aad.assetExists(assetKey) && u.getOutput().meetsThreshold(fromAddresses, asOf)) {
         const am:AssetAmount = aad.getAssetAmount(assetKey);
         if(!am.isFinished()){
           const uout:AmountOutput = u.getOutput() as AmountOutput;
           outids[assetKey] = uout.getOutputID();
           const amount = uout.getAmount();
           am.spendAmount(amount);
           const txid:Buffer = u.getTxID();
           const outputidx:Buffer = u.getOutputIdx();
           const input:SECPTransferInput = new SECPTransferInput(amount);
           const xferin:TransferableInput = new TransferableInput(txid, outputidx, u.getAssetID(), input);
           const spenders:Array<Buffer> = uout.getSpenders(fromAddresses, asOf);
           for (let j = 0; j < spenders.length; j++) {
             const idx:number = uout.getAddressIdx(spenders[j]);
             if (idx === -1) {
               /* istanbul ignore next */
               throw new Error('Error - UTXOSet.getMinimumSpendable: no such '
               + `address in output: ${spenders[j]}`);
             }
             xferin.getInput().addSignatureIdx(idx, spenders[j]);
           }
           aad.addInput(xferin);
         } else if(aad.assetExists(assetKey) && !(u.getOutput() instanceof AmountOutput)){
           /**
            * Leaving the below lines, not simply for posterity, but for clarification.
            * AssetIDs may have mixed OutputTypes. 
            * Some of those OutputTypes may implement AmountOutput.
            * Others may not.
            * Simply continue in this condition.
            */
           /*return new Error('Error - UTXOSet.getMinimumSpendable: outputID does not '
             + `implement AmountOutput: ${u.getOutput().getOutputID}`);*/
             continue;
         }
       }
     }
     if(!aad.canComplete()) {
       return new Error('Error - UTXOSet.getMinimumSpendable: insufficient '
       + 'funds to create the transaction');
     }
     const amounts:Array<AssetAmount> = aad.getAmounts();
     const zero:BN = new BN(0);
     for(let i = 0; i < amounts.length; i++) {
       const assetKey:string = amounts[i].getAssetIDString();
       const amount:BN = amounts[i].getAmount();
       if (amount.gt(zero)) {
         const spendout:AmountOutput = SelectOutputClass(outids[assetKey],
           amount, aad.getDestinations(), locktime, threshold) as AmountOutput;
         const xferout:TransferableOutput = new TransferableOutput(amounts[i].getAssetID(), spendout);
         aad.addOutput(xferout);
       }
       const change:BN = amounts[i].getChange();
       if (change.gt(zero)) {
         const changeout:AmountOutput = SelectOutputClass(outids[assetKey],
           change, aad.getChangeAddresses()) as AmountOutput;
         const chgxferout:TransferableOutput = new TransferableOutput(amounts[i].getAssetID(), changeout);
         aad.addChange(chgxferout);
       }
     }
     return undefined;
   }
 
   /**
     * Creates an unsigned ImportTx transaction.
     *
     * @param networkid The number representing NetworkID of the node
     * @param blockchainid The {@link https://github.com/feross/buffer|Buffer} representing the BlockchainID for the transaction
     * @param toAddresses The addresses to send the funds
     * @param fromAddresses The addresses being used to send the funds from the UTXOs {@link https://github.com/feross/buffer|Buffer}
     * @param importIns An array of [[TransferableInput]]s being imported
     * @param sourceChain A {@link https://github.com/feross/buffer|Buffer} for the chainid where the imports are coming from.
     * @param fee Optional. The amount of fees to burn in its smallest denomination, represented as {@link https://github.com/indutny/bn.js/|BN}. Fee will come from the inputs first, if they can.
     * @param feeAssetID Optional. The assetID of the fees being burned. 
     * @param memo Optional contains arbitrary bytes, up to 256 bytes
     * @param asOf Optional. The timestamp to verify the transaction against as a {@link https://github.com/indutny/bn.js/|BN}
     * @param locktime Optional. The locktime field created in the resulting outputs
     * @param threshold Optional. The number of signatures required to spend the funds in the resultant UTXO
     * @returns An unsigned transaction created from the passed in parameters.
     *
     */
    buildImportTx = (
     networkid: number, 
     blockchainid: Buffer,
     toAddresses: string[],
     fromAddresses: Buffer[],
     atomics: UTXO[],
     sourceChain: Buffer = undefined, 
     fee: BN = undefined,
     feeAssetID: Buffer = undefined
   ): UnsignedTx => {

     const zero: BN = new BN(0);
     const ins: TransferableInput[] = [];
     const outs: EVMOutput[] = [];

     if(typeof fee === "undefined") {
       fee = zero.clone();
     }
 
     let feepaid: BN = new BN(0);
     const feeAssetStr: string = feeAssetID.toString("hex");
     atomics.forEach((atomic: UTXO) => {
       const assetID: Buffer = atomic.getAssetID(); 
       const output: AmountOutput = atomic.getOutput() as AmountOutput;
       const amt: BN = output.getAmount().clone();
 
       let infeeamount: BN = amt.clone();
       const assetStr: string = assetID.toString("hex");
       if(
         typeof feeAssetID !== "undefined" && 
         fee.gt(zero) && 
         feepaid.lt(fee) && 
         assetStr === feeAssetStr
       ) 
       {
         feepaid = feepaid.add(infeeamount);
         if(feepaid.gt(fee)) {
           infeeamount = feepaid.sub(fee);
           feepaid = fee.clone();
         } else {
           infeeamount =  zero.clone();
         }
       }
 
       const txid: Buffer = atomic.getTxID();
       const outputidx: Buffer = atomic.getOutputIdx();
       const input: SECPTransferInput = new SECPTransferInput(amt);
       const xferin: TransferableInput = new TransferableInput(txid, outputidx, assetID, input);
       const from: Buffer[] = output.getAddresses(); 
       const spenders: Buffer[] = output.getSpenders(from);
       spenders.forEach((spender: Buffer) => {
         const idx: number = output.getAddressIdx(spender);
         if (idx === -1) {
           /* istanbul ignore next */
           throw new Error(`Error - UTXOSet.buildImportTx: no such address in output: ${spender}`);
         }
         xferin.getInput().addSignatureIdx(idx, spender);
       });
       ins.push(xferin);
       //add extra outputs for each amount (calculated from the imported inputs), minus fees
       if(infeeamount.gt(zero)) {
         const evmOutput: EVMOutput = new EVMOutput(
           toAddresses[0],
           amt,
           assetID
         );
         outs.push(evmOutput);
       }
     });
     
     // TODO - review commented out code to confirm that we don't need it.
     // get remaining fees from the provided addresses
    //  let feeRemaining: BN = fee.sub(feepaid);
    //  if(feeRemaining.gt(zero) && this._feeCheck(feeRemaining, feeAssetID)) {
    //    const aad: AssetAmountDestination = new AssetAmountDestination(toAddresses, fromAddresses, changeAddresses);
    //    aad.addAssetAmount(feeAssetID, zero, feeRemaining);
    //    const success: Error = this.getMinimumSpendable(aad, asOf, locktime, threshold);
    //    if(typeof success === "undefined") {
    //      ins = aad.getInputs();
    //      outs = aad.getAllOutputs();
    //    } else {
    //      throw success;
    //    }
    //  }

     const importTx: ImportTx = new ImportTx(networkid, blockchainid, sourceChain, ins, outs);
     return new UnsignedTx(importTx);
   };
 
   /**
   * Creates an unsigned ExportTx transaction. 
   *
   * @param networkId The number representing NetworkID of the node
   * @param blockchainId The {@link https://github.com/feross/buffer|Buffer} representing the BlockchainID for the transaction
   * @param amount The amount being exported as a {@link https://github.com/indutny/bn.js/|BN}
   * @param avaxAssetID {@link https://github.com/feross/buffer|Buffer} of the asset ID for AVAX
   * @param toAddresses An array of addresses as {@link https://github.com/feross/buffer|Buffer} who recieves the AVAX
   * @param fromAddresses An array of addresses as {@link https://github.com/feross/buffer|Buffer} who owns the AVAX
   * @param changeAddresses Optional. The addresses that can spend the change remaining from the spent UTXOs.
   * @param destinationChain Optional. A {@link https://github.com/feross/buffer|Buffer} for the chainid where to send the asset.
   * @param fee Optional. The amount of fees to burn in its smallest denomination, represented as {@link https://github.com/indutny/bn.js/|BN}
   * @param feeAssetID Optional. The assetID of the fees being burned. 
   * @param asOf Optional. The timestamp to verify the transaction against as a {@link https://github.com/indutny/bn.js/|BN}
   * @param locktime Optional. The locktime field created in the resulting outputs
   * @param threshold Optional. The number of signatures required to spend the funds in the resultant UTXO
   * @returns An unsigned transaction created from the passed in parameters.
   *
   */
   buildExportTx = (
    networkId: number, 
    blockchainId: Buffer,
    amount: BN,
    avaxAssetId: Buffer,
    toAddresses: Buffer[],
    fromAddresses: Buffer[],
    changeAddresses: Buffer[] = undefined,
    destinationChain: Buffer = undefined,
    fee: BN = undefined,
    feeAssetId: Buffer = undefined, 
    asOf: BN = UnixNow(),
    locktime: BN = new BN(0), 
    threshold: number = 1
  ): UnsignedTx => {
    let ins: EVMInput[] = [];
    let outs: TransferableOutput[] = [];
    let exportouts: TransferableOutput[] = [];
    
    if(typeof changeAddresses === "undefined") {
      changeAddresses = toAddresses;
    }

    const zero: BN = new BN(0);
    
    if (amount.eq(zero)) {
      return undefined;
    }

    if(typeof feeAssetId === 'undefined') {
      feeAssetId = avaxAssetId;
    } else if (feeAssetId.toString('hex') !== avaxAssetId.toString('hex')) {
      /* istanbul ignore next */
      throw new Error('Error - UTXOSet.buildExportTx: feeAssetID must match avaxAssetID');
    }

    if(typeof destinationChain === 'undefined') {
      destinationChain = bintools.cb58Decode(PlatformChainID);
    }

    const aad: AssetAmountDestination = new AssetAmountDestination(toAddresses, fromAddresses, changeAddresses);
    if(avaxAssetId.toString('hex') === feeAssetId.toString('hex')){
      aad.addAssetAmount(avaxAssetId, amount, fee);
    } else {
      aad.addAssetAmount(avaxAssetId, amount, zero);
      if(this._feeCheck(fee, feeAssetId)){
        aad.addAssetAmount(feeAssetId, zero, fee);
      }
    }
    const success: Error = this.getMinimumSpendable(aad, asOf, locktime, threshold);
    if(typeof success === 'undefined') {
      // ins = aad.getInputs();
      outs = aad.getChangeOutputs();
      exportouts = aad.getOutputs();
    } else {
      throw success;
    }

    const exportTx: ExportTx = new ExportTx(networkId, blockchainId, destinationChain, ins, exportouts);
    return new UnsignedTx(exportTx);
  };
 }
 