import { EmailContentHeader } from '../../types/email-content-header.interface';
import { EmailPart } from '../../types/email-part.interface';

export class EmailContent implements EmailPart {
  /**
   * Constructs a new Email Content.
   * @param body Body of the email.
   */
  constructor(
    public readonly body: string,
  ) { }

  /**
   * Gets the body of the Email Content.
   * @returns Body as string.
   */
  getBody(): string {
    return this.body;
  }

  /**
   * Gets the MIME header of the Email Content.
   * @returns MIME header object.
   */
  public getMimeHeader(): EmailContentHeader {
    return {
      'MIME-Version': '1.0',
      'Content-Type': 'text/plain; charset="UTF-8"',
    };
  }
}
