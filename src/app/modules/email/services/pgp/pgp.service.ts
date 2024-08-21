import { EventEmitter, Injectable } from '@angular/core';
import { Identity, IdentityService } from 'src/app/modules/authentication';
import { AttachmentFile } from '../../classes/attachment-file/attachment-file';
import { parseMimeMessagePart } from '../../classes/mime-message-part/mime-message-part';
import { MimeMessage } from '../../classes/mime-message/mime-message';
import { MimeMessageSecurityResult } from '../../types/mime-message-security-result.interface';
import { SignatureVerificationResult } from '../../types/signature-verification-result.interface';
import { GmailApiService } from '../gmail-api/gmail-api.service';
import { Oidc2VerificationService } from '../oidc2-verification/oidc2-verification.service';

import * as openpgp from 'openpgp';
import { Oidc2IdentityVerificationResult } from '../../types/oidc2-identity-verification-result.interface';

@Injectable({
  providedIn: 'root'
})
export class PgpService {

  constructor(
    private readonly gmailApiService: GmailApiService,
    private readonly oidc2VerificationService: Oidc2VerificationService,
  ) { }


  // Key Management:

  /**
   * Internal represenatation of all private keys.
   */
  private readonly _privateKeys: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }[] = [];
  /**
   * Gets a readonly array of all private keys.
   */
  public get privateKeys(): { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }[] {
    return [ ...this._privateKeys ];
  }

  public readonly privateKeysChange = new EventEmitter<void>();

  /**
   * Adds a PGP private key to privateKeys.
   * @param privateKey PGP Private Key to add.
   */
  public async addPrivateKey(privateKey: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }): Promise<void> {
    // Add private key to array of private keys.
    this._privateKeys.push(privateKey);

    // Register the private key for all corresponding identities.
    for (const identity of privateKey.identities) {
      this.addKeyFor(identity, privateKey);
    }

    this.privateKeysChange.emit();
  }

  /**
   * Saves a private key to gmail.
   * @param privateKey PGP Private Key to save.
   */
   public async savePrivateKey(privateKey: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }): Promise<void> {
    const attachment = new AttachmentFile("private_key.asc", privateKey.key.armor(), "text/plain");

    // save the private key for all corresponding identities.
    for (const identity of privateKey.identities) {
      this.gmailApiService.savePrivateKey(identity, attachment);
    }
  }

  /**
   * Removes a PGP Private Key from privateKeys.
   * @param privateKey PGP Private Key to remove.
   */
  public removePrivateKey(privateKey: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }): void {
    const index = this._privateKeys.indexOf(privateKey);
    this._privateKeys.splice(index, 1);

    this.privateKeysChange.emit();
  }

  // Identity -> Key Mapping:

  /**
   * Mapping from an identity instance to its corresponding PGP keys.
   */
  private readonly _identityPrivateKeys = new Map<Identity, { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }[]>();

  /**
   * Adds a PGP private key for an identity.
   * @param identity Identity.
   * @param key PGP Private Key.
   */
  public addKeyFor(identity: Identity, key: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }) {
    const keys = this._identityPrivateKeys.get(identity);
    if (keys) {
      keys.push(key);
    } else {
      this._identityPrivateKeys.set(identity, [key]);
    }
  }

  /**
   * Gets all registered keys for an identity.
   * @param identity Identity to get keys for.
   * @returns The PGP Key for the requested identity.
   */
  public getKeysFor(identity: Identity): { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }[] {
    return this._identityPrivateKeys.get(identity) ?? [];
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
   * @param armoredPrivateKey Armored ürivate key to import.
   * @returns Imported PGP private key.
   */
  public async importPrivateKey(armoredPrivateKey: string): Promise<openpgp.PrivateKey> {
    return await openpgp.readPrivateKey({
      armoredKey: armoredPrivateKey,
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

  /**
   * checks the security of a mime message.
   * decrypts the message if encrypted.
   * verifies signatures and oidc2identity
   * @param mimeMessage 
   * @returns 
   */
  public async checkMimeMessageSecurity(mimeMessage: MimeMessage, verifierIdentity: Identity) : Promise<MimeMessageSecurityResult>{
    let verifiedSignatures: SignatureVerificationResult[] = [];
    let processingMimeMessage: MimeMessage = mimeMessage;

    let publicKey: openpgp.PublicKey | undefined;
    let encrypted: boolean = false;
    let decryptionSuccessful: boolean = false;
    let decryptionErrorMessage: string | undefined;

    let signatures : openpgp.VerificationResult[] = [];
    
    let encryptedMessage = processingMimeMessage.payload.encryptedContent()?.body;

    // mail is encrypted
    if(encryptedMessage){
      
      // decrypt
      let decryptedKeys = await Promise.all(await this.privateKeys.map(k => openpgp.decryptKey({privateKey: k.key, passphrase: k.passphrase})));
      let message = await openpgp.readMessage({armoredMessage: encryptedMessage});
      try{
        encrypted = true;
        let decryptedMessageResult = await openpgp.decrypt({message, decryptionKeys: decryptedKeys});
        decryptionSuccessful = true;

        // the encypted content for thunderbird has only \n for linebreaks instead of \r\n. 
        let decryptedMimeContent = decryptedMessageResult.data.replace(/(?<!\r)\n/g, '\r\n');
        
        // append date-header to the decrypted mime message (needed for oidc2-verification)
        if(mimeMessage.payload.date){
          decryptedMimeContent = `Date: ${mimeMessage.payload.date.toISOString()}\r\n` + decryptedMimeContent;
        }
        let decryptedMimeMessagePart = parseMimeMessagePart(decryptedMimeContent);      
        processingMimeMessage = new MimeMessage(decryptedMimeMessagePart);
        
        //verify signatures in the encrypted message
        let armoredKey = processingMimeMessage.payload.attachments.find(a => a.isPgpKey())?.decodedText();
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

    let armoredKey = processingMimeMessage.payload.attachments.find(a => a.isPgpKey())?.decodedText();
    let armoredSignature = processingMimeMessage.payload.attachments.find(a => a.isPgpSignature())?.decodedText();
    let signedContent = processingMimeMessage.payload.signedContent()?.raw;

    // cleartext mail is signed
    if(armoredKey && armoredSignature && signedContent){
      publicKey = await openpgp.readKey({armoredKey});
      let signature = await openpgp.readSignature({armoredSignature});
      let message = await openpgp.createMessage({text: signedContent});
      let verifyMessageResult = await openpgp.verify({message, verificationKeys: publicKey, signature});
      signatures.push(...verifyMessageResult.signatures);
    }

    let ictPopPairs = this.oidc2VerificationService.getIctPopPairs(processingMimeMessage);
    let oidc2VerificationResults = await Promise.all(ictPopPairs.map(pair => this.oidc2VerificationService.verifyOidc2Identity(pair, verifierIdentity, mimeMessage.payload.date)));
    
    if(publicKey){
      verifiedSignatures = await this.verifyPgpSignatures(signatures, oidc2VerificationResults, publicKey!);
    }

    // mail is neither encrypted nor signed
    if(verifiedSignatures.length === 0){
      let noSignatureResult: SignatureVerificationResult = {
        signatureVerified: false,
        signatureErrorMessage: 'no signature available',
      };
      verifiedSignatures.push(noSignatureResult);
    }

    let result: MimeMessageSecurityResult = {
      encrypted,
      decryptionSuccessful,
      decryptionErrorMessage,
      oidc2VerificationResults,
      signatureVerificationResults: verifiedSignatures,
      clearetextMimeMessage: processingMimeMessage,
      publicKey: publicKey,
    };

    return result;
  }

  private async verifyPgpSignatures(signatures: openpgp.VerificationResult[], oidc2VerificationResults: Oidc2IdentityVerificationResult[], publicKey: openpgp.PublicKey): Promise<SignatureVerificationResult[]>{  
    let signatureVerificationResults: SignatureVerificationResult[] = [];
    for(let result of signatures){
      let signatureKeyId = this.getPrettyKeyID(result.keyID); 
      let keyFingerprint = publicKey.getFingerprint(); 

      try{
        await result.verified;
        let signature = await result.signature;
        
        // find oidc2 result with matching pgp-fingerprint
        let matchingOidc2Result = oidc2VerificationResults.find(r => r.ictVerified && r.popVerified && r.identity && r.identity.pgpFingerprint && r.identity.pgpFingerprint.toLowerCase() === keyFingerprint.toLowerCase());

        if(matchingOidc2Result){
          // signature verification successful and oidc2 chain verification successful
          signatureVerificationResults.push({
            signatureVerified: true,
            oidc2Identity: matchingOidc2Result.identity,
            keyId: signatureKeyId,
            signedAt: signature.packets[0].created ?? undefined
          });          
        }
        else{
          let errorMessage = '';
          if(oidc2VerificationResults.length === 0){
            errorMessage = 'no OIDC² identity available';
          }
          else{
            errorMessage = `no matching OIDC² identity for PGP-fingerprint ${keyFingerprint.toUpperCase()} found`;
          }
          
          signatureVerificationResults.push({
            signatureVerified: true,
            oidc2ErrorMessage: errorMessage,
            keyId: signatureKeyId,
          });
        }              
      }
      catch(ex){
        // signature verification failed
        signatureVerificationResults.push({
          signatureVerified: false,
          signatureErrorMessage: 'invalid signature'
        });
      }
    }
    
    return signatureVerificationResults;
  }

  public getPrettyKeyID(keyID: openpgp.KeyID): string{
    return '0x' + keyID.toHex().toUpperCase();
  }
}

