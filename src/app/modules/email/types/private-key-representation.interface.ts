import { Identity } from "../../authentication";

import * as openpgp from 'openpgp';

export interface PrivateKeyRepresentation{ 
  key: openpgp.PrivateKey, 
  identities: Identity[], 
  passphrase: string,
  messageId?: string,
}