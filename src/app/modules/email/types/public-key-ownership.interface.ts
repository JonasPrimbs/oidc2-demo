import { Identity } from "../../authentication";

import * as openpgp from 'openpgp';
import { MimeMessage } from "../classes/mime-message/mime-message";

export interface PublicKeyOwnership{
  readonly identity: Identity;
  readonly publicKeyOwner: string;
  readonly messageId: string;
  readonly key: openpgp.PublicKey;
}

export interface PublicKeyOwnershipExtended {
  readonly identity: Identity;
  readonly messageId: string;
  readonly mimeMessage: MimeMessage;
}