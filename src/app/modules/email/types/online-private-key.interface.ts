import { Identity } from "../../authentication";

import * as openpgp from 'openpgp';

export interface OnlinePrivateKey{
  readonly identity: Identity;
  readonly messageId: string;
  readonly privateKey: openpgp.PrivateKey;
}