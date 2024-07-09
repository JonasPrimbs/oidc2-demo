import { decodeBase64 } from "src/app/byte-array-converter";

const contentTypeHeader = "content-type";
const contentTransferEncodingHeader = "content-transfer-encoding";
const contentDispositionHeader = "content-disposition";
const fromHeader = "from";
const subjectHeader = "subject";
const toHeader = "to";
const dateHeader = "date";

const parameterRegex = /\s(\w+)=("([^"]*)"|([\w\d-]+))/gi;
const mimeTypeRegex = /([\w\d\-\_]+)\/([\w\d\-\_]+)/gi;
const headerRegex = /([\w-]+):\s(.*)/;

const emptyLine = '\r\n\r\n';

const contentTransferEncodingBase64 = "base64";
const contentTransferEncodingQuotedPrintable = "quoted-printable";

const contentDispositionFilename = "filename";
const contentDispositionAttachment = "attachment";

const contentTypeTextHtmp = "text/html";
const contentTypeTextPlain = "text/plain";
const contentTypePgpKeys = "application/pgp-keys";
const contentTypePgpSignature = "application/pgp-signature";
const contentTypeSigned = "multipart/signed";

export class EmailMessage{
  constructor(
      public readonly payload: EmailMessagePart,
      ){}
}

export class EmailMessagePart{
  constructor(
      public readonly headers: EmailMessageHeader[],
      public readonly body: EmailMessagePartBody,
      public readonly parts: EmailMessagePart[],
      public readonly raw: string | undefined,
  ){}

  public get subject(): string | undefined {
    return findHeader(this.headers, subjectHeader)?.value;
  }
  
  public get from(): string | undefined {
    return findHeader(this.headers, fromHeader)?.value;
  }

  public get to(): string | undefined {
    return findHeader(this.headers, toHeader)?.value;
  }

  public get date(): Date | undefined {
    let date = findHeader(this.headers, dateHeader)?.value;
    if(date !== undefined){
      return new Date(date);
    }
    return undefined;
  }

  public get contentType(): string | undefined {
    return findHeader(this.headers, contentTypeHeader)?.value;
  }

  public get contentTransferEncoding(): string | undefined {
    return findHeader(this.headers, contentTransferEncodingHeader)?.value;
  }

  public get contentDisposition(): string | undefined {
    return findHeader(this.headers, contentDispositionHeader)?.value;
  }

  public get decodedRawBodyData(): Uint8Array{
    let encoder = new TextEncoder();
    if(this.contentTransferEncoding?.toLowerCase() === contentTransferEncodingBase64){
      return decodeBase64(this.body.data);
    }
    else if(this.contentTransferEncoding?.toLowerCase() === contentTransferEncodingQuotedPrintable){

      return encoder.encode(decodeQuotedPrintable(this.body.data));
    }
    else{
      return encoder.encode(this.body.data);
    }
  }

