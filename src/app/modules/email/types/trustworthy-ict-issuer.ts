import { Identity } from "../../authentication";
import { MimeMessage } from "../classes/mime-message/mime-message";

export interface TrustworthyIctIssuer{
  readonly identity: Identity;
  readonly issuer: string;
  readonly messageId: string;
}

export interface TrustworthyIctIssuerExtended extends TrustworthyIctIssuer{
  readonly mimeMessage: MimeMessage;
}