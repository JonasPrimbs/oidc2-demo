export interface SignatureVerificationResult{  
  readonly signatureVerified: boolean;
  readonly oidc2ChainVerified: boolean;
  readonly keyId?: string;
  readonly signatureErrorMessage?: string;
  readonly oidc2ErrorMessage?: string;
  readonly signedAt?: Date;
}