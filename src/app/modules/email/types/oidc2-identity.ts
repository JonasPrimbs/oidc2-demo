export interface Oidc2Identity{
  email: string;
  email_verified: boolean;
  issuer: string;
  preferred_username?: string;
  pgpFingerprint: string;
}