import { MimeHeader } from "./mime-header.interface";

export interface EmailPart {
  /**
   * Gets the body of the email part.
   * @returns Email part.
   */
  getBody(): string;

  /**
   * Gets the MIME header of the email part.
   * @returns MIME header object.
   */
  getMimeHeader(): MimeHeader;
}
