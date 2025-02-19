import { MimeHeader } from './mime-header.interface';

export interface EmailHeader extends MimeHeader {
  /**
   * Sender.
   * @example "alice@mail.example.com"
   */
  'From': string;

  /**
   * Receiver.
   * @example "bob@mail.example.com"
   */
  'To': string;

  /**
   * Subject.
   * @example "Important Message"
   */
  'Subject': string;
}
