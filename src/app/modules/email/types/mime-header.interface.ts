export interface MimeHeader extends Record<string, string> {
  /**
   * MIME Type of the content.
   * @example "text/txt"
   */
  'Content-Type': string;
}
