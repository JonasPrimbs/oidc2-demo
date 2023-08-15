import { MimeHeader } from './mime-header.interface';

export interface AttachmentHeader extends MimeHeader {
  /**
   * Encoding type.
   * @example "base64"
   */
  'Content-Transfer-Encoding': string;

  /**
   * Content disposition.
   * @example "attachment; filename=example.txt"
   */
  'Content-Disposition': string;
}
