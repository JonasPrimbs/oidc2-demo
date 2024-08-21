import { Oidc2Identity } from "./oidc2-identity";

export interface Oidc2IdentityVerificationResult{
  readonly ictVerified: boolean;
  readonly popVerified: boolean;
  readonly identity?: Oidc2Identity;
  readonly errorMessage?: string;
}