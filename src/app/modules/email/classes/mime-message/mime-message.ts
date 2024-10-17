import { MimeMessagePart } from "../mime-message-part/mime-message-part";

export class MimeMessage{
  constructor(
      public readonly payload: MimeMessagePart,
      ){}
}
