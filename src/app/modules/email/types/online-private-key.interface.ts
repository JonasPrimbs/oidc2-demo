import { Identity } from "../../authentication";

import * as openpgp from 'openpgp';
import { MimeMessage } from "../classes/mime-message/mime-message";

export interface OnlinePrivateKey{
  readonly identity: Identity;
  readonly messageId: string;
  readonly privateKey: openpgp.PrivateKey;
  readonly mimeMessage: MimeMessage;
}