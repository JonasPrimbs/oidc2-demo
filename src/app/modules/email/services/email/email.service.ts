import * as openpgp from 'openpgp';

import { Injectable } from '@angular/core';

import { Identity, IdentityService } from '../../../authentication';
import { Email } from '../../classes/email/email';
import { decodeAndParseMimeMessage, MimeMessage } from '../../classes/mime-message/mime-message';
import { GmailApiService } from '../gmail-api/gmail-api.service';
import { PgpService } from '../pgp/pgp.service';
import { AttachmentFile } from '../../classes/attachment-file/attachment-file';
import { encodeBase64url } from 'src/app/byte-array-converter/base64url';
import { EmailPart } from '../../types/email-part.interface';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  /**
   * Gets a list of identities which are sufficient to send emails via Google Mail.
   */
  public get senderIdentities(): Identity[] {
    return this.identityService.identities.filter(
      id => (id.scopes?.indexOf('https://www.googleapis.com/auth/gmail.send') ?? -1) >= 0 && id.claims.email,
    );
  }

  /**
   * Constructs a new Email Service instance.
   * @param identityService Identity Service instance.
   * @param http HTTP Client instance.
   */
  constructor(
    private readonly identityService: IdentityService,
    private readonly pgpService: PgpService,
    private readonly gmailApiService: GmailApiService,
  ) { }


  /**
   * read i-th messate of the inbox-folder
   * @param mailIndex 
   * @param identity 
   * @returns 
   */
  public async readEmail(mailIndex: number, identity: Identity): Promise<MimeMessage|undefined>{
    let listMailsResult = await this.gmailApiService.listMails(identity);
    if(!listMailsResult){
      return undefined;
    }
    let message = await this.gmailApiService.getMessage(identity, listMailsResult.messages[mailIndex].id);

    if(message?.raw === undefined){
      return undefined;
    }
    
    let emailMessage = decodeAndParseMimeMessage(message.raw);
    return emailMessage;
  }

  /**
   * Sends an email.
   * @param email Email to send.
   */
  public async sendEmail(email: Email, privateKey: openpgp.PrivateKey, passphrase: string, encrypted: boolean): Promise<boolean> {
    let emailString: string | undefined;
    
    if(encrypted){
      let encryptionKeys = this.pgpService.getEncryptionKeys(email.sender, email.receiver);
      if(encryptionKeys!== undefined){
        emailString = await this.getEmailRawEncryptedMimeString(email, encryptionKeys, privateKey, passphrase);
      }
    }
    else{
      emailString = await this.getEmailRawMimeString(email, privateKey, passphrase);
    }
    if(emailString !== undefined){
      let res = await this.gmailApiService.sendMail(email.sender, emailString);
      return res !== undefined;
    }
    return false;
  }  

  /**
   * Encrypts the email string with PGP and returns as raw string (base64url encoded)
   * @param encryptionKeys PGP Public Keys of the receivers to encrypt the email with.
   * @param pgpPrivateKey PGP Private Key of the sender to sign the email with.
   * @param passphrase Passphrase of the PGP Private Key to use it.
   * @returns PGP-encrypted email.
   */
   public async getEmailRawEncryptedMimeString(email: Email, encryptionKeys: openpgp.PublicKey[], pgpPrivateKey: openpgp.PrivateKey, passphrase: string): Promise<string> {
    const encryptedMailString = await this.getEncryptedMimeString(email, encryptionKeys, pgpPrivateKey, passphrase);
    return window.btoa(encryptedMailString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/\=/g, '');  
   }

  /**
   * Encodes the email Base64URl.
   * @returns Base64URL encoded email.
   */
  public async getEmailRawMimeString(email: Email, pgpPrivateKey?: openpgp.PrivateKey, passphrase?: string): Promise<string> {
    // Get email string.
    const mailString = await this.getMimeString(email, pgpPrivateKey, passphrase);
    return window.btoa(mailString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/\=/g, '');    
  }

  /**
   * Signs an email and returns the signed email string.
   * @param pgpPrivateKey PGP Private key for signing.
   * @param passphrase Passphrase for the PGP Private Key.
   * @returns Signed email string.
   */
   public async getMimeString(email: Email, pgpPrivateKey?: openpgp.PrivateKey, passphrase?: string): Promise<string> {

    let privateKey: openpgp.PrivateKey | undefined = undefined;

    if(pgpPrivateKey && passphrase && !pgpPrivateKey.isDecrypted()){
      // decrypts the private key
      privateKey = await openpgp.decryptKey({
        privateKey: pgpPrivateKey,
        passphrase: passphrase,
      });
    }

    if(pgpPrivateKey?.isDecrypted()){
      privateKey = pgpPrivateKey;
    }

    let publicKey: openpgp.PublicKey | undefined = undefined;
    let publicKeyAttachment: AttachmentFile | undefined;

    if(privateKey){
      // Get public key.
      publicKey = privateKey.toPublic();
      // Get public key ID.
      const publicKeyId = `0x${publicKey.getKeyID().toHex()}`;
      // Get public key as armored string.
      const publicKeyString = publicKey.armor();
  
      // Get Public Key as attachment file.
      publicKeyAttachment = new AttachmentFile(
        `OpenPGP_${publicKeyId.toUpperCase()}.asc`,
        publicKeyString,
        'application/pgp-keys',
        'OpenPGP public key',
      );
    }

    // skip public key attachment if not available
    let bodyParts = [...email.parts, publicKeyAttachment].filter(p => p !== undefined) as EmailPart[];    

    // Prepare signed content.
    const innerBoundary = this.generateRandomBoundry();
    const innerArr = [
      // MIME Multipart header:
      this.headerToString(email.getMultipartHeader(innerBoundary)),

      // Body parts:
      ...bodyParts.map(part => [
        // MIME Header:
        `--${innerBoundary}\r\n${this.headerToString(part.getMimeHeader())}`,
        // Body:
        part.getBody(),
      ]).reduce((prev, curr) => [...prev, ...curr]),

      // End:
      `--${innerBoundary}--\r\n`,
    ];
    const body = innerArr.join('\r\n\r\n');

    // sign the message, if the private key is available
    let signatureFileAttachment: AttachmentFile | undefined;
    if(privateKey){
      // Create signature.
      const pgpMessage = await openpgp.createMessage({ text: body });
      const signatrueString = await openpgp.sign({
        message: pgpMessage,
        signingKeys: privateKey,
        detached: true,
        format: 'armored',
      });
          
      signatureFileAttachment = new AttachmentFile(
        'OpenPGP_signature.asc',
        signatrueString,
        'application/pgp-signature',
        'OpenPGP digital signature',
      );
    }

    const outerBoundary = this.generateRandomBoundry();

    let signaturePart = '';
    if(signatureFileAttachment){
      signaturePart = `\r\n--${outerBoundary}\r\n${this.headerToString(signatureFileAttachment.getMimeHeader())}\r\n\r\n${signatureFileAttachment.getBody()}`;

    }

    const outerArr = [
      // MIME Multipart header:
      this.headerToString(email.getMultipartSignedHeader(outerBoundary)),

      // Signed message + signature if available:
      `--${outerBoundary}\r\n${body}${signaturePart}`,

      // End:
      `--${outerBoundary}--`,
    ];
    return outerArr.join('\r\n\r\n');
  }

  /**
   * Encrypts the email string with PGP.
   * @param encryptionKeys PGP Public Keys of the receivers to encrypt the email with.
   * @param pgpPrivateKey PGP Private Key of the sender to sign the email with.
   * @param passphrase Passphrase of the PGP Private Key to use it.
   * @returns PGP-encrypted email.
   */
  public async getEncryptedMimeString(email: Email, encryptionKeys: openpgp.PublicKey[], pgpPrivateKey: openpgp.PrivateKey, passphrase: string): Promise<string> {
    // Get signed and unencrypted email string.
    const emailString = await this.getMimeString(email, pgpPrivateKey, passphrase);

    // Create PGP message from emailString.
    const pgpMessage = await openpgp.createMessage({ text: emailString });

    // Encrypt the PGP message with the provided public key.
    const encryptedMailContent = await openpgp.encrypt({
      message: pgpMessage,
      encryptionKeys,
    });

    const outerBoundary = this.generateRandomBoundry();

    // attachment with encrypted content
    const encryptedAttachment = new AttachmentFile("encrypted.asc", encryptedMailContent, "application/octet-stream", "OpenPGP encrypted message");   
    
    // this part is equal for all pgp encrypted mails:
    const pgpMimeVersionPart = `Content-Type: application/pgp-encrypted
    Content-Description: PGP/MIME version identification

    Version: 1`;    
    
    const outerArr = [
      // MIME Multipart header:
      this.headerToString(email.getMultipartEncryptedHeader(outerBoundary)),

      // pgp Mime Version:
      `--${outerBoundary}\r\n${pgpMimeVersionPart}\r\n--${outerBoundary}`,
      
      // encrypted content:
      this.headerToString(encryptedAttachment.getMimeHeader()),      
      encryptedAttachment.getBody(),

      // End:
      `--${outerBoundary}--`,
    ];

    let finalEncryptedMail = outerArr.join('\r\n\r\n');
    
    return finalEncryptedMail;  
  }

  /**
   * Stringifies a MIME header.
   * @param header Header instance.
   * @returns String-encoded header.
   */
   private headerToString(header: Record<string, string>): string {
    return Object.keys(header).map(key => `${key}: ${header[key]}`).join('\r\n');
  }

  /**
   * Generates a random Boundry string.
   * @param byteLength Length of the string in bytes.
   * @returns Random String.
   */
  private generateRandomBoundry(byteLength: number = 16): string {
    const arrayBuffer = new Uint8Array(byteLength);
    const randomBytes = crypto.getRandomValues(arrayBuffer);
    return `---------${encodeBase64url(randomBytes)}`;
  }
}
