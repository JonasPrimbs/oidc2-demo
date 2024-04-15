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
    return window.btoa(this.body);
  }

  /**
   * Gets the MIME header of the Email Content.
   * @returns MIME header object.
   */
  public getMimeHeader(): EmailContentHeader {
    return {
      'Content-Type': 'text/plain; charset="UTF-8"; format=flowed',
      'Content-Transfer-Encoding': 'base64',
    };
  }
}