  public get decodedBodyData(): string{
    if(this.contentTransferEncoding?.toLowerCase() === contentTransferEncodingBase64){
      return decodeBase64Url(this.body.data);
    }
    else if(this.contentTransferEncoding?.toLowerCase() === contentTransferEncodingQuotedPrintable){
      return decodeQuotedPrintable(this.body.data);
    }
    else{
      return this.body.data;
    }
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
    if(this.mimeType === contentTypeTextHtmp || this.mimeType === contentTypeTextPlain){
      return this.decodedBodyData;
    }
    else if(this.parts.length > 0){
      let html = this.parts.find(p => p.mimeType === contentTypeTextHtmp);
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

  public get attachments() : AttachmentFile[]{
    if(this.contentDisposition?.toLowerCase().includes(contentDispositionAttachment)){
      let contentDisposition = findHeader(this.headers, contentDispositionHeader);
      if(contentDisposition !== undefined){
        let fileName = findHeaderParameter(contentDisposition?.parameters, contentDispositionFilename)?.value;
        if(fileName !== undefined && this.mimeType !== undefined){
          let attachment = new AttachmentFile(fileName, this.mimeType, this.decodedRawBodyData);
          return [attachment];
        }
      }
    }
    return this.parts.flatMap(p => p.attachments);
  }

  public findChild(predicate: (part: EmailMessagePart) => boolean): EmailMessagePart | undefined{
    if(predicate(this)){
      return this;
    }
    return this.parts.find(p => p.findChild(predicate));
  }
}


export class EmailMessageHeader{
  constructor(
    public readonly name: string,
    public readonly value: string,
    ){ }
    
    public get parameters(): EmailMessageHeaderParameter[]{
      var regex = new RegExp(parameterRegex);
      let params: EmailMessageHeaderParameter[] = []
      let result = regex.exec(this.value);
      while(result){
        let param = new EmailMessageHeaderParameter(result[1], result[3] ?? result[4])
        params = [...params, param];
        result = regex.exec(this.value);
      }    
      return params;
    }
  }
  
export class EmailMessagePartBody{
  constructor(
    public readonly data: string,
  ){}
}
    

// helper classes

export class EmailMessageHeaderParameter{
  constructor(
    public readonly attribute: string,
    public readonly value: string,
  ){}
}

export class AttachmentFile{
  constructor(
    public readonly fileName: string,
    public readonly contentType: string,
    public readonly content: Uint8Array,
  ){}

  public isPgpKey() : boolean{
    return this.contentType === contentTypePgpKeys;
  }

  public isPgpSignature() : boolean{
    return this.contentType === contentTypePgpSignature;
  }

  private downloadUrl: string | undefined;

  public getDownloadLink(): string{
    
    if(this.downloadUrl === undefined){
      const blob = new Blob([this.content], { type: this.contentType });
      this.downloadUrl = window.URL.createObjectURL(blob);
    }
    return this.downloadUrl;
  }

  public get contentAsString() : string{
    let decoder = new TextDecoder();
    return decoder.decode(this.content);
  }
}


function findHeader(headers: EmailMessageHeader[], name: string) : EmailMessageHeader | undefined{
  return headers.find(h => h.name.toLowerCase() === name);
}

function findHeaderParameter(parameters: EmailMessageHeaderParameter[], attribute: string) : EmailMessageHeaderParameter | undefined{
  return parameters.find(p => p.attribute.toLowerCase() === attribute);
}

/**
* Function to parse a MIME-mail
* @param rawMimeContent the MIME-representation of the email
* @returns 
*/
export function parseEmailMessage(rawMimeContent: string) : EmailMessage{
  let messagePart = parseEmailMessagePart(rawMimeContent);
  let mailMessage = new EmailMessage(messagePart);
  return mailMessage;
}

/**
* Function to parse a single MIME part
* @param rawEmailMessagePart the raw MIME-part 
* @returns 
*/
function parseEmailMessagePart(rawEmailMessagePart: string) : EmailMessagePart{
  // separate header section from body section by empty line (Defined in RFC 5422, Section 2.1)
  let headerContent = rawEmailMessagePart.substring(0, rawEmailMessagePart.indexOf(emptyLine));
  let bodyContent = rawEmailMessagePart.substring(rawEmailMessagePart.indexOf(emptyLine) + emptyLine.length);

  let headers = parseEmailMessageHeaders(headerContent);

  // find the boundary delimiter
  let boundaryDelimiter: string | undefined = undefined;
  let contentType = findHeader(headers, contentTypeHeader);
  if(contentType !== undefined){
      let boundary = findHeaderParameter(contentType.parameters, "boundary")?.value
      boundaryDelimiter = boundary !== undefined ? `--${boundary}` : undefined;
  }

  
  let body = new EmailMessagePartBody(boundaryDelimiter === undefined ? bodyContent : '');
  let parts = boundaryDelimiter !== undefined ? parseEmailMessageParts(bodyContent, boundaryDelimiter) : [];
  return new EmailMessagePart(headers, body, parts, rawEmailMessagePart);
}

/**
* Function to split into multiple body parts
* @param rawEmailMessagePartsContent 
* @param boundaryDelimiter 
* @returns 
*/
function parseEmailMessageParts(rawEmailMessagePartsContent: string, boundaryDelimiter: string) : EmailMessagePart[]{
  const boundaryDelimiterStart = `${boundaryDelimiter}\r\n`;
  const boundaryDelimiterEnd = `${boundaryDelimiter}--`;

  let allParts = rawEmailMessagePartsContent.split(new RegExp(`${boundaryDelimiterStart}|${boundaryDelimiterEnd}`));
  // remove preamble and epilogue (RFC 2046 section 5.1.1)
  let bodyParts = allParts.slice(1, allParts.length-1);

  let messageParts : EmailMessagePart[] = [];
  for(let mimePart of bodyParts){
      // signature goes over the data without empty line
      let mimePartRemovedLastEmptyLine = mimePart.trimEnd() + '\r\n';
      let messagePart = parseEmailMessagePart(mimePartRemovedLastEmptyLine);
      messageParts = [...messageParts, messagePart];
  }
  return messageParts;
}

/**
* Function to parse the header fields of a MIME-part
* @param rawEmailMessageHeadersContent 
* @returns 
*/
function parseEmailMessageHeaders(rawEmailMessageHeadersContent: string) : EmailMessageHeader[]{
  let headers: EmailMessageHeader[] = [];
  let currentHeaderKey: string | undefined = undefined;
  let currentHeaderValue: string | undefined = undefined;

  for(let line of rawEmailMessageHeadersContent.split('\r\n')){
      let header = new RegExp(headerRegex);
      let result = header.exec(line);
      if(result != null){
          if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
              headers = [...headers, new EmailMessageHeader(currentHeaderKey, currentHeaderValue)]; 
          }
          currentHeaderKey = result[1];
          currentHeaderValue = result[2];
      }
      else if(line === ''){
          if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
              headers = [...headers, new EmailMessageHeader(currentHeaderKey, currentHeaderValue)]; 
          }
          currentHeaderKey = undefined;
          currentHeaderValue = undefined;
      }
      else if(currentHeaderValue !== undefined){
          currentHeaderValue = `${currentHeaderValue}\r\n${line}`
      }
  }
  if(currentHeaderKey !== undefined && currentHeaderValue !== undefined){
      headers = [...headers, new EmailMessageHeader(currentHeaderKey, currentHeaderValue)];
  }
  return headers;
}

function decodeQuotedPrintable(input: string) {
  return input
      .replace(/=[\r\n]+/g, '')  // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));  // Decode hex values
}


export function decodeBase64Url(data: string): string {
  let preparedData = data
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  let base64decoded = atob(preparedData);

  return base64decoded;
}