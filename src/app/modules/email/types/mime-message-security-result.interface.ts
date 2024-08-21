import { MimeMessage } from "../classes/mime-message/mime-message";
import { SignatureVerificationResult } from "./signature-verification-result.interface";

import * as openpgp from 'openpgp';

export interface MimeMessageSecurityResult{
  readonly encrypted: boolean;
  readonly signatureVerificationResults: SignatureVerificationResult[],
  readonly decryptionSuccessful?: boolean;
  readonly clearetextMimeMessage?: MimeMessage;
  readonly decryptionErrorMessage?: string;
  readonly publicKey?: openpgp.PublicKey;
}