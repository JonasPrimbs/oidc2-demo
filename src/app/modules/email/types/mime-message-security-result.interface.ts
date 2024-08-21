import { MimeMessage } from "../classes/mime-message/mime-message";
import { SignatureVerificationResult } from "./signature-verification-result.interface";
import { Oidc2IdentityVerificationResult } from "./oidc2-identity-verification-result.interface";

import * as openpgp from 'openpgp';

export interface MimeMessageSecurityResult{
  readonly encrypted: boolean;
  readonly signatureVerificationResults: SignatureVerificationResult[];
  readonly oidc2VerificationResults: Oidc2IdentityVerificationResult[];
  readonly decryptionSuccessful?: boolean;
  readonly clearetextMimeMessage?: MimeMessage;
  readonly decryptionErrorMessage?: string;
  readonly publicKey?: openpgp.PublicKey;
}