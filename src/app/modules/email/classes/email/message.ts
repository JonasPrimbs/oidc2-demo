import { Email } from "./email";

export class EmailMessage{
  constructor(
    public readonly id: string,
    public readonly threadId: string,
    public readonly labelIds: string[],
    public readonly snippet: string,
    public readonly historyId: string,
    public readonly internalDate: string,
    public readonly payload: EmailMessagePart,
    public readonly sizeEstimate: number,
    public readonly raw: string
  ){ }  

  public static copy(emailMessage: EmailMessage ): EmailMessage{
    return new EmailMessage(
      emailMessage.id ?? '',
      emailMessage.threadId ?? '',
      emailMessage.labelIds ?? new Array<string>(),
      emailMessage.snippet ?? '',
      emailMessage.historyId ?? '',
      emailMessage.internalDate ?? '',
      EmailMessagePart.copy(emailMessage.payload),
      emailMessage.sizeEstimate ?? undefined,
      emailMessage.raw ?? '',
    );
  }
}

export class EmailMessagePart{
  constructor(
    public readonly partId: string,
    public readonly mimeType: string,
    public readonly filename: string,
    public readonly headers: EmailMessageHeader[],
    public readonly body: EmailMessagePartBody,
    public readonly parts: EmailMessagePart[],
  ){ }

  private getHeaderValue(headerName: string): string | undefined{
    return this.headers.find(h => h.name === headerName)?.value;
  }

  public get to(): string | undefined{
    return this.getHeaderValue("To");
  }

  public get from(): string | undefined{
    return this.getHeaderValue("From");
  }

  public get subject(): string | undefined{
    return this.getHeaderValue("Subject");
  }

  private decodData(data: string): string | undefined{
    let preparedData = data
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    let base64decoded = atob(preparedData);

    return base64decoded;
  }

  public get displayText(): string | undefined{

    if (this.body.data !== undefined){
      return this.decodData(this.body.data);
    } 

    let html = this.parts.find(p => p.mimeType === "text/html");
    if(html !== undefined){
      return this.decodData(html.body.data);
    }

    let plaintext = this.parts.find(p => p.mimeType === "text/plain");
    if(plaintext !== undefined){
      return this.decodData(plaintext.body.data);
    }

    return undefined;
  }

  public static copy(part : EmailMessagePart): EmailMessagePart{
    let headers = part?.headers === undefined || part.headers.length == 0 ? new Array<EmailMessageHeader> : part.headers.map(h => EmailMessageHeader.copy(h));
    let parts = part?.parts === undefined || part.parts.length == 0? new Array<EmailMessagePart> : part.parts.map(p => EmailMessagePart.copy(p));

    return new EmailMessagePart(
      part.partId ?? '',
      part.mimeType ?? '',
      part.filename ?? '',
      headers,
      EmailMessagePartBody.copy(part.body),
      parts,
    );
  }
}

export class EmailMessagePartBody {
  constructor (
    public readonly attachmentId: string,
    public readonly size: number,
    public readonly data: string,
  ){ }

  public static copy(partBody: EmailMessagePartBody) : EmailMessagePartBody{
    return new EmailMessagePartBody(
      partBody.attachmentId,
      partBody.size,
      partBody.data,
    )
  }
}

export class EmailMessageHeader{
  constructor(
    public readonly name: string,
    public readonly value: string,
  ){ }

  public static copy(header: EmailMessageHeader) : EmailMessageHeader{
    return new EmailMessageHeader(
      header.name,
      header.value,
    )
  }
}