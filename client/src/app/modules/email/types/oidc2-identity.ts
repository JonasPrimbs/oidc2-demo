export interface Oidc2Identity{
  email: string;
  emailVerified: boolean;
  issuer: string;
  preferred_username?: string;
  pgpFingerprint: string;
  ictJwtIoUrl: string;
  ict: string;
  popJwtIoUrl: string;
  pop: string;
}