import { EventEmitter, Injectable } from '@angular/core';
import { Identity } from 'src/app/modules/authentication';
import { parseMimeMessagePart } from '../../classes/mime-message-part/mime-message-part';
import { MimeMessage } from '../../classes/mime-message/mime-message';
import { DecryptedAndVerifiedMimeMessage, MimeMessageSecurityResult } from '../../types/mime-message-security-result.interface';
import { PublicKeyOwnership } from '../../types/public-key-ownership.interface';
import { PrivateKeyOwnership } from '../../types/private-key-ownership.interface';

import * as openpgp from 'openpgp';

@Injectable({
  providedIn: 'root'
})
export class PgpService {

  constructor(
  ) { }

  // Key Management:

  /**
   * Internal represenatation of all private keys.
   */
  private readonly _privateKeys: PrivateKeyOwnership[] = [];
  /**
   * Gets a readonly array of all private keys.
   */
  public get privateKeys(): PrivateKeyOwnership[] {
    return [ ...this._privateKeys ];
  }

  public readonly privateKeysChanged = new EventEmitter<void>();

  /**
   * Adds a PGP private key to privateKeys.
   * @param privateKey PGP Private Key to add.
   */
  public async addPrivateKey(privateKey: PrivateKeyOwnership): Promise<void> {
    // Add private key to array of private keys.
    this._privateKeys.push(privateKey);
    this.privateKeysChanged.emit();
  }

  /**
   * Removes a PGP Private Key from privateKeys.
   * @param privateKey PGP Private Key to remove.
   */
  public removeLocalPrivateKey(privateKey: PrivateKeyOwnership): void {
    const index = this._privateKeys.indexOf(privateKey);
    this._privateKeys.splice(index, 1);
    this.privateKeysChanged.emit();
  }

  /**
   * Gets all registered keys for an identity.
   * @param identity Identity to get keys for.
   * @returns The PGP Key for the requested identity.
   */
  public getKeysFor(identity: Identity): PrivateKeyOwnership[] {
    return this._privateKeys.filter(pk => pk.identity === identity);
  }

  // public keys

  private _publicKeys: PublicKeyOwnership[] = [];

  public get publicKeys(): PublicKeyOwnership[]{
    return [...this._publicKeys];
  }

  public readonly publicKeyOwnershipsChange = new EventEmitter<void>();

  /**
   * Removes a public key local
   * @param publicKeyOwnership 
   */
  public async removeLocalPublicKey(publicKeyOwnership: PublicKeyOwnership): Promise<void>{
    const index = this.publicKeys.indexOf(publicKeyOwnership);    
    this._publicKeys.splice(index, 1);
    this.publicKeyOwnershipsChange.emit();
  }

  /**
   * adds a new public key ownership
   * @param publicKeyOwnership 
   */
  public async addPublicKeyOwnership(publicKeyOwnership: PublicKeyOwnership){    
    this._publicKeys.push(publicKeyOwnership);
    this.publicKeyOwnershipsChange.emit();
  }

  /**
   * set the public key ownerships
   * @param publicKeyOwnerships 
   */
  public setPublicKeyOwnerships(publicKeyOwnerships: PublicKeyOwnership[]){
    this._publicKeys = [...publicKeyOwnerships];
    this.publicKeyOwnershipsChange.emit();
  }

  // Key Generation / Import:

  /**
   * Generates a new PGP Key Pair.
   * @param userId UserID.
   * @param passphrase Passphrase.
   * @returns Generated key pair.
   */
  public async generateKeyPair(userId: { name: string, email: string }, passphrase: string): Promise<openpgp.KeyPair> {
    // Generate the key pair.
    const generatedArmoredKeyPair = await openpgp.generateKey({
      type: 'ecc',
      curve: 'p384',
      userIDs: [userId],
      passphrase: passphrase,
      format: 'armored',
      date: new Date(),
      keyExpirationTime: 60*60*24*7, // 1 week.
    });

    // Read the key pair and return it.
    return this.importKeyPair(generatedArmoredKeyPair);
  }

