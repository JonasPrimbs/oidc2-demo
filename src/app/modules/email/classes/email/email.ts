import * as openpgp from 'openpgp';

import { encodeBase64url } from '../../../../byte-array-converter';
import { Identity } from '../../../authentication';
import { EmailHeader } from '../../types/email-header.interface';
import { EmailPart } from '../../types/email-part.interface';
import { AttachmentFile } from '../attachment-file/attachment-file';

export class Email {
  /**
   * Constructs a new email.
   * @param sender Sender identity.
   * @param receiver Receiver email.
   * @param subject Subject.
   * @param parts Email parts.
   */
  constructor(
    public readonly sender: Identity,
    public readonly receiver: string,
    public readonly subject: string,
    public readonly parts: EmailPart[], 
  ) { }

  /**
   * Generates a MIME Multipart header for an email.
   * @param boundary MIME Boundary.
   * @returns MIME Multipart header.
   */
  public getMultipartHeader(boundary: string): EmailHeader {
    return {
      'To': this.receiver,
      'From': this.sender.claims.email!,
      'Subject': this.subject,
      'Content-Type': `multipart/mixed; boundary="${boundary}"`,
    };
  }

  /**
   * Generates a MIME Multipart header for a signed email.
   * @param boundary MIME Boundary.
   * @returns MIME Multipart header for signed email.
   */
  public getMultipartSignedHeader(boundary: string): EmailHeader {
    return {
      'To': this.receiver,
      'From': this.sender.claims.email!,
      'Subject': this.subject,
      'Content-Type': `multipart/signed; micalg=pgp-sha384; protocol="application/pgp-signature"; protected-headers="v1"; boundary="${boundary}"`,
    };
  }

  /**
   * Generates a MIME Multipart header for a encrypted email.
   * @param boundary MIME Boundary.
   * @returns MIME Multipart header for encrypted email.
   */
  public getMultipartEncryptedHeader(boundary: string): EmailHeader {
    return {
      'To': this.receiver,
      'From': this.sender.claims.email!,
      'Subject': '...',
      'Content-Type': `multipart/encrypted; protocol="application/pgp-encrypted"; boundary="${boundary}"`,
    };
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

  /**
   * Signs an email and returns the signed email string.
   * @param pgpPrivateKey PGP Private key for signing.
   * @param passphrase Passphrase for the PGP Private Key.
   * @returns Signed email string.
   */
  public async toMimeString(pgpPrivateKey?: openpgp.PrivateKey, passphrase?: string): Promise<string> {

    let privateKey: openpgp.PrivateKey | undefined = undefined;

    if(pgpPrivateKey && passphrase && !pgpPrivateKey.isDecrypted()){
      // Get private key.
      privateKey = await openpgp.decryptKey({
        privateKey: pgpPrivateKey,
        passphrase: passphrase,
      });
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
        'quoted-printable',
      );
    }

    // skip public key attachment if not available
    let bodyParts = [...this.parts, publicKeyAttachment].filter(p => p !== undefined) as EmailPart[];    

    // Prepare signed content.
    const innerBoundary = this.generateRandomBoundry();
    const innerArr = [
      // MIME Multipart header:
      this.headerToString(this.getMultipartHeader(innerBoundary)),

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
      this.headerToString(this.getMultipartSignedHeader(outerBoundary)),

      // Signed message + signature if available:
      `--${outerBoundary}\r\n${body}${signaturePart}`,

      // End:
      `--${outerBoundary}--`,
    ];
    return outerArr.join('\r\n\r\n');
  }

  /**
   * Encrypts the email string with PGP.
   * @param pgpPublicKey PGP Public Key of the receiver to encrypt the email with.
   * @param pgpPrivateKey PGP Private Key of the sender to sign the email with.
   * @param passphrase Passphrase of the PGP Private Key to use it.
   * @returns PGP-encrypted email.
   */
  public async toEncryptedMimeString(/*pgpPublicKey: openpgp.PublicKey, */pgpPrivateKey: openpgp.PrivateKey, passphrase: string): Promise<string> {
    // Get signed and unencrypted email string.
    const emailString = await this.toMimeString(pgpPrivateKey, passphrase);
    let decryptedPrivateKey = await openpgp.decryptKey({privateKey: pgpPrivateKey, passphrase});
    let pgpPublicKey = decryptedPrivateKey.toPublic();

    // Create PGP message from emailString.
    const pgpMessage = await openpgp.createMessage({ text: emailString });

    // Encrypt the PGP message with the provided public key.
    const encryptedMailContent = await openpgp.encrypt({
      message: pgpMessage,
      encryptionKeys: pgpPublicKey,
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
      this.headerToString(this.getMultipartEncryptedHeader(outerBoundary)),

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
   * Encrypts the email string with PGP and returns as raw string (base64url encoded)
   * @param pgpPublicKey PGP Public Key of the receiver to encrypt the email with.
   * @param pgpPrivateKey PGP Private Key of the sender to sign the email with.
   * @param passphrase Passphrase of the PGP Private Key to use it.
   * @returns PGP-encrypted email.
   */
   public async toRawEncryptedMimeString(/*pgpPublicKey: openpgp.PublicKey, */pgpPrivateKey: openpgp.PrivateKey, passphrase: string): Promise<string> {
    const encryptedMailString = await this.toEncryptedMimeString(pgpPrivateKey, passphrase);
    return window.btoa(encryptedMailString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/\=/g, '');  
   }

  /**
   * Encodes the email Base64URl.
   * @returns Base64URL encoded email.
   */
  public async toRawMimeString(pgpPrivateKey?: openpgp.PrivateKey, passphrase?: string): Promise<string> {
    // Get email string.
    const mailString = await this.toMimeString(pgpPrivateKey, passphrase);
    return window.btoa(mailString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/\=/g, '');    
  }
}
