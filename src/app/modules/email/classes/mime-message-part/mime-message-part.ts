import { decodeBase64 } from "src/app/byte-array-converter";
import { AttachmentFile } from "../attachment-file/attachment-file";
import { MimeMessageHeader as MimeMessageHeader, MimeMessageHeaderParameter } from "../mime-message-header/mime-message-header";


// regular expressions
const mimeTypeRegex = /([\w\d\-\_]+)\/([\w\d\-\_]+)/gi;

// headers
export const contentTypeHeader = "content-type";
const contentTransferEncodingHeader = "content-transfer-encoding";
const contentDispositionHeaderName = "content-disposition";
const contentDescriptionHeaderName = "content-description";
const fromHeader = "from";
const subjectHeader = "subject";
const toHeader = "to";
const dateHeader = "date";

// content disposition
const contentDispositionFilename = "filename";
const contentDispositionAttachment = "attachment";

// content types
const contentTypeTextHtml = "text/html";
const contentTypeTextPlain = "text/plain";
const contentTypeSigned = "multipart/signed";
const contentTypeEncrypted = "multipart/encrypted";
const contentTypeApplicationOctetStream = "application/octet-stream";

const contentTypeProtocolPgpEncrypted = "application/pgp-encrypted";

// content transfer encoding
const contentTransferEncodingBase64 = "base64";
const contentTransferEncodingQuotedPrintable = "quoted-printable";




export class MimeMessagePart{
  constructor(
      public readonly headers: MimeMessageHeader[],
      public readonly body: string | undefined,
      public readonly parts: MimeMessagePart[],
      public readonly raw: string | undefined,
  ){}

  public get subject(): string | undefined {
    return findMimeHeader(this.headers, subjectHeader)?.value;
  }
  
  public get from(): string | undefined {
    return findMimeHeader(this.headers, fromHeader)?.value;
  }

  public get to(): string | undefined {
    return findMimeHeader(this.headers, toHeader)?.value;
  }

  public get date(): Date | undefined {
    let date = findMimeHeader(this.headers, dateHeader)?.value;
    if(date !== undefined){
      return new Date(date);
    }
    return undefined;
  }

  public get contentType(): string | undefined {
    return findMimeHeader(this.headers, contentTypeHeader)?.value;
  }

  public get contentTransferEncoding(): string | undefined {
    return findMimeHeader(this.headers, contentTransferEncodingHeader)?.value;
  }

  public get contentDisposition(): string | undefined {
    return findMimeHeader(this.headers, contentDispositionHeaderName)?.value;
  }

  public get contentDescription(): string | undefined {
    return findMimeHeader(this.headers, contentDescriptionHeaderName)?.value;
  }  

  public decodeBody(): string{
    let decoder = new TextDecoder();
    return decoder.decode(decodeBody(this.body ?? '', this.contentTransferEncoding));
  }

  public get mimeType(): string | undefined {
    if(this.contentType === undefined){
      return undefined
    }
    let mimeTypeRegExp = new RegExp(mimeTypeRegex);
    let mimeType = mimeTypeRegExp.exec(this.contentType);
    if(mimeType != null){
      return mimeType[0];
    }
    return undefined;
  }

  public get displayText(): string | undefined {
    if(this.mimeType === contentTypeTextHtml || this.mimeType === contentTypeTextPlain){
      return this.decodeBody();
    }
    else if(this.parts.length > 0){
      let html = this.parts.find(p => p.mimeType === contentTypeTextHtml);
      if(html !== undefined){
        return html.displayText;
      }
      let plain = this.parts.find(p => p.mimeType === contentTypeTextPlain);
      if(plain !== undefined){
        return plain.displayText;
      }
      let content = this.parts.find(p => p.displayText !== undefined);
      if(content !== undefined){
        return content.displayText;
      }
    }
    return undefined;
  }

  public asAttachment() : AttachmentFile | undefined{
    let isAttachment = this.contentDisposition?.toLowerCase().includes(contentDispositionAttachment);
    if(isAttachment){
      let contentDispositionHeader = findMimeHeader(this.headers, contentDispositionHeaderName);
      if(contentDispositionHeader){
        let fileName = findMimeHeaderParameter(contentDispositionHeader?.parameters, contentDispositionFilename)?.value;
        if(fileName && this.body && this.mimeType){
          return new AttachmentFile(fileName, this.body, this.mimeType, this.contentDescription, this.contentTransferEncoding);
        }
      }
    }
    return undefined;
  }

  public get attachments() : AttachmentFile[]{
    let attachment = this.asAttachment();
    if(attachment){
      return [attachment];
    }
    return this.parts.flatMap(p => p.attachments);
  }

  public signedContent(): MimeMessagePart | undefined{
    return this.findChild(part => part.contentType?.includes(contentTypeSigned) ?? false)?.parts[0];
  }

  public encryptedContent(): MimeMessagePart | undefined{
    let encryptedContent = this.findChild(part => part.contentType?.includes(contentTypeEncrypted) ?? false);
    if(encryptedContent && encryptedContent.parts[1].contentType?.includes(contentTypeApplicationOctetStream)){
      let contentType = findMimeHeader(encryptedContent.headers, contentTypeHeader);
      let protocol = findMimeHeaderParameter(contentType?.parameters ?? [], "protocol");
      if(protocol?.value === contentTypeProtocolPgpEncrypted){
        return encryptedContent.parts[1]; // use the second part for the encrypted data (RFC3156 Section 4)
      }
    }
    return undefined; 
  }

  public findChild(predicate: (part: MimeMessagePart) => boolean): MimeMessagePart | undefined{
    if(predicate(this)){
      return this;
    }
    return this.parts.find(p => p.findChild(predicate));
  }
}


/**
 * Find a header parameter attribute
 * @param parameters header parameters
 * @param attribute the attribute to search
 * @returns 
 */
export function findMimeHeaderParameter(parameters: MimeMessageHeaderParameter[], attribute: string) : MimeMessageHeaderParameter | undefined{
  return parameters.find(p => p.attribute.toLowerCase() === attribute);
}

/**
 * find a header by name
 * @param headers all headers 
 * @param name name of the header
 * @returns 
 */
export function findMimeHeader(headers: MimeMessageHeader[], name: string) : MimeMessageHeader | undefined{
  return headers.find(h => h.name.toLowerCase() === name);
}

/**
 * Decode the body to its raw data
 * @param body 
 * @param encoding 
 * @returns 
 */
export function decodeBody(body: string, encoding?: string) : Uint8Array{
  if(!body){
    return new Uint8Array();
  }
  let encoder = new TextEncoder();
  if(encoding?.toLowerCase() === contentTransferEncodingBase64){
    return decodeBase64(body);
  }
  else if(encoding?.toLowerCase() === contentTransferEncodingQuotedPrintable){

    return encoder.encode(decodeQuotedPrintable(body));
  }
  else{
    return encoder.encode(body);
  }
}

/**
 * decode quoted printable string
 * @param input 
 * @returns 
 */
  function decodeQuotedPrintable(input: string) : string{
  return input
      .replace(/=[\r\n]+/g, '')  // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));  // Decode hex values
}