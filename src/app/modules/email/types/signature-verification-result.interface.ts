import { Oidc2Identity } from "./oidc2-identity";

export interface SignatureVerificationResult{  
  readonly signatureVerified: boolean;
  readonly oidc2Identity?: Oidc2Identity;
  readonly keyId?: string;
  readonly signatureErrorMessage?: string;
  readonly oidc2ErrorMessage?: string;
  readonly signedAt?: Date;
}