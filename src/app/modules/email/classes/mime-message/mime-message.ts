import { decodeBase64url } from "src/app/byte-array-converter/base64url";
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

export function decodeAndParseMimeMessage(encodedMime: string) : MimeMessage {
  let decodedEmail = decodeBase64url(encodedMime);
  
  let decoder = new TextDecoder();
  let mimeMessage = decoder.decode(decodedEmail);
  
  let emailMessage = parseMimeMessage(mimeMessage);
  return emailMessage;
}