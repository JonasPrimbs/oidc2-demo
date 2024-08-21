import { Identity } from "../../authentication";

export interface TrustworthyIctIssuer{
  readonly identity: Identity;
  readonly issuer: string;
  readonly messageId: string;
}