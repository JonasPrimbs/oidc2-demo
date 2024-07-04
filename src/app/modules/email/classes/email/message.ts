
const ContentTypeHeader = "content-type";
const FromHeader = "from";
const SubjectHeader = "subject";
const ToHeader = "to";
const DateHeader = "date";

const boundaryRegex = /boundary="([-\w]+)"/gi;
const headerRegex = /([\w-]+):\s(.*)/;
const emptyLine = '\r\n\r\n';

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
    return findHeader(this.headers, SubjectHeader)?.value;
  }
  
  public get from(): string | undefined {
    return findHeader(this.headers, FromHeader)?.value;
  }

  public get to(): string | undefined {
    return findHeader(this.headers, ToHeader)?.value;
  }

  public get date(): Date | undefined {
    let date = findHeader(this.headers, DateHeader)?.value;
    if(date !== undefined){
      return new Date(date);
    }
    return undefined;
  }

  public get mimeType(): string | undefined {
    return findHeader(this.headers, ContentTypeHeader)?.value;
  }

  public get displayText(): string | undefined {
    // fix this displayText getter
    if (this.body.data !== undefined){
      return decodeBase64Url(this.body.data);
    } 

    let html = this.parts.find(p => p.mimeType?.includes("text/html"));
    if(html !== undefined){
      return decodeBase64Url(html.body.data);
    }

    let plaintext = this.parts.find(p => p.mimeType?.includes("text/plain"));
    if(plaintext !== undefined){
      return decodeBase64Url(plaintext.body.data);
    }

    return undefined;
  }
}

export class EmailMessageHeader{
  constructor(
      public readonly name: string,
      public readonly value: string,
  ){}
}

export class EmailMessagePartBody{
  constructor(
      public readonly data: string,
  ){}
}

function findHeader(headers: EmailMessageHeader[], name: string) : EmailMessageHeader | undefined{
  return headers.find(h => h.name.toLowerCase() === name);
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
  let contentType = findHeader(headers, ContentTypeHeader);
  if(contentType !== undefined){
      let boundary = new RegExp(boundaryRegex);
      let result = boundary.exec(contentType.value);
      if(result !== null){
          boundaryDelimiter = `--${result[1]}`;
      }
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
  const boundaryDelimiterEnd = `${boundaryDelimiter}--\r\n`;

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

export function decodeBase64Url(data: string): string {
  let preparedData = data
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  let base64decoded = atob(preparedData);

  return base64decoded;
}