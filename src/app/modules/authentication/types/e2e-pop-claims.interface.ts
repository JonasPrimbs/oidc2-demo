export interface E2ePopClaims extends Record<string, any> {
  /**
   * Issuer.
   * Typically the Client ID.
   */
  iss: string;

  /**
   * Subject.
   * Typically the End-Users Subject Identifier.
   */
  sub: string;

  /**
   * Audience.
   * One or more attributes that the receiver uniquely identifies with.
   */
  aud: string | string[];

  /**
   * Issued At.
   * Unix timestamp with seconds precision when the End-to-End Proof-of-Possession Token was issued.
   */
  iat: number;

  /**
   * Not Before.
   * Unix timestamp with seconds precision when the End-to-End Proof-of-Possession Token becomes valid.
   */
  nbf?: number;

  /**
   * Expires.
   * Unix timestamp with seconds precision when the End-to-End Proof-of-Possession Token expires.
   */
  exp: number;

  /**
   * JWT ID.
   * Unique ID of the End-to-End Proof-of-Possession Token.
   */
  jti: string;

  /**
   * ICT JWT ID.
   * Token ID of the corresponding Identity Certification Token.
   */
  ict_jti?: string;
}
