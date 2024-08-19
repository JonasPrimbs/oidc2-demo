import { AttachmentHeader } from '../../types/attachment-header.interface';
import { EmailPart } from '../../types/email-part.interface';
import { decodeBody } from '../mime-message-part/mime-message-part';

// content types
const contentTypePgpKeys = "application/pgp-keys";
const contentTypePgpSignature = "application/pgp-signature";
const contentTypeIct = "application/oidc-squared-ict";
const contentTypeE2EPoPToken = "application/oidc-squared-e2epop";

export class AttachmentFile implements EmailPart {
  /**
   * Constructs a new Attachment File.
   * @param name File name.
   * @param body encoded body.
   * @param contentType MIME type of the file.
   * @param description Description.
   * @param encoding Encoding.
   */
  constructor(
    public readonly name: string,
    public readonly body: string,
    public readonly contentType: string,
    public readonly description?: string,
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
      'Content-Type': `${this.contentType}; name="${this.name}"`,
      'Content-Disposition': `attachment; filename="${this.name}"`,
    };

    if (this.description) {
      result['Content-Description'] = this.description;
    }

    if (this.encoding) {
      result['Content-Transfer-Encoding'] = this.encoding;
    }

    return result;
  }

  public decodedText():string{
    let rawContent = decodeBody(this.body, this.encoding);
    let textDecoder = new TextDecoder();
    return textDecoder.decode(rawContent);
  }

  private downloadUrl: string | undefined;
  public getDownloadUrl(): string{    
    if(this.downloadUrl === undefined){
      let content = decodeBody(this.body, this.encoding);
      const blob = new Blob([content], { type: this.contentType });
      this.downloadUrl = window.URL.createObjectURL(blob);
    }
    return this.downloadUrl;
  }

  public isPgpKey() : boolean{
    return this.contentType === contentTypePgpKeys;
  }

  public isPgpSignature() : boolean{
    return this.contentType === contentTypePgpSignature;
  }

  public isIct() : boolean{
    return this.contentType.includes(contentTypeIct);
  }

  public isE2EPoPToken() : boolean{
    return this.contentType.includes(contentTypeE2EPoPToken);
  }
}
