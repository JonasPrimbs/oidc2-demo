import * as openpgp from 'openpgp';

import { Injectable } from '@angular/core';

import { Identity, IdentityService } from '../../../authentication';
import { Email } from '../../classes/email/email';
import { MimeMessage } from '../../classes/mime-message/mime-message';
import { GmailApiService } from '../gmail-api/gmail-api.service';
import { PgpService } from '../pgp/pgp.service';
import { AttachmentFile } from '../../classes/attachment-file/attachment-file';
import { decodeBase64url, encodeBase64url } from 'src/app/byte-array-converter/base64url';
import { EmailPart } from '../../types/email-part.interface';
import { contentTypeHeader, findMimeHeader, findMimeHeaderParameter, MimeMessagePart } from '../../classes/mime-message-part/mime-message-part';
import { headerRegex, MimeMessageHeader } from '../../classes/mime-message-header/mime-message-header';
import { DecryptedAndVerifiedMimeMessage } from '../../types/mime-message-security-result.interface';

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
    
    let emailMessage = this.decodeAndParseMimeMessage(message.raw);
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
      try{
        let decryptedMessageResult = await this.pgpService.decrypt(encryptedMessage);
        decryptionSuccessful = true;

        // the encypted content for thunderbird has only \n for linebreaks instead of \r\n. 
        let decryptedMimeContent = decryptedMessageResult.data.replace(/(?<!\r)\n/g, '\r\n');
        
        // append date-header to the decrypted mime message (needed for oidc2-verification)
        if(mimeMessage.payload.date){
          decryptedMimeContent = `Date: ${mimeMessage.payload.date.toISOString()}\r\n` + decryptedMimeContent;
        }
        let decryptedMimeMessagePart = this.parseMimeMessagePart(decryptedMimeContent);      
        clearetextMimeMessage = new MimeMessage(decryptedMimeMessagePart);
        
        //verify signatures in the encrypted message
        let armoredKey = clearetextMimeMessage.payload.attachments.find(a => a.isPgpKey())?.decodedText();
        if(armoredKey){
          publicKey = await this.pgpService.importPublicKey(armoredKey);
          let decryptedSignedMessageResult = await this.pgpService.decrypt(encryptedMessage, [publicKey]);
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
      publicKey = await this.pgpService.importPublicKey(armoredKey);
      let verifyMessageResult = await this.pgpService.verify(armoredSignature, signedContent, [publicKey]);
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
    * Function to parse a MIME-message
    * @param rawMimeContent the MIME-representation of the email
    * @returns 
    */
  public parseMimeMessage(rawMimeContent: string) : MimeMessage{
    let messagePart = this.parseMimeMessagePart(rawMimeContent);
    let mailMessage = new MimeMessage(messagePart);
    return mailMessage;
  }

  /**
   * decodes and parses a MIME message
   * @param encodedMime 
   * @returns 
   */
  public decodeAndParseMimeMessage(encodedMime: string) : MimeMessage {
    let decodedEmail = decodeBase64url(encodedMime);
    
    let decoder = new TextDecoder();
    let mimeMessage = decoder.decode(decodedEmail);
    
    let emailMessage = this.parseMimeMessage(mimeMessage);
    return emailMessage;
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
    let privateKey = await this.pgpService.decryptPrivateKey(pgpPrivateKey, passphrase);

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
      
      let signature = await this.pgpService.sign(body, [privateKey])
          
      signatureFileAttachment = new AttachmentFile(
        'OpenPGP_signature.asc',
        signature,
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

    let encryptedEmailString = await this.pgpService.encrypt(emailString, encryptionKeys);

    const outerBoundary = this.generateRandomBoundry();

    // attachment with encrypted content
    const encryptedAttachment = new AttachmentFile("encrypted.asc", encryptedEmailString, "application/octet-stream", "OpenPGP encrypted message");   
    
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

  //////////////////////////////// PARSE MIME MESSAGE ///////////////////////

  readonly emptyLine = '\r\n\r\n';

  /**
  * Function to parse a single MIME part
  * @param rawEmailMessagePart the raw MIME-part 
  * @returns 
  */
  private parseMimeMessagePart(rawEmailMessagePart: string) : MimeMessagePart{
    // separate header section from body section by empty line (Defined in RFC 5422, Section 2.1)
    let headerContent = rawEmailMessagePart.substring(0, rawEmailMessagePart.indexOf(this.emptyLine));
    let bodyContent = rawEmailMessagePart.substring(rawEmailMessagePart.indexOf(this.emptyLine) + this.emptyLine.length);

    let headers = this.parseMimeMessageHeaders(headerContent);

    // find the boundary delimiter
    let boundaryDelimiter: string | undefined = undefined;
    let contentType = findMimeHeader(headers, contentTypeHeader);
    if(contentType !== undefined){
        let boundary = findMimeHeaderParameter(contentType.parameters, "boundary")?.value
        boundaryDelimiter = boundary !== undefined ? `--${boundary}` : undefined;
    }

    if(boundaryDelimiter){
      return new MimeMessagePart(headers, '', this.parseEmailMessageParts(bodyContent, boundaryDelimiter), rawEmailMessagePart);
    }
    return new MimeMessagePart(headers, bodyContent, [], rawEmailMessagePart);
  }

  /**
  * Function to split into multiple body parts
  * @param rawEmailMessagePartsContent 
  * @param boundaryDelimiter 
  * @returns 
  */
  private parseEmailMessageParts(rawEmailMessagePartsContent: string, boundaryDelimiter: string) : MimeMessagePart[]{
    const boundaryDelimiterStart = `${boundaryDelimiter}\r\n`;
    const boundaryDelimiterEnd = `${boundaryDelimiter}--`;

    let allParts = rawEmailMessagePartsContent.split(new RegExp(`${boundaryDelimiterStart}|${boundaryDelimiterEnd}`));
    // remove preamble and epilogue (RFC 2046 section 5.1.1)
    let bodyParts = allParts.slice(1, allParts.length-1);

    let messageParts : MimeMessagePart[] = [];
    for(let mimePart of bodyParts){
        // signature goes over the data without empty line
        let mimePartRemovedLastEmptyLine = mimePart.trimEnd() + '\r\n';
        let messagePart = this.parseMimeMessagePart(mimePartRemovedLastEmptyLine);
        messageParts = [...messageParts, messagePart];
    }
    return messageParts;
  }

  /**
  * Function to parse the header fields of a MIME-part
  * @param rawMimeMessageHeaderContent 
  * @returns 
  */
  private parseMimeMessageHeaders(rawMimeMessageHeaderContent: string) : MimeMessageHeader[]{
    let headers: MimeMessageHeader[] = [];
    let currentHeaderKey: string | undefined = undefined;
    let currentHeaderValue: string | undefined = undefined;

    for(let line of rawMimeMessageHeaderContent.split('\r\n')){
        let header = new RegExp(headerRegex);
        let result = header.exec(line);
        if(result != null){
            if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
                headers.push(new MimeMessageHeader(currentHeaderKey, currentHeaderValue)); 
            }
            currentHeaderKey = result[1];
            currentHeaderValue = result[2];
        }
        else if(line === ''){
            if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
                headers.push(new MimeMessageHeader(currentHeaderKey, currentHeaderValue)); 
            }
            currentHeaderKey = undefined;
            currentHeaderValue = undefined;
        }
        else if(currentHeaderValue !== undefined){
            currentHeaderValue = `${currentHeaderValue}\r\n${line}`
        }
    }
    if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
        headers.push(new MimeMessageHeader(currentHeaderKey, currentHeaderValue));
    }
    return headers;
  }
}
