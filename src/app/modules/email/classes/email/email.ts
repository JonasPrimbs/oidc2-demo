import * as openpgp from 'openpgp';

import { Identity } from '../../../authentication';
import { EmailHeader } from '../../types/email-header.interface';
import { EmailPart } from '../../types/email-part.interface';

export class Email {
  /**
   * Constructs a new email.
   * @param sender Sender identity.
   * @param receiver Receiver email.
   * @param subject Subject.
   * @param parts Email parts.
   * @param pgpPublicKey PGP Public Key of receiver to encrypt.
   */
  constructor(
    public readonly sender: Identity,
    public readonly receiver: string,
    public readonly subject: string,
    public readonly parts: EmailPart[],
    private readonly pgpPublicKey?: openpgp.Key,
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
      'Content-Type': `multipart/mixed; boundary=${boundary}`,
      'MIME-Version': '1.0',
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
   * Stringifies an email to send it via SMTP.
   * @returns Email as SMTP string.
   */
  public toEmailString(): string {
    const boundary = 'end';
    const arr = [
      // MIME Multipart header:
      this.headerToString(this.getMultipartHeader(boundary)),
      // Body parts:
      ...this.parts.map(part => [
        // MIME Header:
        `--${boundary}\r\n${this.headerToString(part.getMimeHeader())}`,
        // Body:
        part.getBody()
      ]).reduce((prev, curr) => [...prev, ...curr]),
      // End:
      `--${boundary}--`,
    ];
    return arr.join('\r\n\r\n');
  }

  /**
   * Encrypts the email string with PGP.
   * @param pgpPublicKey PGP Public Key of the receiver to encrypt the email with.
   * @returns PGP-encrypted email.
   */
  public async toEncryptedEmailString(pgpPublicKey: openpgp.PublicKey): Promise<string> {
    // Get unencrypted email string.
    const emailString = this.toEmailString();

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
    // Get (encrypted) email string.
    const mailString = this.pgpPublicKey ? (await this.toEncryptedEmailString(this.pgpPublicKey)) : this.toEmailString();

    // Encode Email Base64URL.
    return window.btoa(mailString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/\=/, '');
  }
}
