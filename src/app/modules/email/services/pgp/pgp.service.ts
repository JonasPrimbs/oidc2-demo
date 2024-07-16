import { EventEmitter, Injectable } from '@angular/core';
import * as openpgp from 'openpgp';
import { Identity, IdentityService } from 'src/app/modules/authentication';
import { EmailContent } from '../../classes/email-content/email-content';
import { Email } from '../../classes/email/email';
import { parseMimeMessagePart } from '../../classes/mime-message-part/mime-message-part';
import { MimeMessage } from '../../classes/mime-message/mime-message';

@Injectable({
  providedIn: 'root'
})
export class PgpService {
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
  public addPrivateKey(privateKey: { key: openpgp.PrivateKey, identities: Identity[], passphrase: string }): void {
    // Add private key to array of private keys.
    this._privateKeys.push(privateKey);

    // Register the private key for all corresponding identities.
    for (const identity of privateKey.identities) {
      this.addKeyFor(identity, privateKey);
    }

    this.privateKeysChange.emit();
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

  constructor(
    private readonly identityService: IdentityService,
  ) { }


  /**
   * Verifies a MIME-Message
   * @param mimeMessage 
   * @returns 
   */
  public async verifyMimeMessage(mimeMessage: MimeMessage) : Promise<SignatureVerificationResult[]>{
    let armoredKey = mimeMessage.payload.attachments.find(a => a.isPgpKey())?.decodedText();
    let armoredSignature = mimeMessage.payload.attachments.find(a => a.isPgpSignature())?.decodedText();
    let signedContent = mimeMessage.payload.signedContent()?.raw;

    if(armoredKey && armoredSignature && signedContent){
      let publicKey = await openpgp.readKey({armoredKey});
      let signature = await openpgp.readSignature({armoredSignature});
      let message = await openpgp.createMessage({text: signedContent});
      let verifyMessageResult = await openpgp.verify({message, verificationKeys: publicKey, signature});
      return this.verifySignatures(verifyMessageResult.signatures);      
    }

    return [new SignatureVerificationResult(false, undefined, 'No Signature available')];
  }

  private async verifySignatures(signatures: openpgp.VerificationResult[]){
    let signatureVerificationResults: SignatureVerificationResult[] = [];
    for(let result of signatures){
      let keyId = '0x' + result.keyID.toHex().toUpperCase();
      try{
        signatureVerificationResults.push(new SignatureVerificationResult(await result.verified, keyId, undefined, (await result.signature).packets[0].created ?? undefined));          
      }
      catch(ex){
        signatureVerificationResults.push(new SignatureVerificationResult(false, keyId, "Invalid signature"));   
      }
    }
    return signatureVerificationResults;
  }

  /**
   * decrypt and verifies a mime message
   * @param mimeMessage 
   * @returns 
   */
  public async decryptAndVerifyMimeMessage(mimeMessage: MimeMessage) : Promise<DecryptedAndVerificationResult | undefined>{
    let armoredMessage = mimeMessage.payload.encryptedContent()?.body;

    if(armoredMessage){
      let verifiedSignatures: SignatureVerificationResult[] = [];
      
      // decrypt
      let decryptedKeys = await Promise.all(await this.privateKeys.map(k => openpgp.decryptKey({privateKey: k.key, passphrase: k.passphrase})));
      let message = await openpgp.readMessage({armoredMessage});
      let decryptedMessageResult = await openpgp.decrypt({message, decryptionKeys: decryptedKeys});
      
      // the encypted content for thunderbird has only \n for linebreaks instead of \r\n. 
      let decryptedMimeMessagePart = parseMimeMessagePart(decryptedMessageResult.data.replace(/(?<!\r)\n/g, '\r\n'));
      let decryptedMimeMessage = new MimeMessage(decryptedMimeMessagePart);

      //verify
      let armoredKey = decryptedMimeMessage.payload.attachments.find(a => a.isPgpKey())?.decodedText();
      if(armoredKey){
        let publicKey = await openpgp.readKey({armoredKey});
        message = await openpgp.readMessage({armoredMessage});
        let decryptedSignedMessageResult = await openpgp.decrypt({message, decryptionKeys: decryptedKeys, verificationKeys: publicKey});
        verifiedSignatures = await this.verifySignatures(decryptedSignedMessageResult.signatures);
      }
      return new DecryptedAndVerificationResult(decryptedMimeMessage, verifiedSignatures);
    }
    return undefined;
  }

  public async encryptMail(email: Email) : Promise<string | undefined>{
    // todo: find public key of the receiver
    let key = this.privateKeys.find(k => k.identities.includes(email.sender));
    if(!key){
      return;
    }
    let privateKey = await openpgp.decryptKey({privateKey: key.key, passphrase: key.passphrase});
    let publicKey = privateKey.toPublic();
    return await email.toEncryptedEmailString(publicKey, key.key, key.passphrase);
  }
}

export class SignatureVerificationResult{
  constructor(
    public readonly verified: boolean,
    public readonly keyId?: string,
    public readonly errorMessage?: string,
    public readonly signedAt?: Date,
  ) {}
}

export class DecryptedAndVerificationResult{
  constructor(
    public readonly mimeMessage: MimeMessage,
    public readonly signatureVerificationResults: SignatureVerificationResult[],
  ) {}
}
