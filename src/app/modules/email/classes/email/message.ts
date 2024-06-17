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

  public get To(): string | undefined{
    return this.getHeaderValue("To");
  }

  public get From(): string | undefined{
    return this.getHeaderValue("From");
  }

  public get Subject(): string | undefined{
    return this.getHeaderValue("Subject");
  }
}

export class EmailMessagePartBody {
  constructor (
    public readonly attachmentId: string,
    public readonly size: number,
    public readonly data: string,
  ){ }
}

export class EmailMessageHeader{
  constructor(
    public readonly name: string,
    public readonly value: string,
  ){ }
}