  /**
   * Imports a PGP private key.
   * @param armoredPrivateKey Armored private key to import.
   * @returns Imported PGP private key.
   */
  public async importPrivateKey(armoredPrivateKey: string): Promise<openpgp.PrivateKey> {
    return await openpgp.readPrivateKey({
      armoredKey: armoredPrivateKey,
    });
  }

  /**
   * Imports a PGP private key.
   * @param binaryPrivateKey Binary private key to import.
   * @returns Imported PGP private key.
   */
   public async importBinaryPrivateKey(binaryPrivateKey: Uint8Array): Promise<openpgp.PrivateKey> {
    return await openpgp.readPrivateKey({
      binaryKey: binaryPrivateKey,
    });
  }

  /**
   * Imports a PGP public key.
   * @param armoredPublicKey Armored public key to import.
   * @returns Imported PGP public key.
   */
  public async importPublicKey(armoredPublicKey: string): Promise<openpgp.PublicKey> {
    return await openpgp.readKey({
      armoredKey: armoredPublicKey,
    });
  }

  /**
   * Imports a PGP key pair.
   * @param armoredKeyPair Key pair to import.
   * @returns Imported PGP key pair.
   */
  public async importKeyPair(armoredKeyPair: { publicKey: string, privateKey: string }): Promise<openpgp.KeyPair> {
    // Import each key pair.
    const [privateKey, publicKey] = await Promise.all([
      this.importPrivateKey(armoredKeyPair.privateKey),
      this.importPublicKey(armoredKeyPair.publicKey),
    ]);
    // Return imported keys as key pair.
    return {
      privateKey,
      publicKey,
    };
  }

  // decrypt and verify MIME message

  /**
   * decrypts a MIME-message
   * @param mimeMessage 
   * @returns 
   */
  public async decryptAndVerifyMimeMessage(mimeMessage: MimeMessage): Promise<DecryptedAndVerifiedMimeMessage>{
    let encryptedMessage = mimeMessage.payload.encryptedContent()?.body;

    let encrypted : boolean = false;
    let decryptionSuccessful :  boolean | undefined = undefined; 
    let decryptionErrorMessage : string | undefined = undefined;
    let clearetextMimeMessage : MimeMessage = mimeMessage;
    let signatures : openpgp.VerificationResult[] = [];
    let publicKey : openpgp.PublicKey | undefined = undefined;

    // decryption
    if(encryptedMessage){
      encrypted = true;
      let decryptedKeys = await Promise.all(await this.privateKeys.map(k => openpgp.decryptKey({privateKey: k.key, passphrase: k.passphrase})));
      let message = await openpgp.readMessage({armoredMessage: encryptedMessage});
      try{
        let decryptedMessageResult = await openpgp.decrypt({message, decryptionKeys: decryptedKeys});
        decryptionSuccessful = true;

        // the encypted content for thunderbird has only \n for linebreaks instead of \r\n. 
        let decryptedMimeContent = decryptedMessageResult.data.replace(/(?<!\r)\n/g, '\r\n');
        
        // append date-header to the decrypted mime message (needed for oidc2-verification)
        if(mimeMessage.payload.date){
          decryptedMimeContent = `Date: ${mimeMessage.payload.date.toISOString()}\r\n` + decryptedMimeContent;
        }
        let decryptedMimeMessagePart = parseMimeMessagePart(decryptedMimeContent);      
        clearetextMimeMessage = new MimeMessage(decryptedMimeMessagePart);
        
        //verify signatures in the encrypted message
        let armoredKey = clearetextMimeMessage.payload.attachments.find(a => a.isPgpKey())?.decodedText();
        if(armoredKey){
          publicKey = await openpgp.readKey({armoredKey});
          message = await openpgp.readMessage({armoredMessage: encryptedMessage});
          let decryptedSignedMessageResult = await openpgp.decrypt({message, decryptionKeys: decryptedKeys, verificationKeys: publicKey});
          signatures.push(...decryptedSignedMessageResult.signatures);
        }
      }
      catch(err){
        if(err instanceof Error){
          decryptionErrorMessage = err.message;
        }
      }
    }

    let armoredKey = clearetextMimeMessage.payload.attachments.find(a => a.isPgpKey())?.decodedText();
    let armoredSignature = clearetextMimeMessage.payload.attachments.find(a => a.isPgpSignature())?.decodedText();
    let signedContent = clearetextMimeMessage.payload.signedContent()?.raw;

    // cleartext mail is signed
    if(armoredKey && armoredSignature && signedContent){
      publicKey = await openpgp.readKey({armoredKey});
      let signature = await openpgp.readSignature({armoredSignature});
      let message = await openpgp.createMessage({text: signedContent});
      let verifyMessageResult = await openpgp.verify({message, verificationKeys: publicKey, signature});
      signatures.push(...verifyMessageResult.signatures);
    }

    return {
      clearetextMimeMessage,
      encrypted,
      decryptionSuccessful,
      decryptionErrorMessage,
      signatures,
      publicKey,
    };
  }

