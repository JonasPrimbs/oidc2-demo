import { Identity } from "../../authentication";

import * as openpgp from 'openpgp';

export interface PublicKeyOwnership{
  readonly identity: Identity;
  readonly publicKeyOwner: string;
  readonly messageId: string;
  readonly publicKey: openpgp.PublicKey;
}