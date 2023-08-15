export interface MimeHeader extends Record<string, string> {
  /**
   * MIME Version.
   * @example "1.0"
   */
  'MIME-Version': string;

  /**
   * MIME Type of the content.
   * @example "text/txt"
   */
  'Content-Type': string;
}