  /**
   * check, wether all signatures are valid
   * @param securityResult 
   * @returns 
   */
  public signaturesAvailableAndValid(securityResult: MimeMessageSecurityResult) : boolean{
    // all signatures are valid
    for(let signature of securityResult.signatureVerificationResults){
      if(!signature.oidc2Identity || !signature.signatureVerified){
        return false;
      }
    }

    // there exist at least one signature
    return securityResult.signatureVerificationResults.length > 0;
  }

  /**
   * check, wether the mail was sent from a given sender
   * @param securityResult 
   * @returns 
   */
   public isMailFromSender(senderEmail: string, securityResult: MimeMessageSecurityResult) : boolean{
    for(let signature of securityResult.signatureVerificationResults){
      // check wether the oidc2 identity is the sender mail address
      if(signature.signatureVerified && signature.oidc2Identity){
        return signature.oidc2Identity.email === senderEmail;
      }
    }

    // the sender is not the gi
    return false;
  }


  /**
   * pretty-print the PGP-KeyID
   * @param keyID 
   * @returns 
   */
  public getPrettyKeyID(keyID: openpgp.KeyID): string{
    return '0x' + keyID.toHex().toUpperCase();
  }

  /**
   * returns true, if the sender identity can encrypt a mail for the receiver
   * @param sender 
   * @param receiver 
   * @returns 
   */
  public canBeEncrypted(sender: Identity, receiver: string): boolean{
    return this.getEncryptionKeys(sender, receiver) !== undefined;
  }

  /**
   * get the encryption keys for all receivers. returns undefined if for any receiver couldnt find any encryptionKey
   * @param receiver 
   * @returns 
   */
  public getEncryptionKeys(sender: Identity, receiver: string): openpgp.PublicKey[] | undefined{
    let receivers = receiver.split(',').map(r => r.toLowerCase().trim());
    let encryptionKeys: openpgp.PublicKey[] = [];
    for(let r of receivers){
      let owner = this.publicKeys.find(p => p.identity === sender && p.publicKeyOwner.toLowerCase() === r);
      if(owner === undefined){
        return undefined;
      }
      encryptionKeys.push(owner.key);
    }
    return encryptionKeys;
  }

  /**
   * find the public key on the keyserver. Do not use this for signature verification etc. often these keys doesn't have identity information and therfore the signature verification fails.
   * Only use to check wether the key is revoked.
   * @param fingerprint 
   * @returns 
   */
  public async searchPublicKeyOnKeyServer(fingerprint: string): Promise<openpgp.PublicKey|undefined>{
    var result = await fetch(`https://keys.openpgp.org/vks/v1/by-fingerprint/${fingerprint.toUpperCase()}`);
    var armoredKey = await result.text();
    try{
      let key = await this.importPublicKey(armoredKey);
      return key;
    }
    catch(err){ }
    return undefined;
  }
}

