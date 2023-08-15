import { MimeHeader } from './mime-header.interface';

export interface AttachmentHeader extends MimeHeader {
  /**
   * Content disposition.
   * @example "attachment; filename=example.txt"
   */
  'Content-Disposition': string;
}
