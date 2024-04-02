import { AttachmentHeader } from '../../types/attachment-header.interface';
import { EmailPart } from '../../types/email-part.interface';

export class AttachmentFile implements EmailPart {
  /**
   * Constructs a new Attachment File.
   * @param name File name.
   * @param body Base64 encoded body.
   * @param fileType MIME type of the file.
   * @param description Description.
   * @param encoding Encoding.
   */
  constructor(
    public readonly name: string,
    public readonly body: string,
    public readonly fileType: string,
    public readonly description: string,
    public readonly encoding?: string,
  ) { }

  /**
   * Gets the body of the Attachment File.
   * @returns Body as string.
   */
  getBody(): string {
    return this.body;
  }

  /**
   * Gets the MIME header of the Attachment File.
   * @returns MIME header object.
   */
  public getMimeHeader(): AttachmentHeader {
    const result: AttachmentHeader = {
      'Content-Type': `${this.fileType}; name="${this.name}"`,
      'Content-Description': this.description,
      'Content-Disposition': `attachment; filename="${this.name}"`,
    };

    if (this.encoding) {
      result['Content-Transfer-Encoding'] = this.encoding;
    }

    return result;
  }
}
