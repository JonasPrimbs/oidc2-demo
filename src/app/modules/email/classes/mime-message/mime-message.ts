import { MimeMessagePart, parseMimeMessagePart } from "../mime-message-part/mime-message-part";

export class MimeMessage{
  constructor(
      public readonly payload: MimeMessagePart,
      ){}
}

/**
* Function to parse a MIME-message
* @param rawMimeContent the MIME-representation of the email
* @returns 
*/
export function parseMimeMessage(rawMimeContent: string) : MimeMessage{
  let messagePart = parseMimeMessagePart(rawMimeContent);
  let mailMessage = new MimeMessage(messagePart);
  return mailMessage;
}