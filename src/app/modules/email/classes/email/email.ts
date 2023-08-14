import { Identity } from '../../../authentication';

export class Email {
  constructor(
    public readonly sender: Identity,
    public readonly receiver: string,
    public readonly subject: string,
    public readonly body: string,
  ) { }
}
