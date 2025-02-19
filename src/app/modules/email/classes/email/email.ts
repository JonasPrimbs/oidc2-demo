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
}
