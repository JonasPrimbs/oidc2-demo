import { Identity } from "../../authentication";

import * as openpgp from 'openpgp';

export interface PrivateKeyOwnership{ 
  key: openpgp.PrivateKey, 
  identity: Identity, 
  passphrase: string,
  messageId?: string,
}