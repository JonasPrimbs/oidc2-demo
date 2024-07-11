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
   * @param pgpPrivateKey Private PGP Key for signing.
   */
  constructor(
    public readonly sender: Identity,
    public readonly receiver: string,
    public readonly subject: string,
    public readonly parts: EmailPart[], 
    private readonly pgpPrivateKey: { key: openpgp.PrivateKey, passphrase: string },
  ) { }

  /**
   * Gets the PGP Fingerprint of the PGP Private Key.
   * @returns PGP Fingerprint.
   */
  public getPgpFingerprint(): string | undefined {
    return this.pgpPrivateKey?.key.getFingerprint();
  }

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
      'Content-Type': `multipart/signed; micalg=pgp-sha384; protocol="application/pgp-signature"; boundary="${boundary}"`,
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
  public async toEmailString(pgpPrivateKey: openpgp.PrivateKey, passphrase: string): Promise<string> {
    // Get private key.
    const privateKey = await openpgp.decryptKey({
      privateKey: pgpPrivateKey,
      passphrase: passphrase,
    });
    // Get public key.
    const publicKey = privateKey.toPublic();
    // Get public key ID.
    const publicKeyId = `0x${publicKey.getKeyID().toHex()}`;
    // Get public key as armored string.
    const publicKeyString = publicKey.armor();

    // Get Public Key as attachment file.
    const publicKeyAttachment = new AttachmentFile(
      `OpenPGP_${publicKeyId.toUpperCase()}.asc`,
      publicKeyString,
      'application/pgp-keys',
      'OpenPGP public key',
      'quoted-printable',
    );

    // Prepare signed content.
    const innerBoundary = this.generateRandomBoundry();
    const innerArr = [
      // MIME Multipart header:
      this.headerToString(this.getMultipartHeader(innerBoundary)),

      // Body parts:
      ...[...this.parts, publicKeyAttachment].map(part => [
        // MIME Header:
        `--${innerBoundary}\r\n${this.headerToString(part.getMimeHeader())}`,
        // Body:
        part.getBody(),
      ]).reduce((prev, curr) => [...prev, ...curr]),

      // End:
      `--${innerBoundary}--\r\n`,
    ];
    const body = innerArr.join('\r\n\r\n');

    // Create signature.
    const pgpMessage = await openpgp.createMessage({ text: body });
    const signatrueString = await openpgp.sign({
      message: pgpMessage,
      signingKeys: privateKey,
      detached: true,
      format: 'armored',
    });
        
    const signatureFile = new AttachmentFile(
      'OpenPGP_signature.asc',
      signatrueString,
      'application/pgp-signature',
      'OpenPGP digital signature',
    );

    const outerBoundary = this.generateRandomBoundry();
    const outerArr = [
      // MIME Multipart header:
      this.headerToString(this.getMultipartSignedHeader(outerBoundary)),

      // Signed message + signature:
      `--${outerBoundary}\r\n${body}\r\n--${outerBoundary}\r\n${this.headerToString(signatureFile.getMimeHeader())}`,
      signatureFile.getBody(),

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
  public async toEncryptedEmailString(pgpPublicKey: openpgp.PublicKey, pgpPrivateKey: openpgp.PrivateKey, passphrase: string): Promise<string> {
    // Get unencrypted email string.
    const emailString = await this.toEmailString(pgpPrivateKey, passphrase);

    // Create PGP message from emailString.
    const pgpMessage = await openpgp.createMessage({ text: emailString });

    // Encrypt the PGP message with the provided public key.
    return await openpgp.encrypt({
      message: pgpMessage,
      encryptionKeys: pgpPublicKey,
    });
  }

  /**
   * Encodes the email Base64URl.
   * If a PGP public key is provided, the returned raw email string will be encrypted.
   * @returns Base64URL encoded email.
   */
  public async toRawString(): Promise<string> {
    // Get email string.
    const mailString = await this.toEmailString(
      this.pgpPrivateKey.key,
      this.pgpPrivateKey.passphrase,
    );
    return window.btoa(mailString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/\=/g, '');    
  }
}
